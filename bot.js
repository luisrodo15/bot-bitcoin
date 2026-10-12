// Lógica del bot (sin acceso a red ni a Chrome, para poder probarla sola).
// Trabaja por "lotes": cada compra es un lote que se vende por separado.
// - Sin lotes: compra cuando el precio baja X% desde el máximo reciente.
// - Con lotes: compra otro si baja X% más que la compra más barata (hasta el máximo de lotes).
// - Cada lote se vende cuando sube Y% sobre su precio, o si baja el tope de pérdida.
(function (root) {
  const MONEDAS = ["BTC", "ETH", "SOL", "BNB"];
  const CONFIG_INICIAL = {
    moneda: "ETH",      // qué cripto compra y vende el bot (contra USDT)
    monto: 6,           // USDT por compra (Binance pide mínimo 5)
    lotes: 2,           // compras abiertas al mismo tiempo, como máximo
    bajada: 0.6,        // % de bajada para comprar
    subida: 0.6,        // % de subida (sobre el precio de compra) para vender ese lote
    tope: 3,            // % de bajada (sobre el precio de compra) para vender y cortar la pérdida
    perdidaMax: 1,      // USDT de pérdida total que pausa el bot
    comision: 0.1,      // % que cobra Binance por operación
    saldoInicial: 12    // USDT ficticios para la simulación
  };

  function estadoInicial(cfg) {
    return {
      moneda: cfg.moneda, usdt: cfg.saldoInicial, base: cfg.saldoInicial, btc: 0, compras: [], ref: null,
      ganado: 0, pausado: null, activo: true,
      ultimoPrecio: null, ultimaRevision: null, trades: [], inicio: Date.now()
    };
  }

  function r8(x) { return Math.round(x * 1e8) / 1e8; }

  // Revisa un precio. Devuelve la lista de operaciones hechas (puede estar vacía). Modifica `st`.
  function revisar(st, cfg, precio, ahora) {
    st.ultimoPrecio = precio; st.ultimaRevision = ahora;
    const hechas = [];
    if (!st.activo || st.pausado) return hechas;
    const com = cfg.comision / 100;

    // 1) Vender los lotes que llegaron a su meta o a su tope.
    for (const c of st.compras.slice()) {
      const meta = c.precio * (1 + cfg.subida / 100), stop = c.precio * (1 - cfg.tope / 100);
      if (precio < meta && precio > stop) continue;
      const bruto = c.btc * precio, fee = bruto * com, neto = r8(bruto - fee), ganancia = r8(neto - c.costo);
      st.usdt = r8(st.usdt + neto); st.btc = r8(st.btc - c.btc); if (st.btc < 1e-8) st.btc = 0;
      st.compras.splice(st.compras.indexOf(c), 1); st.ganado = r8(st.ganado + ganancia);
      const gano = precio >= meta;
      hechas.push({ t: ahora, tipo: gano ? "VENTA" : "VENTA (tope)", precio, btc: c.btc, usdt: neto, comision: r8(fee), ganancia, motivo: `${gano ? "subió" : "bajó"} ${pct(precio, c.precio)} desde su compra a ${fmt(c.precio)}` });
      if (st.ganado <= -Math.abs(cfg.perdidaMax)) st.pausado = `Pausado: la pérdida total llegó a ${st.ganado.toFixed(2)} USDT (tu tope es ${cfg.perdidaMax}).`;
    }
    if (!st.compras.length && hechas.length) st.ref = precio;

    // 2) Comprar si toca.
    if (!st.pausado) {
      let nivel, desde;
      if (!st.compras.length) {
        st.ref = st.ref == null ? precio : Math.max(st.ref, precio);
        desde = st.ref; nivel = st.ref * (1 - cfg.bajada / 100);
      } else {
        desde = Math.min(...st.compras.map(c => c.precio)); nivel = desde * (1 - cfg.bajada / 100);
      }
      if (precio <= nivel && st.compras.length < cfg.lotes) {
        const monto = Math.min(cfg.monto, st.usdt);
        st.sinSaldo = monto < Math.min(cfg.monto, 5);
        if (!st.sinSaldo) {
          const fee = monto * com, btc = r8((monto - fee) / precio);
          st.usdt = r8(st.usdt - monto); st.btc = r8(st.btc + btc);
          st.compras.push({ precio, btc, costo: monto, t: ahora });
          hechas.push({ t: ahora, tipo: "COMPRA", precio, btc, usdt: monto, comision: r8(fee), motivo: `bajó ${pct(precio, desde)} desde ${fmt(desde)}` });
        }
      }
    }
    for (const h of hechas) st.trades.push(h);
    return hechas;
  }

  function niveles(st, cfg) {
    const n = { ventas: st.compras.map(c => c.precio * (1 + cfg.subida / 100)), stops: st.compras.map(c => c.precio * (1 - cfg.tope / 100)) };
    if (st.compras.length < cfg.lotes) {
      const desde = st.compras.length ? Math.min(...st.compras.map(c => c.precio)) : st.ref;
      if (desde != null) n.compra = desde * (1 - cfg.bajada / 100);
    }
    return n;
  }

  // Simula unas reglas sobre una lista de precios [{t, p}] (uno por minuto).
  // Devuelve la ganancia de cada día (hora local) y los totales.
  function probar(cfg, precios) {
    const st = estadoInicial(cfg), dias = new Map();
    const dia = t => { const d = new Date(t); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    for (const { t, p } of precios) {
      const k = dia(t); if (!dias.has(k)) dias.set(k, { dia: k, ganancia: 0, ventas: 0 });
      for (const h of revisar(st, cfg, p, t)) if (h.ganancia != null) { const d = dias.get(k); d.ganancia += h.ganancia; d.ventas++; }
      st.trades.length = 0;
      if (st.pausado) break;
    }
    const ultimo = precios.length ? precios[precios.length - 1].p : 0;
    const lista = [...dias.values()];
    return {
      dias: lista,
      positivos: lista.filter(d => d.ganancia > 0.00005).length,
      negativos: lista.filter(d => d.ganancia < -0.00005).length,
      ganado: st.ganado,
      ventas: lista.reduce((a, d) => a + d.ventas, 0),
      final: st.usdt + st.btc * ultimo - cfg.saldoInicial,
      abiertos: st.compras.length,
      pausado: !!st.pausado
    };
  }

  // Prueba muchas combinaciones: elige con los primeros 20 días y revisa en los días restantes,
  // que no se usaron para elegir. Devuelve las mejores, ordenadas.
  const DIA = 864e5;
  function buscarMejores(base, precios, cuantas = 3) {
    const corte = precios[0].t + 20 * DIA;
    const ent = precios.filter(x => x.t < corte), pru = precios.filter(x => x.t >= corte);
    const res = [];
    for (const bajada of [0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.5]) for (const subida of [0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.5])
      for (const lotes of [1, 2, 3]) for (const tope of [2, 3, 5]) {
        if (lotes * base.monto > base.saldoInicial + 1e-9) continue;
        const reglas = { ...base, bajada, subida, lotes, tope };
        res.push({ reglas, ent: probar(reglas, ent) });
      }
    res.sort((a, b) => b.ent.final - a.ent.final || b.ent.positivos - a.ent.positivos);
    return res.slice(0, cuantas).map(r => ({ ...r, pru: probar(r.reglas, pru) }));
  }

  function pct(a, b) { return Math.abs((a / b - 1) * 100).toFixed(2) + "%"; }
  function fmt(x) { return Number(x).toLocaleString("en-US", { maximumFractionDigits: 2 }); }

  root.Bot = { MONEDAS, CONFIG_INICIAL, estadoInicial, revisar, niveles, probar, buscarMejores };
})(typeof self !== "undefined" ? self : globalThis);
