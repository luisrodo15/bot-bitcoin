// Estrategias típicas de acciones, posición fija 22 USDT, stop ST (pérdida máx ~1 USDT con 4.3%).
const fs = require("fs"), FEE = 0.0005, FUND = 0.0001, ST = +(process.env.ST || 0.043), NOC = 22;
const per = [[2018,1,2019,7],[2019,7,2021,7],[2021,7,2023,7],[2023,7,2025,7],[2025,7,2027,1]].map(([x,a,y,b])=>[Date.UTC(x,a-1,1),Date.UTC(y,b-1,1)]);
const sma = (a, n) => { const o = []; let s = 0; a.forEach((c, j) => { s += c; if (j >= n) s -= a[j - n]; o.push(j >= n - 1 ? s / n : null); }); return o; };
const yh = n => { const r = JSON.parse(fs.readFileSync(__dirname + "/diarios/yahoo-" + n + ".json")).chart.result[0], q = r.indicators.quote[0]; return r.timestamp.map((t, i) => [Math.floor(t / 86400) * 864e5, q.open[i], q.high[i], q.low[i], q.close[i]]).filter(x => x[4] > 0 && x[1] > 0); };
const ACC = (process.env.ACC || "NVDA AAPL MSFT META GOOGL AMZN TSLA").split(" ");
// Motor de una acción: senal(i) usa datos hasta i-1; entra a la apertura de i.
function motor(C, senal, a, b) { let pos = 0, ent = 0, g = 0, n = 0;
  for (let i = 260; i < C.length; i++) { const [t, o, h, l, c] = C[i]; if (t < a || t >= b) continue; const s = senal(i - 1);
    if (s && !pos) { pos = 1; ent = o; n++; } else if (!s && pos) { g += o / ent - 1 - 2 * FEE; pos = 0; }
    if (pos) { g -= FUND * 3; if (l / ent - 1 <= -ST) { g += -ST - 2 * FEE; pos = 0; } } }
  return { g: g * NOC, n }; }
const D = Object.fromEntries([...ACC, "QQQ", "SPY"].map(m => [m, yh(m)]));
const reglas = {
  "máximo de 1 año, sale abajo SMA50": C => { const cl = C.map(c => c[4]), m50 = sma(cl, 50); let dentro = false; return i => { const mx = Math.max(...cl.slice(i - 252, i)); if (cl[i] >= mx) dentro = true; else if (cl[i] < m50[i]) dentro = false; return dentro; }; },
  "máximo de 3 meses, sale abajo SMA20": C => { const cl = C.map(c => c[4]), m20 = sma(cl, 20); let dentro = false; return i => { const mx = Math.max(...cl.slice(i - 63, i)); if (cl[i] >= mx) dentro = true; else if (cl[i] < m20[i]) dentro = false; return dentro; }; },
  "fin de mes (último día a 3er día)": C => i => { const d = new Date(C[i][0]), sig = new Date(C[Math.min(i + 1, C.length - 1)][0]); const dia = d.getUTCDate(), ult = sig.getUTCMonth() !== d.getUTCMonth(); return ult || dia <= 2; },
  "arriba de SMA200 y SMA50>SMA200": C => { const cl = C.map(c => c[4]), m50 = sma(cl, 50), m200 = sma(cl, 200); return i => cl[i] > m200[i] && m50[i] > m200[i]; },
};
console.log("USDT con 22 USDT por entrada, stop", ST * 100 + "%. Periodos: 2018-19 | 19-21 | 21-23 | 23-25 | 25-hoy");
for (const [nom, f] of Object.entries(reglas)) { console.log("\n" + nom);
  for (const m of [...ACC, "QQQ"]) { const C = D[m], r = per.map(([a, b]) => motor(C, f(C), a, b)), tot = r.reduce((a, x) => a + x.g, 0);
    console.log(`  ${m}`.padEnd(8), r.map(x => x.g.toFixed(1).padStart(7)).join(""), ` total ${tot.toFixed(1)} ops ${r.reduce((a, x) => a + x.n, 0)}`, r.every(x => x.g >= 0) ? "" : " (pierde)"); } }
// Rotación: cada mes, la acción con mejor subida de 3 meses (si está arriba de su SMA200), una sola posición.
console.log("\nrotación mensual a la más fuerte (3 y 6 meses)");
for (const L of (process.env.LS || "63 126").split(" ").map(Number)) { const fechas = D.QQQ.map(c => c[0]); const idx = {}; for (const m of ACC) { idx[m] = new Map(D[m].map((c, i) => [c[0], i])); }
  const r = per.map(([a, b]) => { let pos = null, ent = 0, g = 0, n = 0, mes = -1;
    for (let k = 260; k < fechas.length; k++) { const t = fechas[k]; if (t < a || t >= b) continue; const mm = new Date(t).getUTCMonth();
      if (pos) { const i = idx[pos].get(t); if (i != null) { const [, o, h, l, c] = D[pos][i]; g -= FUND * 3; if (l / ent - 1 <= -ST) { g += -ST - 2 * FEE; pos = null; } } }
      if (mm !== mes) { mes = mm; let mejor = null, mv = 0;
        for (const m of ACC) { const i = idx[m].get(t); if (i == null || i < 260) continue; const cl = D[m].map(x => x[4]); const ret = cl[i - 1] / cl[i - 1 - L] - 1, s200 = cl.slice(i - 201, i - 1).reduce((x, y) => x + y, 0) / 200; if (cl[i - 1] > s200 && ret > mv) { mv = ret; mejor = m; } }
        if (mejor !== pos) { if (pos) { const i = idx[pos].get(t); if (i != null) g += D[pos][i][1] / ent - 1 - 2 * FEE; } pos = mejor; if (pos) { ent = D[pos][idx[pos].get(t)][1]; n++; } } } }
    return { g: g * NOC, n }; });
  console.log(`  ${L} días`.padEnd(10), r.map(x => x.g.toFixed(1).padStart(7)).join(""), ` total ${r.reduce((a, x) => a + x.g, 0).toFixed(1)} ops ${r.reduce((a, x) => a + x.n, 0)}`, r.every(x => x.g >= 0) ? "" : " (pierde)"); }
