// La combinación de ChatGPT: 1) filtro de tendencia, 2) caída temporal + recuperación + confirmación,
// 3) solo opera si el objetivo cubre costos, 4) sale en objetivo, stop o si se rompe la tendencia.
// Velas de 15 min y 1 h, 12 meses. Elige parámetros en los primeros 6 meses, mide en los últimos 6.
const fs = require("fs"), zlib = require("zlib");
const COSTO = 0.001 + 0.0005; // comisión 0.1% + deslizamiento/diferencial 0.05% por lado
const MON = (process.argv[2] || "SOL,BTC,ETH,BNB,XRP,DOGE,ADA").split(",");
const BOLSA = process.argv[3] ? new Set(JSON.parse(fs.readFileSync(process.argv[3]))) : null; // días con bolsa de EUA "a favor"
function velas(m, min) { const L = zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n"), o = []; let cur = null;
  for (const l of L) { const c = l.split(","), t = Math.floor(+c[0] / (min * 6e4)); if (!cur || cur.t !== t) { cur && o.push(cur); cur = { t, ms: +c[0], h: +c[2], l: +c[3], c: +c[4] }; } else { cur.h = Math.max(cur.h, +c[2]); cur.l = Math.min(cur.l, +c[3]); cur.c = +c[4]; } }
  o.push(cur); return o; }
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const rsiF = (P, n) => { const o = [50]; let g = 0, l = 0; for (let i = 1; i < P.length; i++) { const d = P[i] - P[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; o.push(l ? 100 - 100 / (1 + g / l) : 100); } return o; };
function prep(V, min) { const P = V.map(v => v.c), porDia = 1440 / min;
  const tLento = ema(P, 50 * porDia), tRapido = ema(P, 20 * porDia); // tendencia diaria aprox. (EMA20 > EMA50 de días)
  return { P, porDia, tend: P.map((_, i) => tRapido[i] > tLento[i]), e20: ema(P, 20), rsi: rsiF(P, 14) }; }
function corre(V, X, p, a, b) { let e = 1, en = false, ent = 0, ops = 0, gan = 0, mx = 1, dd = 0; const sem = new Map(), { P, porDia } = X;
  const ventana = porDia; // máximo de las últimas 24 h
  for (let i = Math.max(a, 50 * porDia + 2); i < b; i++) { let r = en ? P[i] / P[i - 1] - 1 : 0;
    if (en) { const g = P[i] / ent - 1; if (g >= p.obj || g <= -p.stop || !X.tend[i]) { r -= COSTO; en = false; ops++; if (g > 2 * COSTO) gan++; } }
    else { let hi = 0; for (let k = i - ventana; k < i; k++) hi = Math.max(hi, V[k].h);
      const cayo = P[i - 1] <= hi * (1 - p.caida), recupera = P[i] > X.e20[i] && P[i - 1] <= X.e20[i - 1], confirma = X.rsi[i] > 40;
      const dia = new Date(V[i].ms).toISOString().slice(0, 10);
      if (X.tend[i] && cayo && recupera && confirma && p.obj > 2 * COSTO * 1.5 && (!BOLSA || BOLSA.has(dia))) { r -= COSTO; en = true; ent = P[i]; } }
    e *= 1 + r; mx = Math.max(mx, e); dd = Math.max(dd, 1 - e / mx); const w = Math.floor(V[i].ms / 6048e5); sem.set(w, (sem.get(w) || 1) * (1 + r)); }
  const W = [...sem.values()]; return { e, ops, gan, dd, sg: W.filter(x => x > 1.0001).length, sp: W.filter(x => x < 0.9999).length }; }
const OPC = []; for (const caida of [0.02, 0.03, 0.05, 0.08]) for (const obj of [0.01, 0.02, 0.03, 0.05, 0.08]) for (const stop of [0.02, 0.04, 0.08]) OPC.push({ caida, obj, stop });
const pc = x => ((x - 1) * 100).toFixed(1) + "%";
for (const min of [15, 60]) { console.log(`\n== velas de ${min} min${BOLSA ? " + filtro bolsa EUA" : ""}`);
  for (const m of MON) { const V = velas(m, min), X = prep(V, min), mid = Math.floor(V.length / 2);
    const R = OPC.map(p => ({ p, r: corre(V, X, p, 0, mid) })).sort((x, y) => y.r.e - x.r.e), best = R[0], t = corre(V, X, best.p, mid, V.length);
    const prom = OPC.map(p => corre(V, X, p, mid, V.length).e), pos = prom.filter(x => x > 1).length;
    console.log(m.padEnd(5), `mejor en entreno caída ${best.p.caida * 100}% obj ${best.p.obj * 100}% stop ${best.p.stop * 100}% (${pc(best.r.e)}, ${best.r.ops} ops)`,
      `-> prueba ${pc(t.e)}, ${t.ops} ops (${t.gan} ganadoras), semanas +${t.sg}/-${t.sp} | de ${OPC.length} ajustes, ${pos} ganan en prueba | guardar ${pc(V[V.length - 1].c / V[mid].c)}`); } }
