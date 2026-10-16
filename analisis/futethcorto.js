// Futuros con ~15 USDT: canasta de monedas con mínimo 5 USDT (XRP, ADA, DOGE), cada una con su margen aislado.
// Velas diarias, largo/corto Donchian o SMA, apalancamiento L, stop S. Comisión 0.05%/lado, funding 0.03%/día.
const fs = require("fs"), FEE = 0.0005, FUND = 0.0003, D = 864e5;
const load = m => fs.readFileSync(`${__dirname}/diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").slice(0, 5).map(Number));
const sma = (A, n) => A.map((_, i) => i < n - 1 ? null : A.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n);
function corre(C, tipo, N, L, S, a, b, soloLargo) {
  const cl = C.map(c => c[4]), ma = tipo === "sma" ? sma(cl, N) : null;
  let ult = 0, eq = 1, pos = 0, ent = 0, max = 1, dd = 0, ops = 0, bloq = 0;
  for (let i = N + 1; i < C.length; i++) { const [t, o, h, l, c] = C[i]; if (t < a || t >= b) continue; ult = c;
    let sig;
    if (tipo === "sma") sig = cl[i - 1] > ma[i - 1] ? 1 : -1;
    else { let hi = -Infinity, lo = Infinity; for (let k = i - 1 - N; k < i - 1; k++) { hi = Math.max(hi, C[k][2]); lo = Math.min(lo, C[k][3]); } sig = cl[i - 1] > hi ? 1 : cl[i - 1] < lo ? -1 : pos || bloq; }
    if (soloLargo && sig < 0) sig = 0;
    if (bloq && sig === bloq) sig = 0; else bloq = 0;
    if (sig !== pos) { if (pos) { eq *= 1 + pos * (o / ent - 1) * L; eq -= eq * FEE * L; ops++; } pos = sig; if (pos) { ent = o; eq -= eq * FEE * L; } }
    if (pos) { eq -= eq * FUND * L;
      const peor = pos > 0 ? l / ent - 1 : 1 - h / ent, liq = -1 / L * 0.9, tope = S ? -S : -Infinity;
      if (peor <= Math.max(liq, tope)) { const r = Math.max(liq, tope); eq *= 1 + r * L; eq -= eq * FEE * L; ops++; bloq = pos; pos = 0; }
      else { const v = eq * (1 + pos * (c / ent - 1) * L); max = Math.max(max, v); dd = Math.max(dd, 1 - v / max); } }
    if (eq <= 0.01) return { eq: 0, dd: 1, ops };
  }
  if (pos) { eq *= 1 + pos * (ult / ent - 1) * L; eq -= eq * FEE * L; }
  return { eq, dd, ops };
}
const C=load("ETH");const per=[[2018,1,2019,7],[2019,7,2021,7],[2021,7,2023,7],[2023,7,2025,7],[2025,7,2027,1]].map(([x,a,y,b])=>[Date.UTC(x,a-1,1),Date.UTC(y,b-1,1)]);
for(const N of [35,40,45,50,55,60,70])for(const L of [1,2,3])for(const S of [0.03,0.05,0.08]){const r=per.map(([a,b])=>corre(C,"sma",N,L,S,a,b,+process.env.SL));console.log(`sma${N} ${L}x stop${S*100}%`.padEnd(20),r.map(y=>`${((y.eq-1)*100).toFixed(0)}%(dd${(y.dd*100).toFixed(0)})`).join(" "))}
const cl=C.map(c=>c[4]),m=sma(cl,50);console.log("ultima",new Date(C.at(-1)[0]).toISOString().slice(0,10),cl.at(-1),"sma50",m.at(-1).toFixed(0));
