// Filtros de mercado lateral sobre la estrategia viva (largo SMA45, corto en bajada fuerte, stop ~4.3%, ~1.4x efectivo).
// El filtro solo decide si se ABRE una entrada nueva; si ya está dentro, sale con las reglas de siempre.
const fs = require("fs"), FEE = 0.0005, FUND = 0.0003, L = 1.4, ST = 0.043;
const C = fs.readFileSync(__dirname + "/diarios/ETHUSDT-1d.csv", "utf8").trim().split("\n").map(l => l.split(",").slice(0, 5).map(Number));
const H = C.map(c => c[2]), Lo = C.map(c => c[3]), cl = C.map(c => c[4]);
const sma = (a, n) => a.map((_, i) => i < n - 1 ? null : a.slice(i - n + 1, i + 1).reduce((x, y) => x + y, 0) / n);
const m45 = sma(cl, 45), m20 = sma(cl, 20), m200 = sma(cl, 200);
// ADX 14 (Wilder)
const tr = cl.map((c, i) => i ? Math.max(H[i] - Lo[i], Math.abs(H[i] - cl[i - 1]), Math.abs(Lo[i] - cl[i - 1])) : H[i] - Lo[i]);
const dmP = H.map((h, i) => i && h - H[i - 1] > Lo[i - 1] - Lo[i] && h - H[i - 1] > 0 ? h - H[i - 1] : 0), dmM = Lo.map((l, i) => i && Lo[i - 1] - l > H[i] - H[i - 1] && Lo[i - 1] - l > 0 ? Lo[i - 1] - l : 0);
const wil = (a, n) => { const o = []; let s = 0; a.forEach((x, i) => { s = i < n ? s + x : s - s / n + x; o.push(s); }); return o; };
const sTR = wil(tr, 14), sP = wil(dmP, 14), sM = wil(dmM, 14), dx = sTR.map((t, i) => { const p = sP[i] / t, m = sM[i] / t; return p + m ? Math.abs(p - m) / (p + m) * 100 : 0; });
const adx = []; dx.forEach((x, i) => adx.push(i < 28 ? x : (adx[i - 1] * 13 + x) / 14));
const er = cl.map((c, i) => { if (i < 20) return 0; let v = 0; for (let k = i - 19; k <= i; k++) v += Math.abs(cl[k] - cl[k - 1]); return Math.abs(c - cl[i - 20]) / v; });
const chop = cl.map((_, i) => { if (i < 14) return 100; let s = 0; for (let k = i - 13; k <= i; k++) s += tr[k]; const hh = Math.max(...H.slice(i - 13, i + 1)), ll = Math.min(...Lo.slice(i - 13, i + 1)); return 100 * Math.log10(s / (hh - ll)) / Math.log10(14); });
const per = [[2018,1,2019,7],[2019,7,2021,7],[2021,7,2023,7],[2023,7,2025,7],[2025,7,2027,1]].map(([x,a,y,b])=>[Date.UTC(x,a-1,1),Date.UTC(y,b-1,1)]);
function corre(filtro, a, b) {
  let eq = 1, pos = 0, ent = 0, max = 1, dd = 0, ops = 0, bloq = 0, ult = 0;
  for (let i = 201; i < C.length; i++) { const [t, o, h, l, c] = C[i]; if (t < a || t >= b) continue; ult = c; const j = i - 1, x = cl[j];
    let sig = x > m45[j] ? 1 : (x < m20[j] && m20[j] < m20[j - 5] && x < m200[j] ? -1 : 0);
    if (bloq && sig === bloq) sig = 0; else if (sig !== bloq) bloq = 0;
    if (sig && sig !== pos && !filtro(j, sig)) sig = 0; // entrada nueva bloqueada por el filtro
    if (sig !== pos) { if (pos) { eq *= 1 + pos * (o / ent - 1) * L; eq -= eq * FEE * L; ops++; } pos = sig; if (pos) { ent = o; eq -= eq * FEE * L; } }
    if (pos) { eq -= eq * FUND * L; const peor = pos > 0 ? l / ent - 1 : 1 - h / ent;
      if (peor <= -ST) { eq *= 1 - ST * L; eq -= eq * FEE * L; ops++; bloq = pos; pos = 0; }
      else { const v = eq * (1 + pos * (c / ent - 1) * L); max = Math.max(max, v); dd = Math.max(dd, 1 - v / max); } } }
  if (pos) eq *= 1 + pos * (ult / ent - 1) * L;
  return { eq, dd, ops };
}
const F = { "actual (sin filtro)": () => true };
for (const k of [15, 20, 25, 30]) F[`ADX>${k}`] = j => adx[j] > k;
for (const k of [0.15, 0.2, 0.3]) F[`eficiencia>${k}`] = j => er[j] > k;
for (const k of [61.8, 55, 50]) F[`choppiness<${k}`] = j => chop[j] < k;
for (const k of [5, 10]) F[`SMA45 inclinada ${k}d`] = (j, s) => s > 0 ? m45[j] > m45[j - k] : m45[j] < m45[j - k];
for (const k of [0.01, 0.02, 0.03]) F[`banda ${k * 100}%`] = (j, s) => s > 0 ? cl[j] > m45[j] * (1 + k) : true;
const base = per.map(([a, b]) => corre(F["actual (sin filtro)"], a, b));
const fmt = r => r.map(y => `${((y.eq - 1) * 100).toFixed(0)}%`.padStart(6)).join("") + `  dd${(Math.max(...r.map(y => y.dd)) * 100).toFixed(0)}% ops${r.reduce((a, y) => a + y.ops, 0)}`;
console.log("periodos: 2018-19 | 19-21 | 21-23 | 23-25 | 25-hoy");
for (const [n, f] of Object.entries(F)) { const r = per.map(([a, b]) => corre(f, a, b)), mej = r.filter((y, i) => y.eq > base[i].eq + 1e-9).length;
  console.log(n.padEnd(22), fmt(r), r.every(y => y.eq > 1) ? "" : " PIERDE", `mejor en ${mej}/5`); }
const i = C.length - 1; console.log("hoy", new Date(C[i][0]).toISOString().slice(0, 10), "ADX", adx[i].toFixed(1), "ER", er[i].toFixed(2), "chop", chop[i].toFixed(1));
