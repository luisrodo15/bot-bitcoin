// Futuros con poco dinero: velas de 4h, largo y corto, apalancamiento L, stop S (fracción de precio), comisión 0.05% por lado,
// funding 0.01% cada 8h (se cobra siempre, conservador). Liquidación si la pérdida llega al margen. Todo el capital de margen.
const fs = require("fs"), zlib = require("zlib"), H4 = 144e5, FEE = 0.0005; let FUND = 0.0001 / 2; // por vela de 4h
function velas(m) {
  if (/D$/.test(m)) { FUND = 0.0003; return fs.readFileSync(`diarios/${m.slice(0, -1)}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").slice(0, 5).map(Number)); }
  if (m === "BTCL") return fs.readFileSync("diarios/BTCUSDT-4h.csv", "utf8").trim().split("\n").map(l => l.split(",").map(Number));
  const M = zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n").map(l => l.split(",").map(Number));
  const C = []; for (const [t, o, h, l, c] of M) { const k = Math.floor(t / H4) * H4, u = C[C.length - 1]; if (u && u[0] === k) { u[2] = Math.max(u[2], h); u[3] = Math.min(u[3], l); u[4] = c; } else C.push([k, o, h, l, c]); } return C;
}
const sma = (A, n) => A.map((_, i) => i < n - 1 ? null : A.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n);
function corre(C, tipo, N, L, S, a, b) {
  const cl = C.map(c => c[4]), ma = tipo === "sma" ? sma(cl, N) : null;
  let ult = 0, eq = 1, pos = 0, ent = 0, max = 1, dd = 0, ops = 0, bloq = 0;
  for (let i = N + 1; i < C.length; i++) { const [t, o, h, l, c] = C[i]; if (t < a || t >= b) continue; ult = C[i][4];
    // señal con la vela anterior cerrada
    let sig;
    if (tipo === "sma") sig = cl[i - 1] > ma[i - 1] ? 1 : -1;
    else { let hi = -Infinity, lo = Infinity; for (let k = i - 1 - N; k < i - 1; k++) { hi = Math.max(hi, C[k][2]); lo = Math.min(lo, C[k][3]); } sig = cl[i - 1] > hi ? 1 : cl[i - 1] < lo ? -1 : pos || bloq; }
    if (bloq && sig === bloq) sig = 0; else bloq = 0; // después de un stop, espera a que cambie la señal
    if (sig !== pos) { if (pos) { eq *= 1 + pos * (o / ent - 1) * L; eq -= eq * FEE * L; ops++; } pos = sig; if (pos) { ent = o; eq -= eq * FEE * L; } }
    if (pos) { eq -= eq * FUND * L;
      const peor = pos > 0 ? l / ent - 1 : 1 - h / ent, liq = -1 / L * 0.9;
      const tope = S ? -S : -Infinity;
      if (peor <= Math.max(liq, tope)) { const r = Math.max(liq, tope); eq *= 1 + r * L; eq -= eq * FEE * L; ops++; bloq = pos; pos = 0; }
      else { const r = pos * (c / ent - 1); max = Math.max(max, eq * (1 + r * L)); dd = Math.max(dd, 1 - eq * (1 + r * L) / max); } }
    if (eq <= 0.01) return { eq: 0, dd: 1, ops };
  }
  if (pos) { eq *= 1 + pos * (ult / ent - 1) * L; eq -= eq * FEE * L; }
  return { eq, dd, ops };
}
const m = process.argv[2] || "BTC", C = velas(m), ini = C[0][0], fin = C[C.length - 1][0] + H4;
const per = /D$/.test(m) ? [0, 1, 2].map(k => [ini + (fin - ini) * k / 3, ini + (fin - ini) * (k + 1) / 3]) : m === "BTCL" ? [[Date.UTC(2018,0,1),Date.UTC(2020,0,1)],[Date.UTC(2020,0,1),Date.UTC(2022,0,1)],[Date.UTC(2022,0,1),Date.UTC(2024,0,1)],[Date.UTC(2024,0,1),fin]] : [[ini, ini + (fin - ini) / 2], [ini + (fin - ini) / 2, fin]];
if (process.env.UNO) { const [t,N,L,S]=process.env.UNO.split(","); console.log(per.map(([a,b])=>JSON.stringify(corre(C,t,+N,+L,+S,a,b)))); process.exit(); }
const R = [];
for (const tipo of ["sma", "don"]) for (const N of tipo === "sma" ? [50, 100, 200, 300] : [20, 55, 100]) for (const L of [1, 2, 3, 5]) for (const S of [0, 0.03, 0.05, 0.1]) {
  const r = per.map(([a, b]) => corre(C, tipo, N, L, S, a, b)); R.push({ k: `${tipo}${N} ${L}x stop${S * 100}%`, r, min: Math.min(...r.map(x => x.eq)), tot: r.reduce((a, x) => a * x.eq, 1) }); }
R.sort((x, y) => y.min - x.min);
console.log(m, "periodos:", per.length, "(mejores por el PEOR periodo)");
for (const x of R.slice(0, 8)) console.log(x.k.padEnd(22), x.r.map(z => `${((z.eq - 1) * 100).toFixed(0)}% dd${(z.dd * 100).toFixed(0)}% ${z.ops}op`.padEnd(22)).join(""), "total", ((x.tot - 1) * 100).toFixed(0) + "%");
