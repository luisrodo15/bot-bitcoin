// Estrategia "sentimiento": sigue el índice de miedo y codicia (alternative.me, el mismo tipo que muestra
// CoinMarketCap: mide noticias, redes sociales, volatilidad y volumen) junto con la tendencia de TradingView
// (media EMA de 20 días contra la de 50 días, con velas diarias cerradas).
// - Compra con todo el monto cuando hay codicia (índice >= cfg.codicia, normal 55) Y la EMA20 está arriba de la EMA50.
// - Vende todo cuando hay miedo (índice <= cfg.miedo, normal 25) O la EMA20 cae abajo de la EMA50.
// Probado 2018-2026 en precios diarios de 7 monedas: opera pocas veces al año; en años de bajada pierde mucho
// menos que solo guardar, en años de subida gana menos que solo guardar. Puede perder.
(function (root) {
  const DEF = { codicia: 55, miedo: 25 };
  // Mismo contrato que Bot.revisar: modifica st y devuelve las operaciones (las ventas llevan `compra`).
  function revisar(st, cfg, precio, ahora, sen) {
    st.ultimoPrecio = precio; st.ultimaRevision = ahora;
    const hechas = [];
    if (!st.activo || st.pausado || !sen || sen.indice == null || sen.e20 == null) return hechas;
    // Alerta por noticias (la pone Claude en ajustes.json cuando sale una noticia grave): vende y no compra mientras dure.
    if (sen.alerta) {
      const com = cfg.comision / 100;
      for (const c of st.compras.slice()) {
        const bruto = c.btc * precio, fee = bruto * com, neto = bruto - fee, ganancia = neto - c.costo;
        st.usdt += neto; st.btc = Math.max(0, st.btc - c.btc); st.compras.splice(st.compras.indexOf(c), 1); st.ganado += ganancia;
        hechas.push({ t: ahora, tipo: "VENTA", compra: c.t, precio, btc: c.btc, usdt: neto, comision: fee, ganancia, motivo: `alerta por noticias: ${sen.alerta}` });
      }
      for (const h of hechas) st.trades.push(h);
      return hechas;
    }
    const indice = sen.indice, sube = sen.e20 > sen.e50;
    const codicia = cfg.codicia ?? DEF.codicia, miedo = cfg.miedo ?? DEF.miedo, com = cfg.comision / 100;
    // Modo movimiento (cfg.movimiento = % de subida): mientras la tendencia es buena, vende todo al subir ese % desde la compra
    // y recompra al bajar cfg.movimientoBaja % (igual si no se pone) desde esa venta, o si sigue subiendo ese mismo %.
    const X = (+cfg.movimiento || 0) / 100, Y = (+(cfg.movimientoBaja ?? cfg.movimiento) || 0) / 100, malo = indice <= miedo || !sube, Z = (+(cfg.movimientoSube ?? cfg.movimiento) || 0) / 100; // Z: recompra si sigue subiendo ese % desde la venta
    if (!X || malo || st.compras.length) st.movVenta = null;
    // cfg.movimientoStop (%): al llegar a +X% no vende de inmediato; sigue al precio y vende cuando se regresa ese % desde el máximo.
    const T = (+cfg.movimientoStop || 0) / 100, meta = st.compras.length ? Math.max(...st.compras.map(c => c.precio)) * (1 + X) : 0;
    if (!X || !T || malo || !st.compras.length) st.movMax = null;
    else if (st.movMax || precio >= meta) st.movMax = Math.max(st.movMax || 0, precio);
    const vendeMov = X && !malo && st.compras.length && (T ? st.movMax && precio <= st.movMax * (1 - T) : precio >= meta);
    if (vendeMov) {
      for (const c of st.compras.slice()) {
        const bruto = c.btc * precio, fee = bruto * com, neto = bruto - fee, ganancia = neto - c.costo;
        st.usdt += neto; st.btc = Math.max(0, st.btc - c.btc); st.compras.splice(st.compras.indexOf(c), 1); st.ganado += ganancia;
        hechas.push({ t: ahora, tipo: "VENTA", compra: c.t, precio, btc: c.btc, usdt: neto, comision: fee, ganancia, motivo: T ? `subió ${cfg.movimiento}% o más y luego bajó ${cfg.movimientoStop}% desde el máximo (modo movimiento)` : `subió ${cfg.movimiento}% desde la compra (modo movimiento)` });
      }
      st.movVenta = precio; st.movMax = null;
    } else if (X && !malo && !st.compras.length && st.movVenta && (precio <= st.movVenta * (1 - Y) || precio >= st.movVenta * (1 + Z))) {
      const monto = cfg.reinvertir ? Math.floor(st.usdt * 100) / 100 : Math.min(cfg.monto, st.usdt);
      if (monto >= Math.min(cfg.monto, 5)) {
        const fee = monto * com, btc = (monto - fee) / precio, baja = precio < st.movVenta;
        st.usdt -= monto; st.btc += btc; st.compras.push({ precio, btc, costo: monto, t: ahora });
        hechas.push({ t: ahora, tipo: "COMPRA", precio, btc, usdt: monto, comision: fee, motivo: baja ? `bajó ${+(Y * 100).toFixed(2)}% desde la venta (modo movimiento)` : `siguió subiendo ${cfg.movimientoSube ?? cfg.movimiento}% desde la venta (modo movimiento)` });
        st.movVenta = null;
      }
    } else if (st.compras.length && (indice <= miedo || !sube)) {
      for (const c of st.compras.slice()) {
        const bruto = c.btc * precio, fee = bruto * com, neto = bruto - fee, ganancia = neto - c.costo;
        st.usdt += neto; st.btc = Math.max(0, st.btc - c.btc); st.compras.splice(st.compras.indexOf(c), 1); st.ganado += ganancia;
        hechas.push({ t: ahora, tipo: "VENTA", compra: c.t, precio, btc: c.btc, usdt: neto, comision: fee, ganancia, motivo: indice <= miedo ? `el índice bajó a ${indice} (miedo ≤ ${miedo})` : `la EMA20 cayó abajo de la EMA50 (tendencia de bajada)` });
      }
    } else if (!st.compras.length && !st.movVenta && indice >= codicia && sube) {
      const monto = cfg.reinvertir ? Math.floor(st.usdt * 100) / 100 : Math.min(cfg.monto, st.usdt); // reinvertir: usa todo, ganancias incluidas
      if (monto >= Math.min(cfg.monto, 5)) {
        const fee = monto * com, btc = (monto - fee) / precio;
        st.usdt -= monto; st.btc += btc; st.compras.push({ precio, btc, costo: monto, t: ahora });
        hechas.push({ t: ahora, tipo: "COMPRA", precio, btc, usdt: monto, comision: fee, motivo: `índice en ${indice} (codicia ≥ ${codicia}) y EMA20 arriba de EMA50` });
      }
    }
    for (const h of hechas) st.trades.push(h);
    return hechas;
  }
  const ema = (P, n) => { const k = 2 / (n + 1); let e = P[0]; for (let i = 1; i < P.length; i++) e = P[i] * k + e * (1 - k); return e; };
  const nombre = v => v <= 24 ? "miedo extremo" : v <= 45 ? "miedo" : v <= 55 ? "neutral" : v <= 75 ? "codicia" : "codicia extrema";
  root.Sentimiento = { DEF, revisar, nombre, ema };
})(typeof self !== "undefined" ? self : globalThis);
