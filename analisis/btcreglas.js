// Reglas para Bitcoin: barrido de umbrales de miedo/codicia, par de EMAs y modo movimiento (datos diarios desde 2018).
// Resultado en USDT y en cantidad de BTC (vs guardar). Mismo motor que swing.js.
const fs = require("fs"), DIA = 864e5, FEE = 0.001;
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const m = process.argv[2] || "BTC";
const L = fs.readFileSync(`diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").map(Number)), P = L.map(c => c[4]);
const EM = {}; for (const n of [10, 20, 30, 50, 100, 200]) EM[n] = ema(P, n);
const per = [["2018-22", "2018-03-01", "2023-01-01"], ["2023-24", "2023-01-01", "2025-01-01"], ["2025-hoy", "2025-01-01", "2100-01-01"], ["últ.año", "2025-10-01", "2100-01-01"]];
function corre(cod, mie, ea, eb, X, Y, a, b) {
  const A = EM[ea], B = EM[eb]; let usd = 1, coin = 0, sen = false, ref = 0, fuera = false, ventaP = 0, ops = 0, p0 = 0, pf = 0, mx = 1, dd = 0;
  const comprar = (u, p) => { coin += u * (1 - FEE) / p; usd -= u; ops++; }, vender = (c, p) => { usd += c * p * (1 - FEE); coin -= c; ops++; };
  for (let i = 201; i < L.length; i++) { const t = L[i][0]; if (t < Date.parse(a) || t >= Date.parse(b)) continue; if (!p0) p0 = L[i][1]; pf = P[i];
    const fv = fg.get(Math.floor(L[i - 1][0] / DIA)); if (fv == null) continue; const sube = A[i - 1] > B[i - 1];
    const nuevo = sen ? (fv > mie && sube) : (fv >= cod && sube), o = L[i][1], h = L[i][2], lo = L[i][3];
    if (sen && !nuevo) { if (coin > 0) vender(coin, o); fuera = false; }
    else if (!sen && nuevo) { comprar(usd, o); ref = o; fuera = false; }
    else if (sen && X) {
      if (!fuera && h >= ref * (1 + X)) { const p = ref * (1 + X); vender(coin, p); fuera = true; ventaP = p; }
      else if (fuera && lo <= ventaP * (1 - Y)) { const p = ventaP * (1 - Y); comprar(usd, p); fuera = false; ref = p; }
      else if (fuera && h >= ventaP * (1 + X)) { const p = ventaP * (1 + X); comprar(usd, p); fuera = false; ref = p; } }
    sen = nuevo; const v = usd + coin * P[i]; mx = Math.max(mx, v); dd = Math.max(dd, 1 - v / mx); }
  const fin = usd + coin * pf; return { u: fin, c: fin / pf * p0, dd };
}
const pc = x => ((x - 1) * 100).toFixed(0);
const filas = [];
for (const cod of [45, 50, 55, 60, 65]) for (const mie of [20, 25, 30, 35]) for (const [ea, eb] of [[20, 50], [10, 30], [30, 100], [50, 200]]) for (const [X, Y] of [[0, 0], [0.03, 0.03], [0.05, 0.05], [0.08, 0.08]]) {
  if (mie >= cod) continue; const r = per.map(([, a, b]) => corre(cod, mie, ea, eb, X, Y, a, b));
  filas.push({ k: `${cod}/${mie} EMA${ea}/${eb} mov${X * 100}`, r, score: r.reduce((s, x) => s + Math.log(x.u), 0), peor: Math.min(...r.map(x => x.u)) }); }
const hold = per.map(([, a, b]) => { const i0 = L.findIndex(c => c[0] >= Date.parse(a)), i1 = L.findLastIndex(c => c[0] < Date.parse(b)); return P[i1] / L[i0][1]; });
console.log(m, "guardar:", per.map((p, i) => `${p[0]} ${pc(hold[i])}%`).join("  "));
const show = f => console.log(f.k.padEnd(26), f.r.map((x, i) => `${per[i][0]} ${pc(x.u)}% (${m} ${pc(x.c)}%) b${(x.dd * 100).toFixed(0)}`.padEnd(30)).join(""));
console.log("--- actual (55/25 EMA20/50 mov3) y sin mov:"); filas.filter(f => f.k === "55/25 EMA20/50 mov3" || f.k === "55/25 EMA20/50 mov0").forEach(show);
console.log("--- top 15 por suma de logs (todos los periodos):"); filas.sort((a, b) => b.score - a.score).slice(0, 15).forEach(show);
console.log("--- top 10 por peor periodo:"); filas.sort((a, b) => b.peor - a.peor).slice(0, 10).forEach(show);
