const fs = require("fs"), zlib = require("zlib"), { simular, mediaMovil } = require("./sim.js");
const D = {}; for (const m of "BTC,ETH,SOL,BNB,XRP,DOGE,ADA".split(",")) { const t = zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n"); const T = new Float64Array(t.length), P = new Float64Array(t.length); t.forEach((l, i) => { const c = l.split(","); T[i] = +c[0]; P[i] = +c[4]; }); D[m] = { T, P, MA: {} }; }
const out = [];
for (const tend of [4320, 7200, 10080, 14400, 20160]) for (const bajada of [6, 8, 10, 12, 15]) for (const subida of [0.7, 1, 1.5, 2]) {
  const r = Object.entries(D).map(([m, d]) => { d.MA[tend] = d.MA[tend] || mediaMovil(d.P, tend); return simular({ bajada, subida, lotes: 2, tope: 1e9, monto: 6, capital: 12, comision: 0.1 }, d.T, d.P, 0, d.P.length, d.MA[tend]); });
  out.push(`MA ${tend / 1440}d baja ${bajada}% sube ${subida}%: total ${r.reduce((a, x) => a + x.final, 0).toFixed(2)}, monedas + ${r.filter(x => x.final > 0).length}/7, atoradas ${r.reduce((a, x) => a + x.abiertos, 0)}, peor bajón ${Math.max(...r.map(x => x.maxDD)).toFixed(2)}`);
}
console.log(out.join("\n"));
