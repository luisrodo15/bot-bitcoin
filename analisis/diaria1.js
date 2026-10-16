// "Una operación cada día" (usuario 2026-10-16): cada día UTC compra (al abrir, o si baja -Y% desde la apertura)
// y vende al +X% o al cierre del día. Con o sin filtro de tendencia del bot (miedo/codicia y EMA20/50). Comisión 0.075% por lado.
const fs = require("fs"), zlib = require("zlib"), FEE = 0.00075, DIA = 864e5;
const M = zlib.gunzipSync(fs.readFileSync("datos/BTCUSDT.csv.gz")).toString().trim().split("\n").map(l => l.split(",").map(Number));
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const D = fs.readFileSync("diarios/BTCUSDT-1d.csv", "utf8").trim().split("\n").map(l => l.split(",").map(Number));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const PD = D.map(c => c[4]), E20 = ema(PD, 20), E50 = ema(PD, 50), idx = new Map(D.map((c, i) => [c[0], i]));
const dias = new Map(); for (const r of M) { const d = Math.floor(r[0] / DIA) * DIA; (dias.get(d) || dias.set(d, []).get(d)).push(r); }
const K = [...dias.keys()].sort((a, b) => a - b);
function corre(X, Y, filtro, a, b) { let cap = 1, ops = 0, gan = 0, dd = 0, n = 0, b0 = 0, pf = 0, pico = 1, peor = 0;
  for (const d of K) { if (d < a || d >= b) continue; const R = dias.get(d); if (!b0) b0 = 1 / R[0][1]; pf = R[R.length - 1][4]; n++;
    if (filtro) { const i = idx.get(d - DIA), f = fg.get(Math.floor((d - DIA) / DIA)); if (i == null || !(E20[i] > E50[i] && f >= 40)) continue; }
    const ab = R[0][1], ent = ab * (1 - Y); let e = 0, s = 0;
    for (const [, o, h, l, c] of R) { if (!e) { if (l <= ent) e = Math.min(o, ent); else continue; }
      if (h >= e * (1 + X)) { s = e * (1 + X); break; } }
    if (!e) continue; if (!s) s = R[R.length - 1][4];
    const r = (1 - FEE) * s / e * (1 - FEE); cap *= r; ops++; if (r > 1) gan++; pico = Math.max(pico, cap); peor = Math.min(peor, cap / pico - 1); }
  return { usd: cap - 1, btc: cap / pf / b0 - 1, ops, gan, n, peor }; }
const ini = K[0], fin = K[K.length - 1] + DIA, mit = ini + (fin - ini) / 2, pc = x => (x * 100).toFixed(1) + "%";
console.log("año | 1a mitad | 2a mitad  (BTC bajó", pc(M[M.length - 1][4] / M[0][1] - 1), "en el año)");
for (const filtro of [false, true]) for (const Y of [0, 0.005, 0.01]) for (const X of [0.003, 0.005, 0.01, 0.02]) {
  const r = [[ini, fin], [ini, mit], [mit, fin]].map(([a, b]) => corre(X, Y, filtro, a, b));
  console.log(`${filtro ? "con filtro" : "todos los días"} compra -${Y * 100}% vende +${X * 100}%`.padEnd(42), r.map(x => `USD ${pc(x.usd)} ${x.ops}/${x.n}días ${(x.gan / (x.ops || 1) * 100).toFixed(0)}%gan peor${pc(x.peor)}`.padEnd(44)).join("")); }
