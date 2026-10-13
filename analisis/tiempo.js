const fs = require("fs"), DIA = 864e5;
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const D = fs.readFileSync("diarios/BTCUSDT-1d.csv", "utf8").trim().split("\n").map(l => l.split(",").map(Number));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const P = D.map(c => c[4]), E20 = ema(P, 20), E50 = ema(P, 50); let sen = false, dentro = 0, tot = 0, cambios = [];
for (let i = 51; i < D.length; i++) { const f = fg.get(Math.floor(D[i - 1][0] / DIA)); if (f == null) continue; const sube = E20[i - 1] > E50[i - 1];
  const n = sen ? (f > 25 && sube) : (f >= 55 && sube); if (n !== sen) cambios.push(new Date(D[i][0]).toISOString().slice(0, 10) + (n ? " entra" : " sale")); sen = n;
  if (D[i][0] >= Date.parse("2025-10-01")) { tot++; if (sen) dentro++; } }
console.log(`último año: días con tendencia buena ${dentro}/${tot} (${(dentro / tot * 100).toFixed(0)}%)`); console.log(cambios.filter(c => c >= "2025-09").join(" | "));
