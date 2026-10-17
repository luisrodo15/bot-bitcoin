// Idea 2026-10-17: confirmar con Bitcoin. Estrategia viva de Futuros ETH (largo > SMA45, corto en bajada fuerte, stop 4.3%, posición 22 USDT)
// + el largo solo si BTC también cierra arriba de su promedio de K días (y el corto solo si BTC cierra abajo de él).
// Datos: analisis/memes (rama memes, al día). Correr: node analisis/btcfiltro.js
const fs = require("fs"), FEE = 0.0005, FUND = 0.0001, ST = 0.043, NOC = 22;
const lee = s => fs.readFileSync(__dirname + `/memes/${s}-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").slice(0, 5).map(Number));
const C = lee("ETHUSDT"), B = new Map(lee("BTCUSDT").map(c => [c[0], c[4]]));
const per = [[2018,1,2019,7],[2019,7,2021,7],[2021,7,2023,7],[2023,7,2025,7],[2025,7,2027,1]].map(([x,a,y,b])=>[Date.UTC(x,a-1,1),Date.UTC(y,b-1,1)]);
const sma = (a, n) => { const o = []; let s = 0; a.forEach((c, j) => { s += c; if (j >= n) s -= a[j - n]; o.push(j >= n - 1 ? s / n : null); }); return o; };
const cl = C.map(c => c[4]), bc = C.map(c => B.get(c[0])), m20 = sma(cl, 20), m200 = sma(cl, 200);
function corre(N, K, modo, a, b) { const mN = sma(cl, N), bk = K ? sma(bc, K) : null;
  let pos = 0, ent = 0, bloq = 0, ult = 0, g = 0, ops = 0;
  for (let i = 201; i < C.length; i++) { const [t, o, h, l, c] = C[i]; if (t < a || t >= b) continue; ult = c; const j = i - 1, x = cl[j];
    let sig = x > mN[j] ? 1 : (x < m20[j] && m20[j] < m20[j - 5] && x < m200[j] ? -1 : 0);
    if (K && sig === 1 && modo !== "corto" && !(bc[j] > bk[j])) sig = 0;
    if (K && sig === -1 && modo !== "largo" && !(bc[j] < bk[j])) sig = 0;
    if (bloq && sig === bloq) sig = 0; else if (sig !== bloq) bloq = 0;
    if (sig !== pos) { if (pos) { g += pos * (o / ent - 1) - 2 * FEE; ops++; } pos = sig; if (pos) ent = o; }
    if (pos) { g -= FUND * 3; const nivel = ent * (1 - pos * ST), toca = pos > 0 ? l <= nivel : h >= nivel;
      if (toca) { const px = pos > 0 ? Math.min(o, nivel) : Math.max(o, nivel); g += pos * (px / ent - 1) - 2 * FEE; ops++; bloq = pos; pos = 0; } } }
  if (pos) g += pos * (ult / ent - 1);
  return { u: g * NOC, ops }; }
const fila = (N, K, modo) => per.map(([a, b]) => corre(N, K, modo, a, b));
console.log("USDT con posición 22 USDT. Periodos: 2018-19 | 19-21 | 21-23 | 23-25 | 25-hoy");
for (const N of [30, 45, 60]) { const base = fila(N, 0), tb = base.reduce((s, y) => s + y.u, 0);
  console.log(`\nETH SMA${N} actual`.padEnd(28), base.map(y => y.u.toFixed(1).padStart(7)).join(""), ` total ${tb.toFixed(1)}`);
  for (const modo of ["largo", "corto", "ambos"]) for (const K of [20, 30, 45, 60, 80, 100, 150, 200]) { const r = fila(N, K, modo), tot = r.reduce((s, y) => s + y.u, 0);
    const mej = r.filter((y, i) => y.u > base[i].u + 0.05).length, peor = r.filter((y, i) => y.u < base[i].u - 0.05).length;
    console.log(`  BTC>${K} (${modo})`.padEnd(27), r.map(y => y.u.toFixed(1).padStart(7)).join(""), ` total ${tot.toFixed(1)} mejor ${mej} peor ${peor}`); } }
