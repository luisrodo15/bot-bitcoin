// La estrategia viva de Futuros ETH (largo > SMA N, corto en bajada fuerte, stop ~4.3%, posición fija ~22 USDT) en otras monedas.
const fs = require("fs"), FEE = 0.0005, FUND = 0.0001, ST = 0.043, NOC = 22; // USDT por entrada (pérdida máx ~1)
const per = [[2018,1,2019,7],[2019,7,2021,7],[2021,7,2023,7],[2023,7,2025,7],[2025,7,2027,1]].map(([x,a,y,b])=>[Date.UTC(x,a-1,1),Date.UTC(y,b-1,1)]);
const sma = (a, n) => { const o = []; let s = 0; a.forEach((c, j) => { s += c; if (j >= n) s -= a[j - n]; o.push(j >= n - 1 ? s / n : null); }); return o; };
function corre(C, N, a, b) {
  const cl = C.map(c => c[4]), mN = sma(cl, N), m20 = sma(cl, 20), m200 = sma(cl, 200); const tr = [];
  let pos = 0, ent = 0, bloq = 0, ult = 0;
  for (let i = 201; i < C.length; i++) { const [t, o, h, l, c] = C[i]; if (t < a || t >= b) continue; ult = c; const j = i - 1, x = cl[j];
    let sig = x > mN[j] ? 1 : (x < m20[j] && m20[j] < m20[j - 5] && x < m200[j] ? -1 : 0);
    if (bloq && sig === bloq) sig = 0; else if (sig !== bloq) bloq = 0;
    if (sig !== pos) { if (pos) tr.push(pos * (o / ent - 1) - 2 * FEE); pos = sig; if (pos) ent = o; }
    if (pos) { tr.push(-FUND * pos); const peor = pos > 0 ? l / ent - 1 : 1 - h / ent; if (peor <= -ST) { tr.push(-ST - 2 * FEE); bloq = pos; pos = 0; } } }
  if (pos) tr.push(pos * (ult / ent - 1));
  return tr.reduce((a, x) => a + x, 0) * NOC; // USDT ganados con posición fija
}
console.log("USDT ganados con posición fija de 22 USDT (pérdida máx ~1 por entrada). Periodos: 2018-19 | 19-21 | 21-23 | 23-25 | 25-hoy");
const yh = n => { const r = JSON.parse(fs.readFileSync(__dirname + "/diarios/yahoo-" + n + ".json")).chart.result[0], q = r.indicators.quote[0]; return r.timestamp.map((t, i) => [t * 1e3, q.open[i], q.high[i], q.low[i], q.close[i]]).filter(x => x[4] > 0); };
for (const m of (process.env.MON || "ETH BTC BNB SOL XRP DOGE ADA").split(" ")) {
  const C = /^(GSPC|IXIC)$/.test(m) ? yh(m) : fs.readFileSync(__dirname + `/diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").slice(0, 5).map(Number));
  for (const N of [30, 45, 60]) { const r = per.map(([a, b]) => corre(C, N, a, b)), tot = r.reduce((a, x) => a + x, 0);
    console.log(`${m} SMA${N}`.padEnd(11), r.map(x => x.toFixed(1).padStart(7)).join(""), ` total ${tot.toFixed(1)}`, r.every(x => x >= 0) ? "" : " (pierde algún periodo)"); } }
