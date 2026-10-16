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
const res = [];
for (const N of [35, 40, 45, 50]) for (const filtro of [0, "sma200", "pend", "ambos"]) for (const NS of filtro ? [N, 20, 30, 100] : [N]) for (const stS of filtro ? [0.03, 0.05, 0.08] : [0]) for (const Lc of filtro ? [1, 2] : [2]) {
  const p = { N, L: 2, stL: 0.05, stS, filtro, NS, Lc }; const r = per.map(([a, b]) => corre(p, a, b));
  res.push({ k: `SMA${N} ${filtro ? `cortos[${filtro} sma${NS} stop${stS * 100}% ${Lc}x]` : "solo largos"}`, r, N, filtro, min: Math.min(...r.map(x => x.eq)), prod: r.reduce((a, x) => a * x.eq, 1), dd: Math.max(...r.map(x => x.dd)) });
}
const base = Object.fromEntries(res.filter(x => !x.filtro).map(x => [x.N, x]));
const f = x => x.r.map(y => `${((y.eq - 1) * 100).toFixed(0)}%`).join(" ") + ` | dd${(x.dd * 100).toFixed(0)}`;
console.log("BASE:"); for (const N in base) console.log(base[N].k.padEnd(52), f(base[N]));
const buenas = res.filter(x => x.filtro && x.r.every((y, i) => y.eq >= base[x.N].r[i].eq * 0.97) && x.min > 1).sort((a, b) => b.prod - a.prod);
console.log("\nCON CORTOS que ganan en TODOS los periodos y no pierden vs solo largos (top 15):"); for (const x of buenas.slice(0, 15)) console.log(x.k.padEnd(52), f(x));
console.log("\nTop por producto con min>1:"); for (const x of res.filter(x => x.filtro && x.min > 1).sort((a, b) => b.prod - a.prod).slice(0, 10)) console.log(x.k.padEnd(52), f(x));
