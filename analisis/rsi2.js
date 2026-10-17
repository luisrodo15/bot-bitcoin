// Estrategia distinta para acciones: "comprar la caída" (RSI de 2 días, Connors). Compra al cierre... (aquí: apertura siguiente) cuando
// RSI2 < U y el cierre está arriba de su SMA200; vende cuando cierra arriba de su SMA5. Stop 4.3% (pérdida máx ~1 USDT con 22 USDT).
const fs = require("fs"), FEE = 0.0005, FUND = 0.0001, ST = +(process.env.ST || 0.043), NOC = 22;
const per = [[2018,1,2019,7],[2019,7,2021,7],[2021,7,2023,7],[2023,7,2025,7],[2025,7,2027,1]].map(([x,a,y,b])=>[Date.UTC(x,a-1,1),Date.UTC(y,b-1,1)]);
const sma = (a, n) => { const o = []; let s = 0; a.forEach((c, j) => { s += c; if (j >= n) s -= a[j - n]; o.push(j >= n - 1 ? s / n : null); }); return o; };
const yh = n => { const r = JSON.parse(fs.readFileSync(__dirname + "/diarios/yahoo-" + n + ".json")).chart.result[0], q = r.indicators.quote[0]; return r.timestamp.map((t, i) => [t * 1e3, q.open[i], q.high[i], q.low[i], q.close[i]]).filter(x => x[4] > 0 && x[1] > 0); };
const csv = m => fs.readFileSync(__dirname + `/diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").slice(0, 5).map(Number));
function corre(C, U, a, b) {
  const cl = C.map(c => c[4]), m200 = sma(cl, 200), m5 = sma(cl, 5); let ag = 0, ap = 0; const rsi = cl.map((c, i) => { if (!i) return 50; const d = c - cl[i - 1]; ag = (ag + Math.max(d, 0)) / 2; ap = (ap + Math.max(-d, 0)) / 2; return ap ? 100 - 100 / (1 + ag / ap) : 100; });
  let pos = 0, ent = 0, g = 0, n = 0;
  for (let i = 201; i < C.length; i++) { const [t, o, h, l, c] = C[i]; if (t < a || t >= b) continue; const j = i - 1;
    if (!pos && rsi[j] < U && cl[j] > m200[j]) { pos = 1; ent = o; n++; }
    else if (pos && cl[j] > m5[j]) { g += o / ent - 1 - 2 * FEE; pos = 0; }
    if (pos) { g -= FUND * 3; if (l / ent - 1 <= -ST) { g += -ST - 2 * FEE; pos = 0; } } }
  return { g: g * NOC, n };
}
console.log("Comprar la caída (RSI2). USDT con 22 USDT por entrada. Periodos: 2018-19 | 19-21 | 21-23 | 23-25 | 25-hoy");
for (const m of (process.env.MON || "QQQ SPY NVDA AAPL MSFT META GOOGL AMZN TSLA ETH BTC").split(" ")) { const C = /^(ETH|BTC)$/.test(m) ? csv(m) : yh(m);
  for (const U of [5, 10, 20]) { const r = per.map(([a, b]) => corre(C, U, a, b)), tot = r.reduce((a, x) => a + x.g, 0);
    console.log(`${m} RSI2<${U}`.padEnd(13), r.map(x => x.g.toFixed(1).padStart(7)).join(""), ` total ${tot.toFixed(1)} ops ${r.reduce((a, x) => a + x.n, 0)}`, r.every(x => x.g >= 0) ? "" : " (pierde algún periodo)"); } }
