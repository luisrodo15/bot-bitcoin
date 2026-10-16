// ¿De cuánto el escalón de caidaUSDT? En cada tendencia de bajada del bot (índice <= 25 o EMA20 < EMA50; vuelve con >= 55 y EMA20 > EMA50),
// el usuario pone 1 USDT al empezar la bajada; se compra en 3 partes, una cada -X% (desde el inicio o la compra anterior, con el mínimo del día).
// Lo que no se compró se usa al volver la tendencia (como hace el bot). Se compara con esperar y comprar todo al volver la tendencia.
const fs = require("fs");
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const D = fs.readFileSync("diarios/BTCUSDT-1d.csv", "utf8").trim().split("\n").map(l => l.split(",").map(Number));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const P = D.map(c => c[4]), E20 = ema(P, 20), E50 = ema(P, 50), FEE = 0.00075;
const bajadas = []; let en = false, ini = null;
for (let i = 50; i < D.length; i++) { const f = fg.get(Math.floor(D[i][0] / 864e5)); if (f == null) continue; const sube = E20[i] > E50[i];
  const q = en ? (f > 25 && sube) : (f >= 55 && sube);
  if (en && !q) ini = i + 1; if (!en && q && ini != null) { bajadas.push([ini, i + 1]); ini = null; } en = q; }
const pc = x => ((x - 1) * 100).toFixed(1) + "%";
console.log(bajadas.length, "bajadas desde", new Date(D[bajadas[0][0]][0]).toISOString().slice(0, 10));
for (const X of [0.01, 0.02, 0.03, 0.05, 0.08, 0.12]) { let rel = [], peor = 1e9, gan = 0;
  for (const [a, b] of bajadas) { if (b >= D.length) continue; let usd = 1, btc = 0, ref = D[a][1], partes = 3;
    for (let i = a; i < b && partes; i++) { while (partes && D[i][3] <= ref * (1 - X)) { const p = ref * (1 - X), m = usd / partes; btc += m * (1 - FEE) / p; usd -= m; partes--; ref = p; } }
    const pv = D[b][1]; btc += usd * (1 - FEE) / pv; const base = (1 - FEE) / pv, r = btc / base; rel.push(r); peor = Math.min(peor, r); if (r > 1) gan++; }
  const prom = rel.reduce((a, x) => a + x, 0) / rel.length, med = rel.slice().sort((a, b) => a - b)[rel.length >> 1];
  console.log(`escalón ${X * 100}%`.padEnd(14), `BTC vs esperar: promedio ${pc(prom)} mediana ${pc(med)} peor ${pc(peor)} gana en ${gan}/${rel.length}`); }
