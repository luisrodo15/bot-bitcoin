// Idea del día (2026-10-12): 1) fuerza contra BTC: solo compra BNB si en los últimos N días le fue mejor que a BTC.
// 2) recompra rápida: si vendió por la EMA pero no hubo miedo, vuelve a comprar cuando la EMA se recupere con índice >= Q.
const fs = require("fs"); const src = fs.readFileSync("holly.js", "utf8").split("const pc =")[0].replace('const fs = require("fs"), ', "const ");
eval(src + `
const per = [["2018-2022", "2018-03-01", "2023-01-01"], ["2023-hoy", "2023-01-01", "2100-01-01"], ["último año", "2025-10-01", "2100-01-01"]];
const B = preparar("BTC"), bt = new Map(B.T.map((t, i) => [t, B.P[i]]));
function corre(I, cfg, a, b) { let e = 1, en = false, mx = 1, dd = 0, ops = 0, porEMA = false;
  for (let i = Math.max(a, 201); i < b; i++) { e *= en ? I.P[i] / I.P[i - 1] : 1; const j = i, f = I.f[j]; if (f == null) continue; const sube = I.e20[j] > I.e50[j];
    let q;
    if (en) q = f > 25 && sube;
    else { q = f >= 55 && sube; if (cfg.rec && porEMA && sube && f >= cfg.rec) q = true;
      if (q && cfg.rs) { const b0 = bt.get(I.T[j - cfg.rs]), b1 = bt.get(I.T[j]); if (b0 && b1 && I.P[j] / I.P[j - cfg.rs] < b1 / b0) q = false; } }
    if (q !== en) { if (!q) porEMA = f > 25; else porEMA = false; e *= 1 - 0.00075; ops++; en = q; }
    mx = Math.max(mx, e); dd = Math.max(dd, 1 - e / mx); }
  return { e, dd, ops }; }
const pc = x => ((x - 1) * 100).toFixed(0) + "%";
const V = [["actual", {}]]; for (const rs of [20, 30, 60, 90]) V.push(["fuerza vs BTC " + rs + "d", { rs }]); for (const rec of [35, 40, 45, 50]) V.push(["recompra rápida F&G>=" + rec, { rec }]);
const tot = {};
for (const m of ["BNB","BTC","ETH","SOL","XRP","DOGE","ADA"]) { const I = preparar(m), ix = d => { const k = I.T.findIndex(t => t >= Date.parse(d)); return k < 0 ? I.P.length : k; };
  if (m === "BNB") console.log("BNB".padEnd(30), per.map(p => p[0].padStart(20)).join(""));
  for (const [n, c] of V) { const r = per.map(([, a, b]) => corre(I, c, ix(a), ix(b))); tot[n] = tot[n] || [0, 0, 0]; if (m !== "BNB") r.forEach((x, k) => tot[n][k] += Math.log(x.e) / 6);
    if (m === "BNB") console.log(n.padEnd(30), r.map(x => (pc(x.e) + " b" + (x.dd * 100).toFixed(0) + " " + x.ops + "op").padStart(20)).join("")); } }
console.log("\\nOtras 6 monedas (típico)"); for (const [n, v] of Object.entries(tot)) console.log(n.padEnd(30), v.map(x => pc(Math.exp(x)).padStart(20)).join(""));
`);
