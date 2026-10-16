// Estrategia intradía (de ChatGPT, pedida por el usuario 2026-10-16): tendencia 1H (precio>EMA50 y EMA20>EMA50),
// gatillo 15M (envolvente o pin bar alcista cerca del soporte 1H + RSI saliendo de sobreventa), precio sobre VWAP del día
// (sin volumen en los datos: promedio del precio típico del día). Solo compras (spot). Stop = soporte - 1 ATR(14) 1H,
// TP = R veces el riesgo, salida si en 4 velas de 15M no va a favor, máximo 3 operaciones al día, paro diario -15% / meta.
// Comisión 0.075% por lado. Todo el capital en cada operación (con 9 USDT la fórmula de 5% pide más de lo que hay).
const fs = require("fs"), zlib = require("zlib"), FEE = 0.00075, DIA = 864e5;
const M = zlib.gunzipSync(fs.readFileSync("datos/BTCUSDT.csv.gz")).toString().trim().split("\n").map(l => l.split(",").map(Number));
const agrupa = ms => { const o = []; for (const [t, op, h, l, c] of M) { const k = Math.floor(t / ms) * ms, u = o[o.length - 1]; if (u && u.t === k) { u.h = Math.max(u.h, h); u.l = Math.min(u.l, l); u.c = c; } else o.push({ t: k, o: op, h, l, c }); } return o; };
const H = agrupa(36e5), Q = agrupa(9e5);
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const rsi = (A, n = 14) => { const o = [50]; let g = 0, p = 0; for (let i = 1; i < A.length; i++) { const d = A[i] - A[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; p = (p * (n - 1) + Math.max(-d, 0)) / n; o.push(p ? 100 - 100 / (1 + g / p) : 100); } return o; };
const HC = H.map(x => x.c), E20 = ema(HC, 20), E50 = ema(HC, 50);
const ATR = []; H.forEach((x, i) => { const tr = i ? Math.max(x.h - x.l, Math.abs(x.h - H[i - 1].c), Math.abs(x.l - H[i - 1].c)) : x.h - x.l; ATR.push(i ? (ATR[i - 1] * 13 + tr) / 14 : tr); });
const hIdx = new Map(H.map((x, i) => [x.t, i])), R15 = rsi(Q.map(x => x.c));
const vw = []; { let d = -1, s = 0, n = 0; for (const x of Q) { const dd = Math.floor(x.t / DIA); if (dd !== d) { d = dd; s = 0; n = 0; } s += (x.h + x.l + x.c) / 3; n++; vw.push(s / n); } }
function corre({ suelta = false, patron = true, slATR = 1, R = 1, rsiS = 35, zona = 0.004, maxDia = 3, meta = 0.08, paro = 0.15, velas = 4, desde = 0, hasta = Infinity }) {
  let cap = 1, ops = 0, gan = 0, dia = -1, nDia = 0, capDia = 1, parado = false, pos = null, b0 = 0, pf = 0;
  for (let i = 60; i < Q.length; i++) { const q = Q[i]; if (q.t < desde || q.t >= hasta) continue; if (!b0) b0 = 1 / q.o; pf = q.c;
    const d = Math.floor(q.t / DIA); if (d !== dia) { dia = d; nDia = 0; capDia = cap; parado = false; }
    if (pos) { // salida dentro de la vela (stop primero si toca ambos)
      let sale = null; if (q.l <= pos.sl) sale = pos.sl; else if (q.h >= pos.tp) sale = pos.tp; else if (++pos.n >= velas && q.c <= pos.e) sale = q.c;
      if (sale) { const r = cap * (1 - FEE) * sale / pos.e * (1 - FEE); if (r > cap) gan++; cap = r; pos = null; ops++;
        if (cap >= capDia * (1 + meta) || cap <= capDia * (1 - paro)) parado = true; }
      continue; }
    if (parado || nDia >= maxDia) continue;
    const hi = hIdx.get(Math.floor(q.t / 36e5) * 36e5 - 36e5); if (hi == null || hi < 50) continue; // última vela 1H cerrada
    if (!(HC[hi] > E50[hi] && E20[hi] > E50[hi])) continue;
    let sop = Infinity; for (let j = hi - 23; j <= hi; j++) sop = Math.min(sop, H[j].l);
    const p = Q[i - 1], cuerpo = Math.abs(q.c - q.o), rango = q.h - q.l || 1e-9;
    const envolvente = q.c > q.o && p.c < p.o && q.c >= p.o && q.o <= p.c, pin = Math.min(q.o, q.c) - q.l >= 2 * cuerpo && (q.h - Math.max(q.o, q.c)) <= rango * 0.25;
    if (patron && !(envolvente || pin)) continue;
    if (!suelta && q.l > sop * (1 + zona)) continue; // en zona de soporte
    if (!(R15[i - 1] < rsiS + 5 && R15[i] > R15[i - 1] && Math.min(R15[i - 1], R15[i - 2]) < rsiS)) continue; // saliendo de sobreventa
    if (q.c < vw[i]) continue;
    if (i + 1 >= Q.length) break; const e = Q[i + 1].o, sl = suelta ? e - slATR * ATR[hi] : sop - ATR[hi]; if (sl >= e) continue;
    pos = { e, sl, tp: e + R * (e - sl), n: 0 }; nDia++; }
  if (pos) cap = cap * (1 - FEE) * pf / pos.e * (1 - FEE);
  return { usd: cap - 1, btc: cap / pf / b0 - 1, ops, gan };
}
const ini = Q[0].t, fin = Q[Q.length - 1].t + 9e5, mit = ini + (fin - ini) / 2, pc = x => (x * 100).toFixed(1) + "%";
const fila = (n, o) => { const r = [[0, Infinity], [0, mit], [mit, Infinity]].map(([desde, hasta]) => corre({ ...o, desde, hasta }));
  console.log(n.padEnd(34), r.map(x => `USD ${pc(x.usd)} BTC ${pc(x.btc)} ${x.ops}op ${x.ops ? (x.gan / x.ops * 100).toFixed(0) : 0}%gan`.padEnd(40)).join("")); };
console.log("año / 1a mitad / 2a mitad · comprar y guardar BTC: USD", pc(Q[Q.length - 1].c / Q[0].o - 1));
fila("tal cual", {});
console.log("--- versión suelta (sin zona de soporte: compra en retrocesos de la tendencia, stop = entrada - ATR) ---");
for (const rsiS of [35, 40, 45, 50]) for (const patron of [true, false]) fila(`rsi ${rsiS} ${patron ? "con vela" : "sin vela"}`, { suelta: true, rsiS, patron });
for (const R of [0.5, 1.5, 2]) fila(`rsi 45 sin vela R ${R}`, { suelta: true, rsiS: 45, patron: false, R });
for (const slATR of [0.5, 2]) fila(`rsi 45 sin vela stop ${slATR}ATR`, { suelta: true, rsiS: 45, patron: false, slATR });
fila("rsi 45 sin vela sin salida por tiempo", { suelta: true, rsiS: 45, patron: false, velas: 1e9 });
