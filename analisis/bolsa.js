// ¿Ayuda la bolsa de EUA (S&P 500, Nasdaq, VIX = miedo de la bolsa) a la estrategia del bot?
// Se usa el cierre de la bolsa del día anterior (sin ver el futuro).
const fs = require("fs"); const src = fs.readFileSync("holly.js", "utf8").split("const pc =")[0].replace('const fs = require("fs"), ', "const ");
eval(src + `
function serie(f) { return fs.readFileSync("diarios/" + f, "utf8").trim().split("\\n").slice(1).map(l => l.split(",")).filter(c => c[1] && c[1] !== ".").map(c => [Date.parse(c[0]), +c[1]]); }
function alinear(S, T) { const o = []; let j = -1; for (const t of T) { while (j + 1 < S.length && S[j + 1][0] < t) j++; o.push(j >= 0 ? j : null); } return o; }
const sp = serie("SP500.csv"), nq = serie("NASDAQCOM.csv"), vx = serie("VIXCLS.csv");
const smaS = (S, n) => S.map((_, i) => i < n - 1 ? NaN : S.slice(i - n + 1, i + 1).reduce((a, b) => a + b[1], 0) / n);
const spM = smaS(sp, 50), nqM = smaS(nq, 50), nq200 = smaS(nq, 200), vxM = smaS(vx, 20);
const FILT = {
  "sin filtro": () => true,
  "S&P 500 arriba de su promedio 50d": (I, i) => { const j = I.sp[i]; return j == null || !(sp[j][1] < spM[j]); },
  "Nasdaq arriba de su promedio 50d": (I, i) => { const j = I.nq[i]; return j == null || !(nq[j][1] < nqM[j]); },
  "Nasdaq arriba de su promedio 200d": (I, i) => { const j = I.nq[i]; return j == null || !(nq[j][1] < nq200[j]); },
  "VIX (miedo bolsa) menor a 25": (I, i) => { const j = I.vx[i]; return j == null || vx[j][1] < 25; },
  "VIX menor a 20": (I, i) => { const j = I.vx[i]; return j == null || vx[j][1] < 20; },
  "VIX sin brinco (< 1.2x su promedio)": (I, i) => { const j = I.vx[i]; return j == null || !(vx[j][1] > 1.2 * vxM[j]); },
};
const per = [["2018-2022", "2018-03-01", "2023-01-01"], ["2023-hoy", "2023-01-01", "2100-01-01"], ["último año", "2025-10-01", "2100-01-01"]];
const base = EST[N[0]];
function corre(I, F, modo, a, b) { let e = 1, en = false, mx = 1, dd = 0, ops = 0;
  for (let i = Math.max(a, 201); i < b; i++) { let r = en ? I.P[i] / I.P[i - 1] - 1 : 0; e *= 1 + r;
    const w = base(I, i, en); if (w == null) continue; const f = F(I, i);
    const q = en ? (w && (modo === "entrada" || f)) : (w && f);
    if (q !== en) { e *= 1 - FEE; ops++; en = q; } mx = Math.max(mx, e); dd = Math.max(dd, 1 - e / mx); }
  return { e, dd, ops }; }
const pc = x => ((x - 1) * 100).toFixed(0) + "%";
const MON = (process.argv[2] || "SOL,BTC,ETH,BNB,XRP,DOGE,ADA").split(","); const tot = {};
for (const m of MON) { const I = preparar(m); I.sp = alinear(sp, I.T); I.nq = alinear(nq, I.T); I.vx = alinear(vx, I.T);
  const ix = d => { const k = I.T.findIndex(t => t >= Date.parse(d)); return k < 0 ? I.P.length : k; };
  console.log("\\n" + m.padEnd(46), per.map(p => p[0].padStart(22)).join(""));
  for (const [n, F] of Object.entries(FILT)) for (const modo of n === "sin filtro" ? ["entrada"] : ["entrada", "entrada y salida"]) {
    const r = per.map(([, a, b]) => corre(I, F, modo, ix(a), ix(b))), k = n + (n === "sin filtro" ? "" : " (" + modo + ")");
    tot[k] = tot[k] || [0, 0, 0]; r.forEach((x, q) => tot[k][q] += Math.log(x.e));
    console.log(k.padEnd(46), r.map(x => (pc(x.e) + " (bajón " + (x.dd * 100).toFixed(0) + "%)").padStart(22)).join("")); } }
console.log("\\nPromedio en las monedas (rendimiento típico):"); for (const [k, v] of Object.entries(tot)) console.log(k.padEnd(46), v.map(x => pc(Math.exp(x / MON.length)).padStart(22)).join(""));
`);
