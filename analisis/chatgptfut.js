// Reglas de futuros que propuso ChatGPT, tal cual: tendencia con EMA50 vs EMA200 en 1h; entrada en 15 min cuando el precio
// retrocede (toca la EMA20 de 15m) y una vela cierra confirmando (arriba para largo, abajo para corto); stop = k×ATR14 de 15m,
// objetivo = 1.5× el riesgo; una sola posición; tras 2 pérdidas seguidas, pausa 24 h. Comisión futuros 0.05% + 0.02% deslizamiento por lado.
// Pesimista: si en la misma vela se tocan stop y objetivo, cuenta el stop. 12 meses de velas de 1 minuto.
const fs = require("fs"), zlib = require("zlib"), COSTO = 0.0007;
function velas(m, min) { const L = zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n"), o = []; let cur = null;
  for (const l of L) { const c = l.split(","), t = Math.floor(+c[0] / (min * 6e4)); if (!cur || cur.t !== t) { cur && o.push(cur); cur = { t, ms: +c[0], h: +c[2], l: +c[3], c: +c[4] }; } else { cur.h = Math.max(cur.h, +c[2]); cur.l = Math.min(cur.l, +c[3]); cur.c = +c[4]; } }
  o.push(cur); return o; }
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
function corre(m, k, rr, lev) { const V = velas(m, 15), P = V.map(v => v.c), e20 = ema(P, 20);
  const tr = V.map((v, i) => i ? Math.max(v.h - v.l, Math.abs(v.h - V[i - 1].c), Math.abs(v.l - V[i - 1].c)) : v.h - v.l), atr = ema(tr, 27); // ~ATR14 (Wilder)
  const H = velas(m, 60), PH = H.map(v => v.c), h50 = ema(PH, 50), h200 = ema(PH, 200), tend = new Map(); H.forEach((v, i) => tend.set(v.t, i > 200 ? Math.sign(h50[i] - h200[i]) : 0));
  let e = 1, pos = 0, ent = 0, stop = 0, obj = 0, seguidas = 0, pausa = 0, ops = 0, gan = 0, mx = 1, dd = 0;
  for (let i = 900; i < V.length; i++) { const v = V[i];
    if (pos) { const hitS = pos > 0 ? v.l <= stop : v.h >= stop, hitO = pos > 0 ? v.h >= obj : v.l <= obj;
      if (hitS || hitO) { const sal = hitS ? stop : obj, r = pos * (sal / ent - 1) * lev - 2 * COSTO * lev; e *= Math.max(0, 1 + r); ops++;
        if (r > 0) { gan++; seguidas = 0; } else if (++seguidas >= 2) { pausa = v.ms + 864e5; seguidas = 0; } pos = 0; } }
    else if (v.ms >= pausa) { const t = tend.get(Math.floor(v.ms / 36e5) - 1) || 0, prev = V[i - 1];
      if (t > 0 && prev.l <= e20[i - 1] && v.c > e20[i] && v.c > prev.h) { pos = 1; ent = v.c; stop = ent - k * atr[i]; obj = ent + rr * (ent - stop); }
      else if (t < 0 && prev.h >= e20[i - 1] && v.c < e20[i] && v.c < prev.l) { pos = -1; ent = v.c; stop = ent + k * atr[i]; obj = ent - rr * (stop - ent); }
      if (pos && Math.abs(obj / ent - 1) < 4 * COSTO) pos = 0; } // el objetivo debe cubrir comisiones
    mx = Math.max(mx, e); dd = Math.max(dd, 1 - e / mx); }
  return { e, ops, gan, dd, hold: V[V.length - 1].c / V[900].c }; }
const pc = x => ((x - 1) * 100).toFixed(1) + "%";
for (const m of ["ETH", "BTC", "SOL", "BNB"]) for (const [k, rr] of [[1.5, 1.5], [1, 1.5], [2, 1.5], [1.5, 2], [1.5, 1]]) for (const lev of [1, 3]) {
  const r = corre(m, k, rr, lev); console.log(m, `stop ${k}×ATR, objetivo ${rr}×, ${lev}x:`, pc(r.e), `| ${r.ops} operaciones, ${r.gan} ganadoras (${(100 * r.gan / r.ops).toFixed(0)}%), peor caída ${(r.dd * 100).toFixed(0)}% | guardar ${pc(r.hold)}`); }
