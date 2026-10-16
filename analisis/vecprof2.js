// Análisis profundo ETH futuros diario: largos con SMA N; cortos solo con filtro de régimen bajista. Varias salidas.
const fs = require("fs"), FEE = 0.0005, FUND = 0.0003;
const C = fs.readFileSync(__dirname + "/diarios/ETHUSDT-1d.csv", "utf8").trim().split("\n").map(l => l.split(",").slice(0, 5).map(Number));
const cl = C.map(c => c[4]), sma = n => cl.map((_, i) => i < n - 1 ? null : cl.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n);
const SM = {}; const S_ = n => SM[n] || (SM[n] = sma(n));
const per = [[2018,1,2019,7],[2019,7,2021,7],[2021,7,2023,7],[2023,7,2025,7],[2025,7,2027,1]].map(([x,a,y,b])=>[Date.UTC(x,a-1,1),Date.UTC(y,b-1,1)]);
// p: {N, L, stL, stS, filtro: 0 sin cortos | "sma200" | "pend" | "ambos", NS (sma para cortos), Lc (apalancamiento corto)}
function corre(p, a, b) {
  const m = S_(p.N), m200 = S_(200), ms = S_(p.NS || p.N);
  const Lx = s => s < 0 ? (p.Lc || p.L) : p.L;
  let eq = 1, pos = 0, ent = 0, max = 1, dd = 0, ops = 0, bloq = 0, ult = 0;
  for (let i = 201; i < C.length; i++) { const [t, o, h, l, c] = C[i]; if (t < a || t >= b) continue; ult = c;
    const x = cl[i - 1]; let sig = x > m[i - 1] ? 1 : 0;
    if (!sig && p.filtro) { const baja = x < ms[i - 1], f200 = x < m200[i - 1], pend = ms[i - 1] < ms[i - 6];
      if (baja && (p.filtro === "sma200" ? f200 : p.filtro === "pend" ? pend : p.filtro === "ambos" ? f200 && pend : true)) sig = -1; }
    if (bloq && sig === bloq) sig = 0; else if (sig !== bloq) bloq = 0;
    if (sig !== pos) { if (pos) { const L = Lx(pos); eq *= 1 + pos * (o / ent - 1) * L; eq -= eq * FEE * L; ops++; } pos = sig; if (pos) { ent = o; eq -= eq * FEE * Lx(pos); } }
    if (pos) { const L = Lx(pos), S = pos > 0 ? p.stL : p.stS; eq -= eq * FUND * L;
      const peor = pos > 0 ? l / ent - 1 : 1 - h / ent, liq = -0.9 / L, tope = S ? -S : -Infinity;
      if (peor <= Math.max(liq, tope)) { const r = Math.max(liq, tope); eq *= 1 + r * L; eq -= eq * FEE * L; ops++; bloq = pos; pos = 0; }
      else { const v = eq * (1 + pos * (c / ent - 1) * L); max = Math.max(max, v); dd = Math.max(dd, 1 - v / max); } }
    if (eq <= 0.01) return { eq: 0, dd: 1, ops };
  }
  if (pos) { const L = Lx(pos); eq *= 1 + pos * (ult / ent - 1) * L; }
  return { eq, dd, ops };
}
const f = r => r.map(y => `${((y.eq - 1) * 100).toFixed(0)}%`).join(" ") + ` | dd${(Math.max(...r.map(y=>y.dd)) * 100).toFixed(0)} ops${r.reduce((a,y)=>a+y.ops,0)}`;
let gana = 0, tot = 0;
for (const N of [40, 45, 50]) for (const NS of [15, 20, 25]) for (const stS of [0.03, 0.05, 0.08]) for (const filtro of ["ambos", "sma200"]) {
  const r = per.map(([a, b]) => corre({ N, L: +(process.env.LL||2), stL: 0.05, stS, filtro, NS, Lc: +(process.env.LC||1) }, a, b)), b0 = per.map(([a, b]) => corre({ N, L: +(process.env.LL||2), stL: 0.05 }, a, b));
  const ok = r.every(y => y.eq > 1), mejor = r.filter((y, i) => y.eq > b0[i].eq).length; tot++; if (ok && mejor >= 4) gana++;
  console.log(`SMA${N} ${filtro} sma${NS} stop${stS*100}%`.padEnd(30), f(r), ok ? "" : " <-- pierde algún periodo", `mejor en ${mejor}/5`);
}
console.log("robustas:", gana, "de", tot);
const m200 = S_(200), m20 = S_(20), m45 = S_(45), i = C.length - 1;
console.log("hoy", new Date(C[i][0]).toISOString().slice(0,10), "cierre", cl[i], "sma45", m45[i].toFixed(0), "sma20", m20[i].toFixed(0), "sma20 hace 5", m20[i-5].toFixed(0), "sma200", m200[i].toFixed(0));
