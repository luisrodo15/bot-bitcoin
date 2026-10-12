// Estilo "Neural Confluence Engine": suma de señales técnicas en velas de 4h (EMA, MACD, RSI, ADX/DI, impulso, tendencia diaria).
// Compra cuando hay al menos K señales a favor, vende cuando bajan de J. Elige K/J en los primeros 6 meses, mide en los últimos 6.
const fs = require("fs"), zlib = require("zlib"), FEE = 0.001, MON = ["BTC","ETH","BNB","SOL","XRP","DOGE","ADA"];
function velas(m, h) { const L = zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n"), o = []; let cur = null;
  for (const l of L) { const c = l.split(","), t = Math.floor(+c[0] / (h * 36e5)); if (!cur || cur.t !== t) { cur && o.push(cur); cur = { t, h: +c[2], l: +c[3], c: +c[4] }; } else { cur.h = Math.max(cur.h, +c[2]); cur.l = Math.min(cur.l, +c[3]); cur.c = +c[4]; } }
  o.push(cur); return o; }
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const rma = (A, n) => { const o = []; A.forEach((p, i) => o.push(i ? (o[i - 1] * (n - 1) + p) / n : p)); return o; };
function senales(V) { const P = V.map(v => v.c), e9 = ema(P, 9), e21 = ema(P, 21), e50 = ema(P, 50), e200 = ema(P, 200), e6d = ema(P, 120), e6d2 = ema(P, 300);
  const mc = ema(P, 12).map((x, i) => x - ema(P, 26)[i]), sg = ema(mc, 9);
  const d = P.map((p, i) => i ? p - P[i - 1] : 0), g = rma(d.map(x => Math.max(x, 0)), 14), l = rma(d.map(x => Math.max(-x, 0)), 14), rsi = g.map((x, i) => l[i] ? 100 - 100 / (1 + x / l[i]) : 100);
  const tr = V.map((v, i) => i ? Math.max(v.h - v.l, Math.abs(v.h - V[i - 1].c), Math.abs(v.l - V[i - 1].c)) : v.h - v.l);
  const pdm = V.map((v, i) => { if (!i) return 0; const u = v.h - V[i - 1].h, w = V[i - 1].l - v.l; return u > w && u > 0 ? u : 0; }), ndm = V.map((v, i) => { if (!i) return 0; const u = v.h - V[i - 1].h, w = V[i - 1].l - v.l; return w > u && w > 0 ? w : 0; });
  const atr = rma(tr, 14), pdi = rma(pdm, 14).map((x, i) => 100 * x / atr[i]), ndi = rma(ndm, 14).map((x, i) => 100 * x / atr[i]);
  const dx = pdi.map((x, i) => 100 * Math.abs(x - ndi[i]) / ((x + ndi[i]) || 1)), adx = rma(dx, 14);
  return P.map((p, i) => i < 300 ? null : [e9[i] > e21[i], p > e50[i], e50[i] > e200[i], mc[i] > sg[i], rsi[i] > 50, pdi[i] > ndi[i] && adx[i] > 20, p > P[i - 6], e6d[i] > e6d2[i]].filter(Boolean).length); }
function corre(V, S, K, J, a, b) { let e = 1, en = false, ops = 0; const sem = new Map();
  for (let i = Math.max(a, 301); i < b; i++) { let r = en ? V[i].c / V[i - 1].c - 1 : 0; const s = S[i - 1]; const q = en ? s >= J : s >= K; if (q !== en) { r -= FEE; ops++; en = q; } e *= 1 + r; const w = Math.floor(V[i].t * 4 / 168); sem.set(w, (sem.get(w) || 1) * (1 + r)); }
  const W = [...sem.values()]; return { e, ops, gan: W.filter(x => x > 1.0001).length, per: W.filter(x => x < 0.9999).length }; }
const pc = x => ((x - 1) * 100).toFixed(1) + "%"; let tg = 0, tp = 0;
if (process.argv[2]) { const [K, J] = process.argv[2].split("/").map(Number); for (const m of MON) { const V = velas(m, 4), S = senales(V), mid = Math.floor(V.length / 2), a = corre(V, S, K, J, 0, mid), b = corre(V, S, K, J, mid, V.length); console.log(m, K + "/" + J, "1a mitad", pc(a.e), a.ops, "ops | 2a mitad", pc(b.e), b.ops, "ops, semanas +" + b.gan + "/-" + b.per); } process.exit(); }
for (const m of MON) { const V = velas(m, 4), S = senales(V), mid = Math.floor(V.length / 2);
  const opc = []; for (let K = 4; K <= 8; K++) for (let J = 2; J <= K; J++) opc.push([K, J]);
  const best = opc.map(([K, J]) => ({ K, J, r: corre(V, S, K, J, 0, mid) })).sort((x, y) => y.r.e - x.r.e)[0];
  const t = corre(V, S, best.K, best.J, mid, V.length), h = V[V.length - 1].c / V[mid].c;
  tg += t.gan; tp += t.per;
  console.log(m.padEnd(5), `elegido ${best.K}/${best.J} (entreno ${pc(best.r.e)}) -> prueba ${pc(t.e)}, ${t.ops} operaciones, semanas +${t.gan}/-${t.per} | guardar ${pc(h)}`); }
console.log("total semanas con ganancia", tg, "con pérdida", tp);
