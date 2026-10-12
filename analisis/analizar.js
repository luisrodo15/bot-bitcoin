const fs = require("fs"), zlib = require("zlib"), { simular, mediaMovil } = require("./sim.js");
const DIR = process.argv[2], MON = (process.argv[3] || "BTC,ETH,SOL,BNB,XRP,DOGE,ADA").split(",");
const FEE = +(process.env.FEE || 0.1);
function cargar(m) {
  const t = zlib.gunzipSync(fs.readFileSync(`${DIR}/${m}USDT.csv.gz`)).toString().trim().split("\n");
  const ts = new Float64Array(t.length), P = new Float64Array(t.length);
  t.forEach((l, i) => { const c = l.split(","); ts[i] = +c[0]; P[i] = +c[4]; });
  return { ts, P };
}
const BAJ = [0.3, 0.5, 0.8, 1, 1.5, 2, 3, 5], SUB = [0.3, 0.5, 0.8, 1, 1.5, 2, 3, 5], LOT = [1, 2], TOPE = [2, 3, 5, 10, 1e9], TEND = [0, 1440, 10080];
const combos = []; for (const bajada of BAJ) for (const subida of SUB) for (const lotes of LOT) for (const tope of TOPE) for (const tend of TEND) combos.push({ bajada, subida, lotes, tope, tend });
const base = { monto: 6, capital: 12, comision: FEE };
const mes = t => new Date(t).toISOString().slice(0, 7);
const out = {};
for (const m of MON) {
  const { ts, P } = cargar(m), MA = { 0: null, 1440: mediaMovil(P, 1440), 10080: mediaMovil(P, 10080) };
  // cortes por mes
  const idx = []; let prev = null; for (let i = 0; i < ts.length; i++) { const k = mes(ts[i]); if (k !== prev) { idx.push({ k, i }); prev = k; } } idx.push({ k: "fin", i: ts.length });
  const meses = idx.slice(0, -1).map((x, j) => ({ k: x.k, a: x.i, b: idx[j + 1].i }));
  // resultado de cada combo en cada mes (estado nuevo cada mes, lotes abiertos valuados al cierre)
  const R = combos.map(c => meses.map(M => simular({ ...base, ...c }, ts, P, M.a, M.b, MA[c.tend])));
  const hold = meses.map(M => 12 * (P[M.b - 1] / P[M.a] - 1));
  // A) todo el año con reglas fijas: suma de meses
  const tot = R.map((r, j) => ({ j, final: r.reduce((a, x) => a + x.final, 0), pos: r.filter(x => x.final > 0).length, dd: Math.max(...r.map(x => x.maxDD)), ventas: r.reduce((a, x) => a + x.ventas, 0) }));
  tot.sort((a, b) => b.final - a.final);
  // B) caminando hacia adelante: cada mes usa las mejores reglas de los N meses anteriores
  const wf = {};
  for (const N of [1, 3]) {
    const res = [];
    for (let k = 3; k < meses.length; k++) {
      let best = -1, bv = -Infinity;
      combos.forEach((c, j) => { let v = 0; for (let q = k - N; q < k; q++) v += R[j][q].final; if (v > bv) { bv = v; best = j; } });
      res.push({ mes: meses[k].k, reglas: combos[best], final: R[best][k].final, hold: hold[k] });
    }
    // con freno: ese mes solo opera si las reglas elegidas también ganaron el mes anterior
    const fr = []; for (let k = 3; k < meses.length; k++) { const r = res[k - 3]; const j = combos.indexOf(r.reglas); fr.push(R[j][k - 1].final > 0 ? r.final : 0); }
    wf[N + "freno"] = { total: fr.reduce((a, x) => a + x, 0), positivos: fr.filter(x => x > 0).length, operados: fr.filter(x => x !== 0).length };
    wf[N] = { total: res.reduce((a, x) => a + x.final, 0), positivos: res.filter(x => x.final > 0).length, meses: res };
  }
  const jDef = combos.findIndex(c => c.bajada === 0.5 && c.subida === 0.5 && c.lotes === 2 && c.tope === 3 && c.tend === 0);
  out[m] = {
    meses: meses.map(x => x.k), hold, holdTotal: 12 * (P[P.length - 1] / P[0] - 1),
    top: tot.slice(0, 8).map(x => ({ ...combos[x.j], final: x.final, mesesPos: x.pos, dd: x.dd, ventas: x.ventas, porMes: R[x.j].map(r => +r.final.toFixed(2)) })),
    peor: tot.slice(-3).map(x => ({ ...combos[x.j], final: x.final })),
    positivas: tot.filter(x => x.final > 0).length, combos: combos.length,
    actual: { final: tot.find(x => x.j === jDef).final, porMes: R[jDef].map(r => +r.final.toFixed(2)) },
    wf
  };
  console.error(m, "listo; mejor fijo", tot[0].final.toFixed(2), combos[tot[0].j], "wf3", wf[3].total.toFixed(2), "wf3freno", wf["3freno"].total.toFixed(2), wf["3freno"].operados, "wf1freno", wf["1freno"].total.toFixed(2), "wf1", wf[1].total.toFixed(2), "hold", out[m].holdTotal.toFixed(2));
}
fs.writeFileSync(`resultado-${FEE}.json`, JSON.stringify(out, null, 1));
