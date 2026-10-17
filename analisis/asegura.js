// Idea 2026-10-17: asegurar ganancia. Estrategia viva de Futuros ETH (largo > SMA45, corto en bajada fuerte, stop 4.3%, posición fija 22 USDT)
// + (a) stop a "sin pérdida" cuando la entrada va +X%, o (b) stop que sigue al precio a T% del mejor precio una vez que va +X%.
// Tras salir por cualquiera de los dos, no vuelve a entrar de ese lado hasta que la señal cambie (igual que el stop normal).
const fs = require("fs"), FEE = 0.0005, FUND = 0.0001, ST = 0.043, NOC = 22;
const C = fs.readFileSync(__dirname + "/diarios/ETHUSDT-1d.csv", "utf8").trim().split("\n").map(l => l.split(",").slice(0, 5).map(Number)).filter(c => c[0] >= Date.UTC(2017, 8, 1));
const per = [[2018,1,2019,7],[2019,7,2021,7],[2021,7,2023,7],[2023,7,2025,7],[2025,7,2027,1]].map(([x,a,y,b])=>[Date.UTC(x,a-1,1),Date.UTC(y,b-1,1)]);
const sma = (a, n) => { const o = []; let s = 0; a.forEach((c, j) => { s += c; if (j >= n) s -= a[j - n]; o.push(j >= n - 1 ? s / n : null); }); return o; };
const cl = C.map(c => c[4]), m45 = sma(cl, 45), m20 = sma(cl, 20), m200 = sma(cl, 200);
function corre(X, T, a, b, N = 45) { const mN = N === 45 ? m45 : sma(cl, N);
  let pos = 0, ent = 0, bloq = 0, ult = 0, g = 0, mejor = 0, ops = 0;
  for (let i = 201; i < C.length; i++) { const [t, o, h, l, c] = C[i]; if (t < a || t >= b) continue; ult = c; const j = i - 1, x = cl[j];
    let sig = x > mN[j] ? 1 : (x < m20[j] && m20[j] < m20[j - 5] && x < m200[j] ? -1 : 0);
    if (bloq && sig === bloq) sig = 0; else if (sig !== bloq) bloq = 0;
    if (sig !== pos) { if (pos) { g += pos * (o / ent - 1) - 2 * FEE; ops++; } pos = sig; if (pos) { ent = o; mejor = o; } }
    if (pos) { g -= FUND * 3;
      // nivel de salida: stop normal, o el asegurado si ya fue +X%
      const fav = pos > 0 ? mejor / ent - 1 : 1 - mejor / ent;
      let nivel = pos > 0 ? ent * (1 - ST) : ent * (1 + ST);
      if (X && fav >= X) { const asegurado = T ? (pos > 0 ? mejor * (1 - T) : mejor * (1 + T)) : ent * (1 + pos * 2 * FEE);
        nivel = pos > 0 ? Math.max(nivel, asegurado) : Math.min(nivel, asegurado); }
      const toca = pos > 0 ? l <= nivel : h >= nivel;
      if (toca) { const px = pos > 0 ? Math.min(o, nivel) : Math.max(o, nivel); g += pos * (px / ent - 1) - 2 * FEE; ops++; bloq = pos; pos = 0; }
      else mejor = pos > 0 ? Math.max(mejor, h) : Math.min(mejor, l); } }
  if (pos) g += pos * (ult / ent - 1);
  return { u: g * NOC, ops }; }
const fila = (n, f) => { const r = per.map(([a, b]) => f(a, b)), tot = r.reduce((s, x) => s + x.u, 0); return { n, r, tot }; };
const base = fila("actual", (a, b) => corre(0, 0, a, b));
const res = [base];
for (const X of [0.1, 0.15, 0.2, 0.3]) { res.push(fila(`sin pérdida tras +${X * 100}%`, (a, b) => corre(X, 0, a, b)));
  for (const T of [0.1, 0.15, 0.2, 0.25]) res.push(fila(`tras +${X * 100}% sigue a ${T * 100}%`, (a, b) => corre(X, T, a, b))); }
console.log("USDT con posición fija 22 USDT. Periodos: 2018-19 | 19-21 | 21-23 | 23-25 | 25-hoy");
for (const x of res) { const mej = x.r.filter((y, i) => y.u > base.r[i].u + 0.05).length, peor = x.r.filter((y, i) => y.u < base.r[i].u - 0.05).length;
  console.log(x.n.padEnd(26), x.r.map(y => y.u.toFixed(1).padStart(7)).join(""), ` total ${x.tot.toFixed(1)}`, x === base ? "" : `mejor ${mej} peor ${peor}`); }
// vecinos de SMA para la mejor
const top = res.slice(1).sort((p, q) => q.tot - p.tot)[0]; console.log("\nmejor:", top.n);
