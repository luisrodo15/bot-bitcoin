// Video "Cómo ganar 10 dólares todos los días" (2026-10-15): futuros, gráfica de 5 min con Bollinger (20,2) y RSI.
// Compra (long) cuando una vela de 5 min cae fuerte bajo la banda de abajo con RSI bajo; pone otra compra más abajo
// (escalera) y cierra con +1-2%. Cuenta de ~1,600 USDT y posiciones de ~100-200 USDT (10x-20x cruzado, sin stop).
// Aquí: cada entrada = F de la cuenta, hasta 3 escalones (−S% cada uno), salida a +TP% del promedio; stop opcional.
// Comisión 0.02% por lado (órdenes limit, maker) y 0.05% en stop. Datos de 1 min, último año.
const fs = require("fs"), zlib = require("zlib"), DIA = 864e5;
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
function velas(m, min) { const o = []; let cur = null; for (const l of zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n")) { const c = l.split(",").map(Number), t = Math.floor(c[0] / (min * 6e4)) * min * 6e4;
  if (!cur || cur.t !== t) { cur && o.push(cur); cur = { t, o: c[1], h: c[2], l: c[3], c: c[4] }; } else { cur.h = Math.max(cur.h, c[2]); cur.l = Math.min(cur.l, c[3]); cur.c = c[4]; } } o.push(cur); return o; }
function ind(V) { const P = V.map(v => v.c), n = 20, lo = [], R = [50]; let g = 0, l = 0;
  for (let i = 0; i < P.length; i++) { if (i >= n - 1) { const s = P.slice(i - n + 1, i + 1), m = s.reduce((a, b) => a + b) / n, sd = Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / n); lo.push(m - 2 * sd); } else lo.push(NaN);
    if (i) { const d = P[i] - P[i - 1]; g = (g * 13 + Math.max(d, 0)) / 14; l = (l * 13 + Math.max(-d, 0)) / 14; R.push(l ? 100 - 100 / (1 + g / l) : 100); } }
  const E1 = ema(P, 12 * 50), E2 = ema(P, 12 * 200);   // tendencia: EMA 50 y 200 de 1h aprox. en velas de 5 min
  return { lo, R, E1, E2 }; }
function corre(V, I, o, a, b) { const { F = 0.06, S = 0.015, TP = 0.01, N = 3, stop = 0, rsi = 30, tend = false, caida = 0 } = o;
  let eq = 1, mx = 1, dd = 0, pos = [], ops = 0, gan = 0, per = 0, peor = 0, dias = new Map();
  const FM = 0.0002, FT = 0.0005;
  for (let i = 30; i < V.length; i++) { const v = V[i]; if (v.t < a || v.t >= b) continue;
    if (pos.length) { const q = pos.reduce((s, p) => s + p.q, 0), avg = pos.reduce((s, p) => s + p.q * p.p, 0) / q;
      // escalones pendientes
      while (pos.length < N && v.l <= pos[0].p * (1 - S * pos.length)) { const p = pos[0].p * (1 - S * pos.length); pos.push({ p, q: F * eq / p }); eq -= F * eq * FM; }
      const q2 = pos.reduce((s, p) => s + p.q, 0), avg2 = pos.reduce((s, p) => s + p.q * p.p, 0) / q2;
      let sal = 0, f = FM; if (stop && v.l <= avg2 * (1 - stop)) { sal = avg2 * (1 - stop); f = FT; } else if (v.h >= avg2 * (1 + TP)) sal = avg2 * (1 + TP);
      if (sal) { const r = q2 * (sal - avg2) - q2 * sal * f; eq += r; ops++; r > 0 ? gan++ : per++; peor = Math.min(peor, r / eq); const d = Math.floor(v.t / DIA); dias.set(d, (dias.get(d) || 0) + r); pos = []; }
      const val = eq + (pos.length ? pos.reduce((s, p) => s + p.q * (v.l - p.p), 0) : 0); mx = Math.max(mx, eq); dd = Math.max(dd, 1 - val / mx);
      if (val <= 0) return { eq: 0, dd: 1, ops, gan, per, peor, liq: 1 };
      continue; }
    const caeFuerte = caida ? v.c <= V[i - 1].c * (1 - caida) : true;
    if (v.c < I.lo[i] && I.R[i] < rsi && caeFuerte && (!tend || I.E1[i] > I.E2[i])) { pos = [{ p: v.c, q: F * eq / v.c }]; eq -= F * eq * FM; }
    mx = Math.max(mx, eq); }
  let last = null; for (let i = V.length - 1; i >= 0; i--) if (V[i].t < b) { last = V[i]; break; }
  const abierta = pos.length ? pos.reduce((s, p) => s + p.q * (last.c - p.p), 0) : 0;
  const ds = [...dias.values()]; return { eq: eq + abierta, ab: abierta, dd, ops, gan, per, peor, diasPos: ds.filter(x => x > 0).length, diasNeg: ds.filter(x => x < 0).length }; }
const pc = x => ((x - 1) * 100).toFixed(1) + "%";
const MON = (process.argv[3] || "BTC,ETH,SOL,BNB,XRP,DOGE,ADA").split(",");
const C = [["video: TP1% esc1.5% sin stop", {}], ["TP2%", { TP: 0.02 }], ["TP1% esc3%", { S: 0.03 }], ["+ stop 5%", { stop: 0.05 }], ["+ stop 3%", { stop: 0.03 }],
  ["+ tendencia 1h", { tend: true }], ["+ tendencia + stop5", { tend: true, stop: 0.05 }], ["RSI<20", { rsi: 20 }], ["caída >2% en 5min", { caida: 0.02, rsi: 100 }],
  ["toda la cuenta (F=33%)", { F: 0.33 }]];
for (const m of MON) { const V = velas(m, 5), I = ind(V), ini = V[0].t, fin = V.at(-1).t + 1, mid = ini + (fin - ini) / 2;
  console.log(`\n== ${m} 5m (guardar: 1a ${pc(V.find(v => v.t >= mid).c / V[0].c)} 2a ${pc(V.at(-1).c / V.find(v => v.t >= mid).c)})   año | 1a mitad | 2a mitad`);
  for (const [n, o] of C) { const r = [[ini, fin], [ini, mid], [mid, fin]].map(([a, b]) => corre(V, I, o, a, b));
    console.log(n.padEnd(30), r.map(x => `${pc(x.eq)} caída${(x.dd * 100).toFixed(0)}% ${x.gan}+/${x.per}- peor${(x.peor * 100).toFixed(1)}%${x.ab ? " abierta" + (x.ab * 100).toFixed(1) + "%" : ""}${x.liq ? " QUIEBRA" : ""}`.padEnd(42)).join("")); } }
