// Prueba pesimista: decide con el cierre, pero COMPRA al máximo del minuto y VENDE al mínimo del minuto
// (como si siempre te tocara el peor precio del minuto, incluida la diferencia compra/venta).
const fs = require("fs"), zlib = require("zlib");
function correr(o, T, C, Hh, Lw, a, b) {
  const com = o.comision / 100; let usdt = o.capital, ref = null, L = [], v = 0, perd = 0;
  for (let i = a; i < b; i++) { const p = C[i]; let vend = false;
    for (let j = L.length - 1; j >= 0; j--) { if (p < L[j][0] * (1 + o.subida / 100) && p > L[j][0] * (1 - o.tope / 100)) continue;
      const n = L[j][1] * Lw[i] * (1 - com); usdt += n; if (n < L[j][2]) perd++; L.splice(j, 1); v++; vend = true; }
    if (!L.length && vend) ref = p;
    let nivel; if (!L.length) { ref = ref == null ? p : Math.max(ref, p); nivel = ref * (1 - o.bajada / 100); } else nivel = Math.min(...L.map(x => x[0])) * (1 - o.bajada / 100);
    if (p <= nivel && L.length < o.lotes && usdt >= o.monto - 1e-9) { usdt -= o.monto; L.push([Hh[i], o.monto * (1 - com) / Hh[i], o.monto]); } }
  return { final: usdt + L.reduce((s, x) => s + x[1] * Lw[b - 1], 0) - o.capital, v, perd };
}
for (const S of ["USDCMXN", "USDTMXN"]) {
  const t = zlib.gunzipSync(fs.readFileSync(`datos/${S}.csv.gz`)).toString().trim().split("\n"), n = t.length;
  const T = new Float64Array(n), C = new Float64Array(n), Hh = new Float64Array(n), Lw = new Float64Array(n);
  t.forEach((l, i) => { const c = l.split(","); T[i] = +c[0]; Hh[i] = +c[2]; Lw[i] = +c[3]; C[i] = +c[4]; });
  // tamaño típico de rango dentro del minuto
  const r = []; for (let i = 0; i < n; i += 7) r.push((Hh[i] - Lw[i]) / C[i] * 100); r.sort((a, b) => a - b);
  let planos = 0; for (let i = 0; i < n; i++) if (Hh[i] === Lw[i]) planos++;
  console.log(`\n${S}: rango dentro del minuto mediana ${r[r.length >> 1].toFixed(3)}%, p90 ${r[Math.floor(r.length * .9)].toFixed(3)}%; minutos sin movimiento ${(planos / n * 100).toFixed(0)}%`);
  const mes = i => new Date(T[i]).toISOString().slice(0, 7); const M = []; for (let i = 0; i < n; i++) if (!i || mes(i) !== mes(i - 1)) M.push(i); M.push(n);
  const combos = []; for (const bajada of [0.1, 0.2, 0.3, 0.5, 0.8, 1, 1.5, 2]) for (const subida of [0.1, 0.2, 0.3, 0.5, 0.8, 1, 1.5, 2]) for (const lotes of [1, 2]) for (const tope of [1, 2, 1e9]) combos.push({ bajada, subida, lotes, tope });
  for (const fee of [0.1, 0.075]) {
    const R = combos.map(c => M.slice(0, -1).map((a, j) => correr({ monto: 110, capital: 220, comision: fee, ...c }, T, C, Hh, Lw, a, M[j + 1])));
    const tot = R.map((r, j) => ({ j, f: r.reduce((a, x) => a + x.final, 0), v: r.reduce((a, x) => a + x.v, 0), p: r.reduce((a, x) => a + x.perd, 0), m: r.map(x => x.final.toFixed(1)) })).sort((a, b) => b.f - a.f);
    let wf = 0, wfp = 0, k0 = 0, det = []; for (let k = 3; k < M.length - 1; k++) { let bj = 0, bv = -1e9; R.forEach((r, j) => { const v = r[k - 1].final + r[k - 2].final + r[k - 3].final; if (v > bv) { bv = v; bj = j; } }); wf += R[bj][k].final; k0++; if (R[bj][k].final > 0) wfp++; det.push(R[bj][k].final.toFixed(1)); }
    console.log(`comisión ${fee}%: mejor ${JSON.stringify(combos[tot[0].j])} = ${tot[0].f.toFixed(2)} MXN (${tot[0].v} ventas, ${tot[0].p} con pérdida) por mes [${tot[0].m.join(" ")}]; ganan ${tot.filter(x => x.f > 0).length}/${combos.length}; eligiendo con 3 meses previos: ${wf.toFixed(2)} MXN (${wfp}/${k0} meses +) [${det.join(" ")}]`);
  }
}
