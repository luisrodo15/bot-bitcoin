// Portafolio en vivo: lee tu cuenta de Binance con la llave del servidor (llave.json) SOLO PARA LEER:
// saldos de todas las billeteras, precios y todos los movimientos. No compra, no vende, no transfiere, no retira.
// PnL igual que "PnL de hoy" de Binance (extensión Mi Bitcoin v1.8), extendido a mes y año:
//   PnL = Σ cantidad_ahora·(precio_ahora − precio_inicio) − Σ movimientos·(precio_del_movimiento − precio_inicio)
//         + ingresos (ganancias de futuros, comisiones, recompensas) valuados al inicio.
// Así cuenta lo que ganaron o perdieron tus monedas, sin contar como ganancia lo que depositas ni como pérdida lo que retiras.
// Los días son los de Binance (00:00 UTC = 6 pm de México). Los pesos se valúan al tipo de cambio de binance.com de ahora.
const fs = require("fs"), path = require("path");
const DAY = 864e5, M5 = 300e3;
const QUOTES = ["USDT", "USDC", "FDUSD", "MXN", "BTC", "BNB", "ETH"], SIEMPRE = ["BTC", "ETH", "BNB", "SOL", "USDC", "FDUSD"];
const DESDE = Date.UTC(2024, 0, 1); // desde cuándo se buscan movimientos
const DESDE_FIAT = Date.UTC(2025, 0, 1); // pesos: Binance deja ~2 consultas por minuto, por eso desde 2025
const FLUJOS = { dep: "depósitos cripto", ret: "retiros cripto", fiat: "depósitos y retiros de pesos", p2p: "P2P", conv: "Convertir" };
const sleep = ms => new Promise(ok => setTimeout(ok, ms));
const ventanas = (a, b, n) => { const w = []; for (let s = a; s < b; s += n) w.push([s, Math.min(s + n - 1, b)]); return w; };
const num = (x, d = 8) => (+(+x).toFixed(d)).toString();
const NOMBRE_TR = { MAIN_FUNDING: "Spot → Fondos", FUNDING_MAIN: "Fondos → Spot", MAIN_UMFUTURE: "Spot → Futuros", UMFUTURE_MAIN: "Futuros → Spot", FUNDING_UMFUTURE: "Fondos → Futuros", UMFUTURE_FUNDING: "Futuros → Fondos" };
const NOMBRE_W = { Spot: "Spot", Funding: "Fondos", "USDⓈ-M Futures": "Futuros USDⓈ-M", "COIN-M Futures": "Futuros COIN-M", Earn: "Earn", "Cross Margin": "Margen cruzado", "Isolated Margin": "Margen aislado", "Trading Bots": "Bots de trading", Copy: "Copy trading", Options: "Opciones" };

