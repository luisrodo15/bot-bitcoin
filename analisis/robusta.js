// Reglas que funcionen en TODAS las monedas: elige con la primera mitad del año (oct-mar), revisa en la segunda (abr-oct).
const fs = require("fs"), zlib = require("zlib"), { simular, mediaMovil } = require("./sim.js");
const MON = "BTC,ETH,SOL,BNB,XRP,DOGE,ADA".split(","), CORTE = Date.parse("2026-04-01");
const combos = []; for (const bajada of [0.5, 1, 1.5, 2, 3, 4, 5, 7, 10]) for (const subida of [0.5, 1, 1.5, 2, 3, 4, 5, 7, 10]) for (const lotes of [1, 2]) for (const tope of [3, 5, 10, 1e9]) for (const tend of [0, 1440, 10080]) combos.push({ bajada, subida, lotes, tope, tend });
const A = combos.map(() => []), B = combos.map(() => []);
for (const m of MON) {
  const t = zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n");
  const T = new Float64Array(t.length), P = new Float64Array(t.length); t.forEach((l, i) => { const c = l.split(","); T[i] = +c[0]; P[i] = +c[4]; });
  const MA = { 0: null, 1440: mediaMovil(P, 1440), 10080: mediaMovil(P, 10080) }; let k = 0; while (T[k] < CORTE) k++;
  combos.forEach((c, j) => { const o = { ...c, monto: 6, capital: 12, comision: 0.075 }; A[j].push(simular(o, T, P, 0, k, MA[c.tend]).final); B[j].push(simular(o, T, P, k, P.length, MA[c.tend]).final); });
  console.error(m, "ok");
}
const sum = a => a.reduce((x, y) => x + y, 0);
const rank = combos.map((c, j) => ({ c, a: sum(A[j]), aPos: A[j].filter(x => x > 0).length, b: sum(B[j]), bPos: B[j].filter(x => x > 0).length, bv: B[j].map(x => x.toFixed(2)) }));
rank.sort((x, y) => y.aPos - x.aPos || y.a - x.a);
console.log("Mejores en la 1a mitad (oct-mar), y cómo les fue en la 2a mitad (abr-oct), 7 monedas, 12 USDT cada una:");
for (const r of rank.slice(0, 10)) console.log(JSON.stringify(r.c), `1a mitad ${r.a.toFixed(2)} (${r.aPos}/7 monedas +) -> 2a mitad ${r.b.toFixed(2)} (${r.bPos}/7 +) [${r.bv.join(" ")}]`);
const ambos = rank.filter(r => r.aPos >= 5 && r.bPos >= 5).length;
console.log("combinaciones que ganan en >=5 de 7 monedas en AMBAS mitades:", ambos, "de", combos.length);
const hold = 0; 
