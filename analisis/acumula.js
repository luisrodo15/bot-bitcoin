// ¿Con qué moneda el bot junta más monedas que solo guardarla? (estrategia 55/25, comisión 0.1%, BNB 0.075%)
const fs = require("fs"); const src = fs.readFileSync("holly.js", "utf8").split("const pc =")[0].replace('const fs = require("fs"), ', "const ");
eval(src + `
const per = [["2018-2022", "2018-03-01", "2023-01-01"], ["2023-hoy", "2023-01-01", "2100-01-01"], ["último año", "2025-10-01", "2100-01-01"]];
for (const m of ["BNB","BTC","ETH","SOL","XRP","DOGE","ADA"]) { const I = preparar(m), fee = m === "BNB" ? 0.00075 : 0.001, ix = d => { const k = I.T.findIndex(t => t >= Date.parse(d)); return k < 0 ? I.P.length : k; };
  const r = per.map(([, a, b]) => { a = Math.max(ix(a), 201); b = ix(b); let e = 1, en = false; for (let i = a; i < b; i++) { e *= en ? I.P[i] / I.P[i - 1] : 1; const f = I.f[i]; if (f == null) continue; const s = I.e20[i] > I.e50[i]; const q = en ? (f > 25 && s) : (f >= 55 && s); if (q !== en) { e *= 1 - fee; en = q; } } return e / (I.P[b - 1] / I.P[a - 1]); });
  console.log(m.padEnd(5), r.map(x => ("x" + x.toFixed(2)).padStart(10)).join("")); }`);