function crear({ dir, leerLlave, crearCliente, API, FAPI, WEB }) {
  const F = path.join(dir, "portafolio.json"), FP = path.join(dir, "portafolio-precios.json");
  const leer = (f, d) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return d; } };
  const guardar = (f, v) => { fs.writeFileSync(f + ".tmp", JSON.stringify(v)); fs.renameSync(f + ".tmp", f); };
  const S = Object.assign({ movs: {}, fills: {}, hecho: {}, cur: {} }, leer(F, {}));
  if (S.v !== 2) { delete S.hecho.fiat; S.v = 2; } // v2: pesos se vuelven a leer por ventanas de 90 días
  const PX = leer(FP, {}); let pxNuevo = false;
  const L = { tk: {}, ch: {}, rate: 0, rateT: 0, q: {}, by: {}, wallets: [], total: null, pos: [], avisos: {}, res: null, series: {}, serieT: 0, t: 0 };
  let cli = null, fcli = null, listo = false;

  async function conectar() {
    if (cli) return true;
    const k = leerLlave(); if (!k) { L.error = "Falta la llave de Binance en el servidor (poner-llave.sh)."; return false; }
    cli = crearCliente(API, k); fcli = crearCliente(FAPI, k);
    await cli.sincronizar(); try { await fcli.sincronizar("/fapi/v1/time"); } catch (e) {}
    return true;
  }
  const g = (ruta, p) => cli.llamar("GET", ruta, p);
  const ok = (id, e) => { if (e) L.avisos[id] = String(e.message || e).replace(/^Binance: /, ""); else delete L.avisos[id]; };

  // ---------- Precios ----------
  const sim = c => L.tk[c + "USDT"] ? { s: c + "USDT", inv: false } : L.tk["USDT" + c] ? { s: "USDT" + c, inv: true } : null;
  function pAhora(c) {
    if (c === "USDT") return 1; if (c === "MXN" && L.rate) return 1 / L.rate;
    const s = sim(c); if (s) return s.inv ? 1 / L.tk[s.s] : L.tk[s.s];
    if (L.tk[c + "BTC"] && L.tk.BTCUSDT) return L.tk[c + "BTC"] * L.tk.BTCUSDT;
    return null;
  }
  async function vela(s, iv, t) {
    const k = `${s}|${iv}|${t}`;
    if (PX[k] === undefined) {
      const r = await cli.llamar("GET", "/api/v3/klines", { symbol: s, interval: iv, startTime: t, limit: 1 }, false);
      const v = r[0] ? [+r[0][1], +r[0][4], r[0][0]] : null;
      if (iv !== "5m" || (v && r[0][6] < Date.now())) { PX[k] = v; pxNuevo = true; } else return v; // vela sin cerrar: no se guarda
    }
    return PX[k];
  }
  // precio al inicio de un día (apertura) o en el momento de un movimiento (vela de 5 minutos)
  async function pEn(c, t, inicio) {
    if (c === "USDT") return 1; if (c === "MXN" && L.rate) return 1 / L.rate;
    const s = sim(c); if (!s) return null;
    const b = inicio ? Math.floor(t / DAY) * DAY : Math.floor(t / M5) * M5;
    let k; try { k = await vela(s.s, inicio ? "1d" : "5m", b); } catch (e) { return null; }
    if (!k) return null; const v = inicio || t - k[2] < 150e3 ? k[0] : k[1];
    return s.inv ? 1 / v : v;
  }
  async function tipoMXN() {
    if (Date.now() - L.rateT < 5 * 60e3 && L.rate) return;
    try {
      const r = await fetch(WEB + "/bapi/asset/v1/public/asset-service/product/currency", { signal: AbortSignal.timeout(10000) }), j = await r.json();
      const it = (j.data || []).find(x => /^MXN(_|$)/.test(x.pair || x.symbol || "")); let v = it ? +it.rate : 0; if (v > 0 && v < 1) v = 1 / v;
      if (v > 1 && v < 100) { L.rate = v; L.rateT = Date.now(); L.rateDe = "binance.com"; return; }
    } catch (e) {}
    if (L.tk.USDTMXN) { L.rate = L.tk.USDTMXN; L.rateT = Date.now(); L.rateDe = "mercado USDT/MXN"; }
  }

  // ---------- Saldos de todas las billeteras ----------
  async function saldos() {
    const q = {}, by = {}, add = (c, x, w) => { x = +x; if (!x) return; q[c] = (q[c] || 0) + x; (by[c] = by[c] || {})[w] = (by[c][w] || 0) + x; };
    const acct = await g("/api/v3/account", { omitZeroBalances: "true" });
    let flex = false;
    try { const r = await g("/sapi/v1/simple-earn/flexible/position", { size: 100 }); (r.rows || []).forEach(x => add(x.asset, x.totalAmount, "Earn")); flex = true; ok("earn"); } catch (e) { ok("earn", e); }
    try { const r = await g("/sapi/v1/simple-earn/locked/position", { size: 100 }); (r.rows || []).forEach(x => add(x.asset, x.amount, "Earn")); } catch (e) {}
    try { const r = await cli.llamar("POST", "/sapi/v1/asset/get-funding-asset", {}); r.forEach(x => add(x.asset, +x.free + +x.locked + +x.freeze + +(x.withdrawing || 0), "Fondos")); ok("fondos"); } catch (e) { ok("fondos", e); }
    try {
      const r = await fcli.llamar("GET", "/fapi/v2/balance", {}); r.forEach(x => add(x.asset, x.balance, "Futuros"));
      const p = await fcli.llamar("GET", "/fapi/v2/positionRisk", {});
      L.pos = p.filter(x => +x.positionAmt).map(x => ({ s: x.symbol, q: +x.positionAmt, entrada: +x.entryPrice, marca: +x.markPrice, pnl: +x.unRealizedProfit, apal: +x.leverage }));
      ok("futuros");
    } catch (e) { ok("futuros", e); }
    for (const b of acct.balances || []) {
      const ld = /^LD[A-Z0-9]{2,}$/.test(b.asset) && b.asset !== "LDO"; if (ld && flex) continue; // Earn viejo, ya contado
      add(ld ? b.asset.slice(2) : b.asset, +b.free + +b.locked, "Spot");
    }
    L.q = q; L.by = by;
    try {
      const w = await g("/sapi/v1/asset/wallet/balance", { quoteAsset: "USDT" });
      L.wallets = w.filter(x => +x.balance > 0).map(x => ({ n: NOMBRE_W[x.walletName] || x.walletName, v: +x.balance }));
      L.total = w.reduce((a, x) => a + (+x.balance || 0), 0); ok("total");
    } catch (e) { ok("total", e); L.total = null; }
  }

  // ---------- Movimientos ----------
  // Cada movimiento: {id, t, cat, tx, legs:[[moneda, cambio]], k}. cat: dep | ret | tr | cv (compra/venta) | fut | otro.
  // k: ext = entra o sale de tu cuenta; int = cambio entre monedas dentro de la cuenta; ing = ingreso/costo; tr = sin cambio de saldo.
  let ultFiat = 0; const fiat = async (ruta, p) => { const w = ultFiat + 35e3 - Date.now(); if (w > 0) await sleep(w); ultFiat = Date.now(); return g(ruta, p); }; // Binance permite ~2 por minuto
  const M = [];
  const fuente = (id, cada, fn, max) => M.push({ id, cada, fn, max });
  fuente("dep", 60e3, async (a, b, out) => {
    for (const [s, e] of ventanas(a, b, 90 * DAY)) for (const x of await g("/sapi/v1/capital/deposit/hisrec", { startTime: s, endTime: e, limit: 1000 }))
      if (x.status === 1 || x.status === 6) out.push({ id: "d" + (x.id || x.txId), t: x.insertTime, cat: "dep", tx: `Depósito de ${x.coin}${x.network ? " · red " + x.network : ""}`, legs: [[x.coin, +x.amount]], k: "ext" });
  });
  fuente("ret", 60e3, async (a, b, out) => {
    for (const [s, e] of ventanas(a, b, 90 * DAY)) for (const x of await g("/sapi/v1/capital/withdraw/history", { startTime: s, endTime: e, limit: 1000 }))
      if (![1, 3, 5].includes(+x.status)) out.push({ id: "w" + x.id, t: Date.parse(String(x.applyTime).replace(" ", "T") + "Z"), cat: "ret", tx: `Retiro de ${x.coin}${x.network ? " · red " + x.network : ""}${+x.transactionFee ? ` · comisión ${num(x.transactionFee)} ${x.coin}` : ""}${+x.status === 6 ? "" : " · en proceso"}`, legs: [[x.coin, -(+x.amount + +(x.transactionFee || 0))]], k: "ext" });
  });
  fuente("conv", 60e3, async (a, b, out) => {
    for (const [s, e] of ventanas(a, b, 30 * DAY)) for (const o of (await g("/sapi/v1/convert/tradeFlow", { startTime: s, endTime: e, limit: 1000 })).list || [])
      if (o.orderStatus === "SUCCESS") out.push({ id: "v" + o.orderId, t: o.createTime, cat: "cv", tx: `Convertir ${num(o.fromAmount)} ${o.fromAsset} → ${num(o.toAmount)} ${o.toAsset}`, legs: [[o.fromAsset, -o.fromAmount], [o.toAsset, +o.toAmount]], k: "int" });
  });
  fuente("p2p", 15 * 60e3, async (a, b, out) => {
    for (const side of ["BUY", "SELL"]) for (const [s, e] of ventanas(a, b, 30 * DAY)) for (const o of (await g("/sapi/v1/c2c/orderMatch/listUserOrderHistory", { tradeType: side, startTimestamp: s, endTimestamp: e, rows: 100 })).data || [])
      if (o.orderStatus === "COMPLETED") out.push({ id: "p" + o.orderNumber, t: o.createTime, cat: "cv", tx: `P2P ${side === "BUY" ? "compra" : "venta"} · ${num(o.totalPrice, 2)} ${o.fiat}`, legs: [[o.asset, (side === "BUY" ? 1 : -1) * o.amount]], k: "ext" });
  });
  fuente("fiat", 15 * 60e3, async (a, b, out) => {
    for (const [s, e] of ventanas(Math.max(a, DESDE_FIAT), b, 90 * DAY)) for (const t of [0, 1]) for (const o of (await fiat("/sapi/v1/fiat/orders", { transactionType: t, beginTime: s, endTime: e, rows: 500 })).data || [])
      if (/success/i.test(o.status)) out.push({ id: "f" + o.orderNo, t: o.createTime, cat: t ? "ret" : "dep", tx: `${t ? "Retiro" : "Depósito"} de ${o.fiatCurrency}${o.method ? " · " + o.method : ""}${+o.totalFee ? ` · comisión ${num(o.totalFee, 2)}` : ""}`, legs: [[o.fiatCurrency, (t ? -1 : 1) * o.amount]], k: "ext" });
    for (const [s, e] of ventanas(Math.max(a, DESDE_FIAT), b, 90 * DAY)) for (const t of [0, 1]) for (const o of (await fiat("/sapi/v1/fiat/payments", { transactionType: t, beginTime: s, endTime: e, rows: 500 })).data || []) {
      if (!/complet|success/i.test(o.status)) continue;
      const saldo = /balance|wallet|cash|saldo/i.test(o.paymentMethod || ""), sg = t ? -1 : 1;
      out.push({ id: "c" + o.orderNo, t: o.createTime, cat: "cv", tx: `${t ? "Venta" : "Compra"} de ${o.cryptoCurrency} · ${num(o.sourceAmount, 2)} ${o.fiatCurrency}${o.paymentMethod ? " · " + o.paymentMethod : ""}`,
        legs: saldo ? [[o.cryptoCurrency, sg * o.obtainAmount], [o.fiatCurrency, -sg * o.sourceAmount]] : [[o.cryptoCurrency, sg * o.obtainAmount]], k: saldo ? "int" : "ext" });
    }
  });
  fuente("div", 15 * 60e3, async (a, b, out) => {
    for (const [s, e] of ventanas(a, b, 90 * DAY)) for (const o of (await g("/sapi/v1/asset/assetDividend", { startTime: s, endTime: e, limit: 500 })).rows || [])
      out.push({ id: "r" + o.id, t: o.divTime, cat: "otro", tx: `Recompensa · ${o.enInfo || "Binance"}`, legs: [[o.asset, +o.amount]], k: "ing" });
  });
  fuente("polvo", 15 * 60e3, async (a, b, out) => {
    for (const o of (await g("/sapi/v1/asset/dribblet", { startTime: Math.max(a, Date.now() - 99 * DAY), endTime: b })).userAssetDribblets || [])
      out.push({ id: "z" + o.transId, t: o.operateTime, cat: "cv", tx: "Convertir saldos pequeños a BNB", legs: [...(o.userAssetDribbletDetails || []).map(x => [x.fromAsset, -x.amount]), ["BNB", +o.totalTransferedAmount]], k: "int" });
  });
  fuente("tr", 120e3, async (a, b, out) => {
    for (const ty of Object.keys(NOMBRE_TR)) for (const [s, e] of ventanas(a, b, 30 * DAY)) for (const o of (await g("/sapi/v1/asset/transfer", { type: ty, startTime: s, endTime: e, size: 100 })).rows || [])
      if (o.status === "CONFIRMED") out.push({ id: "u" + o.tranId, t: o.timestamp, cat: "tr", tx: `Transferencia ${NOMBRE_TR[ty]} · ${num(o.amount)} ${o.asset}`, legs: [], k: "tr" });
    S.univ = true;
  }, 180 * DAY);
  fuente("fing", 60e3, async (a, b, out) => {
    const T = { REALIZED_PNL: "Futuros · ganancia/pérdida cerrada", COMMISSION: "Futuros · comisión", FUNDING_FEE: "Futuros · funding", INSURANCE_CLEAR: "Futuros · liquidación" };
    for (const [s, e] of ventanas(a, b, 7 * DAY)) for (const x of await fcli.llamar("GET", "/fapi/v1/income", { startTime: s, endTime: e, limit: 1000 })) {
      const id = `i${x.tranId}${x.incomeType}${x.symbol || ""}${x.time}`;
      if (x.incomeType === "TRANSFER") out.push({ id: "iT" + id, t: x.time, cat: "tr", tx: `Transferencia ${+x.income > 0 ? "a Futuros" : "desde Futuros"} · ${num(Math.abs(x.income))} ${x.asset}`, legs: [], k: "tr" });
      else if (+x.income) out.push({ id, t: x.time, cat: "fut", tx: `${T[x.incomeType] || "Futuros · " + x.incomeType}${x.symbol ? " " + x.symbol : ""}`, legs: [[x.asset, +x.income]], k: "ing", s: x.symbol });
    }
  }, 180 * DAY);
  fuente("ftrades", 120e3, async (a, b, out) => {
    const ss = new Set(Object.values(S.movs).filter(m => m.s).map(m => m.s)), g2 = {};
    for (const s of ss) for (const [x, e] of ventanas(Math.max(a, Date.now() - 179 * DAY), b, 7 * DAY)) for (const f of await fcli.llamar("GET", "/fapi/v1/userTrades", { symbol: s, startTime: x, endTime: e, limit: 1000 })) {
      const o = g2[s + f.orderId] || (g2[s + f.orderId] = { s, side: f.side, t: f.time, q: 0, v: 0, id: f.orderId }); o.q += +f.qty; o.v += +f.quoteQty;
    }
    for (const o of Object.values(g2)) out.push({ id: "ft" + o.s + o.id, t: o.t, cat: "fut", tx: `Futuros ${o.s} · ${o.side === "BUY" ? "compra" : "venta"} ${num(o.q)} a ${num(o.v / o.q, 2)}`, legs: [], k: "tr" });
  }, 180 * DAY);
  // Compras y ventas en Spot: cada par donde tengas o hayas movido alguna de sus monedas (se leen desde la primera operación).
  async function spot() {
    const cs = new Set([...Object.keys(L.q), ...SIEMPRE]); Object.values(S.movs).forEach(m => m.legs.forEach(([c]) => cs.add(c)));
    let mal = null;
    for (const b of cs) for (const q of QUOTES) {
      const s = b + q; if (b === q || L.tk[s] == null) continue;
      try {
        for (let i = 0; i < 20; i++) {
          const r = await g("/api/v3/myTrades", { symbol: s, fromId: (S.cur[s] ?? -1) + 1, limit: 1000 });
          r.forEach(f => { S.fills[s + "|" + f.id] = [s, b, q, f.orderId, f.time, f.isBuyer ? 1 : 0, +f.qty, +f.quoteQty, +f.commission, f.commissionAsset]; S.cur[s] = Math.max(S.cur[s] ?? -1, f.id); });
          if (r.length < 1000) break;
        }
      } catch (e) { mal = e; }
    }
    const o = {};
    for (const [s, b, q, oid, t, buy, qty, qq, com, ca] of Object.values(S.fills)) {
      const m = o[s + oid] || (o[s + oid] = { id: "t" + s + oid, t, cat: "cv", b, q, buy, qty: 0, qq: 0, com: {}, k: "int" });
      m.qty += qty; m.qq += qq; if (com) m.com[ca] = (m.com[ca] || 0) + com;
    }
    for (const m of Object.values(o)) {
      const sg = m.buy ? 1 : -1, legs = [[m.b, sg * m.qty], [m.q, -sg * m.qq]]; Object.entries(m.com).forEach(([c, x]) => legs.push([c, -x]));
      S.movs[m.id] = { id: m.id, t: m.t, cat: "cv", k: "int", legs, tx: `${m.buy ? "Compra" : "Venta"} de ${num(m.qty)} ${m.b} a ${num(m.qq / m.qty, m.qq / m.qty >= 1 ? 2 : 8)} ${m.q} · Spot` };
    }
    ok("spot", mal);
  }

  const falla = {};
  async function movimientos() {
    let cambio = false;
    for (const f of M) {
      const h = S.hecho[f.id]; if (h && Date.now() - h < f.cada || (falla[f.id] || 0) > Date.now()) continue;
      const fin = Date.now(); let ini = h ? Math.max(DESDE, h - 3 * DAY) : DESDE; if (f.max) ini = Math.max(ini, fin - f.max);
      const out = [];
      try { await f.fn(ini, fin, out); out.forEach(m => S.movs[m.id] = m); S.hecho[f.id] = fin; ok(f.id); cambio = true; }
      catch (e) { ok(f.id, e); falla[f.id] = Date.now() + 10 * 60e3; } // si falla (por ejemplo sin permiso), reintenta en 10 minutos
    }
    if (!S.spotT || Date.now() - S.spotT > 90e3) { await spot(); S.spotT = Date.now(); cambio = true; }
    if (S.univ) for (const id in S.movs) if (id.startsWith("iT")) delete S.movs[id]; // ya están en Transferencias
    for (const m of Object.values(S.movs)) if (m.usd == null) { // valor en dólares en ese momento
      let v = 0, falta = false; for (const [c, d] of m.legs) { if (m.k === "int" && d < 0) continue; const p = await pEn(c, m.t, false); if (p == null) falta = true; else v += Math.abs(d) * p; }
      if (!falta || v) m.usd = v; cambio = true;
    }
    if (cambio) guardar(F, S);
    if (pxNuevo) { guardar(FP, PX); pxNuevo = false; }
    listo = M.every(f => S.hecho[f.id] || falla[f.id]) && !!S.spotT;
  }

  // ---------- PnL de un periodo ----------
  async function pnl(ini) {
    const movs = Object.values(S.movs).filter(m => m.t >= ini && m.k !== "tr");
    const o = {}, open = async c => (c in o ? o[c] : (o[c] = await pEn(c, ini, true))), sin = new Set();
    let vNow = 0, p = 0, inn = 0, out = 0;
    for (const [c, q] of Object.entries(L.q)) { const pn = pAhora(c), po = await open(c); if (pn == null || po == null) { if (q > 0) sin.add(c); continue; } vNow += q * pn; p += q * (pn - po); }
    for (const m of movs) for (const [c, d] of m.legs) {
      const po = await open(c); if (po == null) { sin.add(c); continue; }
      if (m.k === "ing") { p += d * po; continue; }
      const pm = await pEn(c, m.t, false); if (pm == null) { sin.add(c); continue; }
      p -= d * (pm - po); if (m.k === "ext") { if (d > 0) inn += d * pm; else out -= d * pm; }
    }
    const base = vNow - p + out, falta = Object.keys(FLUJOS).filter(k => !S.hecho[k] || L.avisos[k]).map(k => FLUJOS[k]);
    return { v: p, pct: base > 0 ? p / base * 100 : 0, desde: ini, entro: inn, salio: out, sin: [...sin], falta };
  }
  // Valor de la cuenta en el tiempo: cantidad que tenías en cada momento × precio de ese momento.
  async function serie(ini, iv, ms) {
    const legs = Object.values(S.movs).filter(m => m.t >= ini && m.k !== "tr").flatMap(m => m.legs.map(([c, d]) => [c, d, m.t]));
    const ahora = Date.now(), T = []; for (let t = ini + ms; t < ahora; t += ms) T.push(t); T.push(ahora);
    const v = T.map(() => 0), cs = new Set([...Object.keys(L.q), ...legs.map(x => x[0])]);
    for (const c of cs) {
      const qn = L.q[c] || 0, mis = legs.filter(x => x[0] === c);
      if (!qn && !mis.length) continue;
      let pr = null; const s = sim(c);
      if (c === "USDT") pr = T.map(() => 1); else if (c === "MXN" && L.rate) pr = T.map(() => 1 / L.rate);
      else if (s) try {
        const k = await cli.llamar("GET", "/api/v3/klines", { symbol: s.s, interval: iv, startTime: ini, limit: 1000 }, false), m = new Map(k.map(x => [x[0] + ms, +x[4]]));
        let u = null; pr = T.map(t => { const x = m.get(t); if (x != null) u = x; return u == null ? null : s.inv ? 1 / u : u; });
        const pn = pAhora(c); if (pn != null) pr[pr.length - 1] = pn;
      } catch (e) {}
      if (!pr) continue;
      T.forEach((t, i) => { if (pr[i] == null) return; let q = qn; for (const [, d, tm] of mis) if (tm > t) q -= d; v[i] += q * pr[i]; });
    }
    return T.map((t, i) => [t, +v[i].toFixed(4)]);
  }

  // ---------- Ciclos ----------
  let ocupado = false;
  async function ciclo() {
    if (ocupado) return; ocupado = true;
    try {
      if (!(await conectar())) return;
      const tk = await cli.llamar("GET", "/api/v3/ticker/price", {}, false); tk.forEach(x => L.tk[x.symbol] = +x.price);
      await tipoMXN(); await saldos();
      const syms = Object.keys(L.q).map(sim).filter(Boolean).map(s => s.s);
      if (syms.length) try { (await cli.llamar("GET", "/api/v3/ticker/24hr", { symbols: JSON.stringify(syms), type: "MINI" }, false)).forEach(x => L.ch[x.symbol] = +x.openPrice ? (+x.lastPrice / +x.openPrice - 1) * 100 : 0); } catch (e) {}
      const now = new Date(), hoy = Math.floor(Date.now() / DAY) * DAY, mes = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1), ano = Date.UTC(now.getUTCFullYear(), 0, 1);
      L.res = { hoy: await pnl(hoy), mes: await pnl(mes), ano: await pnl(ano) };
      if (Date.now() - L.serieT > 120e3) { L.series = { hoy: await serie(hoy, "15m", 900e3), mes: await serie(mes, "4h", 4 * 3600e3), ano: await serie(ano, "1d", DAY) }; L.serieT = Date.now(); }
      L.t = Date.now(); L.error = null;
    } catch (e) { L.error = String(e.message || e); console.error(new Date().toISOString(), "Portafolio:", L.error); }
    finally { ocupado = false; }
  }
  let movOcupado = false;
  async function cicloMov() { if (movOcupado || !cli || !Object.keys(L.tk).length) return; movOcupado = true; try { await movimientos(); } catch (e) { console.error("Portafolio movimientos:", e.message); } finally { movOcupado = false; } }

  // Precio del USDC en pesos en vivo, como en Convertir: cotización de 1,000 MXN -> USDC (solo pide precio, no la acepta: no compra nada).
  let cotT = 0;
  async function cotizar() {
    if (!cli || Date.now() - cotT < 60e3) return; cotT = Date.now();
    try { const q = await cli.llamar("POST", "/sapi/v1/convert/getQuote", { fromAsset: "MXN", toAsset: "USDC", fromAmount: "1000", walletType: "SPOT" });
      if (+q.toAmount > 0) { L.usdcMxn = 1000 / +q.toAmount; L.usdcDe = "Convertir"; L.usdcT = Date.now(); return; } } catch (e) {}
    if (L.tk.USDTMXN && L.tk.USDCUSDT) { L.usdcMxn = L.tk.USDTMXN * L.tk.USDCUSDT; L.usdcDe = "mercado"; L.usdcT = Date.now(); }
  }
  function datos() {
    cotizar();
    const vs = Object.entries(L.q).map(([c, q]) => { const p = pAhora(c), s = sim(c); return { c, q, p, v: p == null ? null : q * p, ch: s && L.ch[s.s] != null ? (s.inv ? -L.ch[s.s] : L.ch[s.s]) : null, by: L.by[c] }; })
      .filter(x => Math.abs(x.q) > 1e-12).sort((a, b) => (b.v || 0) - (a.v || 0));
    const movs = Object.values(S.movs).sort((a, b) => b.t - a.t).map(({ id, t, cat, tx, legs, usd, k }) => ({ id, t, cat, tx, legs, usd, k }));
    const avisos = Object.entries(L.avisos).map(([k, v]) => `${{ dep: "Depósitos", ret: "Retiros", conv: "Convertir", p2p: "P2P", fiat: "Pesos (depósitos/retiros/compras con tarjeta)", div: "Recompensas", polvo: "Saldos pequeños", tr: "Transferencias entre billeteras", fing: "Futuros (ganancias y comisiones)", ftrades: "Futuros (operaciones)", spot: "Compras/ventas Spot", earn: "Earn", fondos: "Billetera Fondos", futuros: "Billetera Futuros", total: "Valor total" }[k] || k}: ${v}`);
    return { t: L.t, error: L.error, usdcMxn: L.usdcMxn, usdcDe: L.usdcDe, rate: L.rate, rateDe: L.rateDe, total: L.total, wallets: L.wallets, monedas: vs, pos: L.pos, pnl: L.res, series: L.series, movs, avisos, listo };
  }

  ciclo(); setInterval(ciclo, +process.env.PORT_MS || 20000);
  setInterval(cicloMov, 30000); setTimeout(cicloMov, 3000);
  return { datos };
}

module.exports = { crear };
