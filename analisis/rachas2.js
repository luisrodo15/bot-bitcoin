// Cortar rachas de pérdidas en la estrategia viva de Futuros ETH (posición fija 22 USDT, stop 4.3%).
// Reglas: (a) tras K pérdidas seguidas, pausa D días; (b) tras K pérdidas seguidas, pide señal más fuerte (cierre > SMA45*(1+B) / < corte*(1-B)) hasta ganar;
// (c) siempre pedir banda B; (d) pausa tras K pérdidas hasta que una entrada "en papel" gane.
const fs = require("fs"), FEE = 0.0005, FUND = 0.0001, ST = 0.043, NOC = 22;
const C = fs.readFileSync(__dirname + "/diarios/ETHUSDT-1d.csv", "utf8").trim().split("\n").map(l => l.split(",").slice(0, 5).map(Number)).filter(c => c[0] >= Date.UTC(2017, 8, 1));
const per = [[2018,1,2019,7],[2019,7,2021,7],[2021,7,2023,7],[2023,7,2025,7],[2025,7,2027,1]].map(([x,a,y,b])=>[Date.UTC(x,a-1,1),Date.UTC(y,b-1,1)]);
const sma = (a, n) => { const o = []; let s = 0; a.forEach((c, j) => { s += c; if (j >= n) s -= a[j - n]; o.push(j >= n - 1 ? s / n : null); }); return o; };
const cl = C.map(c => c[4]), m45 = sma(cl, 45), m20 = sma(cl, 20), m200 = sma(cl, 200);
function corre(R, a, b) {
  let pos = 0, ent = 0, bloq = 0, ult = 0, g = 0, seg = 0, maxSeg = 0, n = 0, pausaHasta = 0, papel = 0, pent = 0, pbloq = 0;
  const cierra = r => { g += r; n++; if (r < 0) { seg++; maxSeg = Math.max(maxSeg, seg); } else seg = 0; };
  for (let i = 201; i < C.length; i++) { const [t, o, h, l, c] = C[i]; if (t < a || t >= b) continue; ult = c; const j = i - 1, x = cl[j];
    const fuerte = R.B && (R.siempre || (R.K && seg >= R.K)) ? R.B : 0;
    let sig = x > m45[j] * (1 + fuerte) ? 1 : (x < m20[j] && m20[j] < m20[j - 5] && x < Math.min(m200[j], m20[j]) * (1 - fuerte) ? -1 : 0);
    if (bloq && sig === bloq) sig = 0; else if (sig !== bloq) bloq = 0;
    if (R.D && R.K && seg >= R.K && t < pausaHasta && sig !== pos && sig) sig = pos;
    if (sig !== pos) { if (pos) cierra(pos * (o / ent - 1) - 2 * FEE); pos = sig; if (pos) ent = o; }
    if (pos) { g -= FUND * 3; const peor = pos > 0 ? l / ent - 1 : 1 - h / ent;
      if (peor <= -ST) { cierra(-ST - 2 * FEE); bloq = pos; pos = 0; if (R.D && R.K && seg >= R.K) pausaHasta = t + R.D * 864e5; } } }
  if (pos) cierra(pos * (ult / ent - 1));
  return { u: g * NOC, maxSeg, n }; }
const reglas = [["actual", {}]];
for (const K of (process.env.KS||"3 4 5").split(" ").map(Number)) for (const D of (process.env.DS||"10 20 30").split(" ").map(Number)) reglas.push([`pausa ${D}d tras ${K} pérdidas`, { K, D }]);
for (const K of [3, 4, 5]) for (const B of [0.02, 0.04]) reglas.push([`tras ${K} pérdidas pide señal +${B * 100}%`, { K, B }]);
for (const B of [0.01, 0.02, 0.03]) reglas.push([`siempre señal +${B * 100}%`, { B, siempre: 1 }]);
const base = per.map(([a, b]) => corre({}, a, b));
console.log("USDT, posición fija 22. Periodos: 2018-19 | 19-21 | 21-23 | 23-25 | 25-hoy");
for (const [n, R] of reglas) { const r = per.map(([a, b]) => corre(R, a, b)), tot = r.reduce((s, x) => s + x.u, 0), mx = Math.max(...r.map(x => x.maxSeg)), mej = r.filter((y, i) => y.u >= base[i].u - 0.05).length;
  console.log(n.padEnd(30), r.map(x => x.u.toFixed(1).padStart(7)).join(""), ` total ${tot.toFixed(1)}  racha máx ${mx}  igual o mejor ${mej}/5`); }
