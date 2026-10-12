// ¿Hay estrategias que ganen cada semana o cada mes? Velas de 1h y 4h (12 meses), elige parámetros en los
// primeros 6 meses y mide en los últimos 6 (sin ver el futuro). Llenado pesimista: compra/vende al cierre + comisión.
const fs = require("fs"), zlib = require("zlib");
const FEE = +process.argv[2] || 0.001, MON = ["BTC","ETH","BNB","SOL","XRP","DOGE","ADA"];
function velas(m, h) { const L = zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n"), o = []; let cur = null;
  for (const l of L) { const c = l.split(","), t = Math.floor(+c[0] / (h * 36e5)); if (!cur || cur.t !== t) { cur && o.push(cur); cur = { t, o: +c[1], h: +c[2], l: +c[3], c: +c[4] }; } else { cur.h = Math.max(cur.h, +c[2]); cur.l = Math.min(cur.l, +c[3]); cur.c = +c[4]; } }
  o.push(cur); return o; }
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const rsiF = (P, n) => { const o = [50]; let g = 0, l = 0; for (let i = 1; i < P.length; i++) { const d = P[i] - P[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; o.push(l ? 100 - 100 / (1 + g / l) : 100); } return o; };
const sd = (P, n) => P.map((_, i) => { if (i < n) return NaN; const s = P.slice(i - n + 1, i + 1), m = s.reduce((a, b) => a + b) / n; return [m, Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / n)]; });
// familias de estrategias con parámetros
const FAM = {
  "cruce de EMAs": [[5,20],[10,30],[20,50],[9,21],[12,26]].map(([a,b]) => ({ p: `${a}/${b}`, f: V => { const P = V.map(v => v.c), A = ema(P, a), B = ema(P, b); return (i, en) => A[i] > B[i]; } })),
  "RSI rebote (compra en sobreventa)": [[25,50],[30,50],[30,60],[20,55],[35,55]].flatMap(([x,y]) => [14,7].map(n => ({ p: `${n}:${x}/${y}`, f: V => { const R = rsiF(V.map(v => v.c), n); return (i, en) => en ? R[i] < y : R[i] < x; } }))),
  "Bollinger rebote": [[20,2],[20,2.5],[50,2],[20,1.5]].map(([n,k]) => ({ p: `${n}/${k}`, f: V => { const P = V.map(v => v.c), S = sd(P, n); return (i, en) => { if (!S[i].length) return false; const [m, s] = S[i]; return en ? P[i] < m : P[i] < m - k * s; }; } })),
  "ruptura de máximos": [[24,12],[48,24],[72,24],[120,48]].map(([a,b]) => ({ p: `${a}/${b}`, f: V => (i, en) => { if (i < a) return false; const w = V.slice(i - (en ? b : a), i); return en ? V[i].c > Math.min(...w.map(v => v.l)) : V[i].c > Math.max(...w.map(v => v.h)); } })),
  "compra caída, vende rebote": [[2,1.5],[3,2],[5,3],[4,4],[8,4]].map(([d,u]) => ({ p: `-${d}%/+${u}%`, f: V => { let ref = V[0].c, ent = 0; return (i, en) => { if (en) { if (V[i].c >= ent * (1 + u / 100) || V[i].c <= ent * (1 - 2 * d / 100)) { ref = V[i].c; return false; } return true; } ref = Math.max(ref, V[i].c); if (V[i].c <= ref * (1 - d / 100)) { ent = V[i].c; return true; } return false; }; } })),
};
function corre(V, regla, a, b) { const sem = new Map(); let e = 1, en = false, ops = 0, mx = 1, dd = 0;
  for (let i = a; i < b; i++) { let r = en ? V[i].c / V[i - 1].c - 1 : 0; const q = !!regla(i, en); if (q !== en) { r -= FEE; ops++; en = q; } e *= 1 + r; mx = Math.max(mx, e); dd = Math.max(dd, 1 - e / mx);
    const w = Math.floor(V[i].t * HH / 168); sem.set(w, (sem.get(w) || 1) * (1 + r)); }
  const W = [...sem.values()]; return { e, ops, dd, gan: W.filter(x => x > 1.0001).length, per: W.filter(x => x < 0.9999).length, W }; }
let HH; const res = [];
for (const h of [1, 4]) { HH = h;
  for (const m of MON) { const V = velas(m, h), mid = Math.floor(V.length / 2);
    const hold = corre(V, () => true, mid, V.length);
    for (const [fam, L] of Object.entries(FAM)) {
      // entrena: elige el mejor parámetro en la primera mitad
      const ent = L.map(x => ({ x, r: corre(V, x.f(V), 130, mid) })).sort((p, q) => q.r.e - p.r.e)[0];
      const t = corre(V, ent.x.f(V), mid, V.length);
      res.push({ h, m, fam, p: ent.x.p, ent: ent.r.e, e: t.e, ops: t.ops, gan: t.gan, per: t.per, hold: hold.e, dd: t.dd });
    } } }
const pc = x => ((x - 1) * 100).toFixed(1) + "%";
for (const h of [1, 4]) { console.log(`\n== Velas de ${h}h, comisión ${FEE * 100}% (prueba = últimos 6 meses)`);
  for (const fam of Object.keys(FAM)) { const R = res.filter(r => r.h === h && r.fam === fam);
    console.log(fam.padEnd(34), R.map(r => `${r.m} ${pc(r.e)} (${r.gan}+/${r.per}-)`).join("  "));
    const pos = R.filter(r => r.e > 1).length, wg = R.reduce((a, r) => a + r.gan, 0), wp = R.reduce((a, r) => a + r.per, 0);
    console.log("".padEnd(34), `ganó en ${pos}/7 monedas; semanas con ganancia ${wg}, con pérdida ${wp}; operaciones promedio ${(R.reduce((a, r) => a + r.ops, 0) / 7).toFixed(0)}`); } }
console.log("\nGuardar (últimos 6 meses):", MON.map(m => `${m} ${pc(res.find(r => r.m === m).hold)}`).join("  "));
