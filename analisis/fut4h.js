// Estrategias populares de futuros para BTC (internet: Coinquant, KuCoin, XT), largo y corto, 1x y 2x.
// Velas diarias desde 2018 y velas de 4h/1h del último año (datos de 1 minuto). Entra al cierre de la vela de señal.
// Comisión 0.05% por lado, financiamiento real de BTC (largos pagan, cortos cobran), liquidación si toca 95%/lev.
// Mide en USDT y en cantidad de BTC (contra guardar BTC).
const fs = require("fs"), zlib = require("zlib"), DIA = 864e5, FEE = 0.0005;
const fund = new Map(); for (const l of fs.readFileSync("ballenas/financiacion.csv", "utf8").trim().split("\n")) { const c = l.split(","), d = Math.floor(+c[0] / DIA); fund.set(d, (fund.get(d) || 0) + +c[2]); }
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const sma = (A, n) => A.map((_, i) => i < n - 1 ? NaN : A.slice(i - n + 1, i + 1).reduce((a, b) => a + b) / n);
const rsi = (P, n = 14) => { const o = [50]; let g = 0, l = 0; for (let i = 1; i < P.length; i++) { const d = P[i] - P[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; o.push(l ? 100 - 100 / (1 + g / l) : 100); } return o; };
const atr = (V, n) => { const tr = V.map((v, i) => i ? Math.max(v.h - v.l, Math.abs(v.h - V[i - 1].c), Math.abs(v.l - V[i - 1].c)) : v.h - v.l); return ema(tr, 2 * n - 1); };
function supertrend(V, n, k) { const A = atr(V, n), o = []; let up = 0, dn = 0, dir = 1;
  V.forEach((v, i) => { const m = (v.h + v.l) / 2, u = m - k * A[i], d = m + k * A[i];
    up = i && V[i - 1].c > up ? Math.max(u, up) : u; dn = i && V[i - 1].c < dn ? Math.min(d, dn) : d;
    if (dir > 0 && v.c < up) dir = -1; else if (dir < 0 && v.c > dn) dir = 1; o.push(dir); }); return o; }
const maxH = (V, i, n) => Math.max(...V.slice(i - n, i).map(v => v.h)), minL = (V, i, n) => Math.min(...V.slice(i - n, i).map(v => v.l));
// cada estrategia regresa una función (i, pos) -> posición deseada (+1, -1, 0); "lc" = largo y corto, "l" = solo largo
const EST = {
  "Donchian N": (V, n) => { return (i, p) => i < n ? 0 : V[i].c > maxH(V, i, n) ? 1 : V[i].c < minL(V, i, n) ? -1 : p; },
  "SMA N": (V, n) => { const S = sma(V.map(v => v.c), n); return (i, p) => isNaN(S[i]) ? 0 : V[i].c > S[i] ? 1 : -1; },
  "EMA 20/50": (V) => { const P = V.map(v => v.c), A = ema(P, 20), B = ema(P, 50); return i => i < 50 ? 0 : A[i] > B[i] ? 1 : -1; },
  "EMA 9/21 + RSI50": (V) => { const P = V.map(v => v.c), A = ema(P, 9), B = ema(P, 21), R = rsi(P); return (i, p) => i < 21 ? 0 : A[i] > B[i] && R[i] > 50 ? 1 : A[i] < B[i] && R[i] < 50 ? -1 : p; },
  "Supertrend N/3": (V, n) => { const S = supertrend(V, n, 3); return i => i < n ? 0 : S[i]; },
  "Squeeze BB": (V) => { const P = V.map(v => v.c), M = sma(P, 20); const W = P.map((_, i) => { if (i < 19) return NaN; const s = P.slice(i - 19, i + 1), m = M[i]; return 4 * Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / 20) / m; });
    return (i, p) => { if (i < 140) return 0; const ws = W.slice(i - 120, i).filter(x => !isNaN(x)).sort((a, b) => a - b), bajo = W[i - 1] <= ws[Math.floor(ws.length * 0.2)];
      const sd = W[i] * M[i] / 4; if (bajo && P[i] > M[i] + 2 * sd) return 1; if (bajo && P[i] < M[i] - 2 * sd) return -1; if (p > 0 && P[i] < M[i]) return 0; if (p < 0 && P[i] > M[i]) return 0; return p; }; },
  "Bot actual (miedo+EMA) +corto": (V) => { const P = V.map(v => v.c), A = ema(P, 20), B = ema(P, 50); let sen = false;
    return (i, p) => { const f = fg.get(Math.floor(V[i].t / DIA)); if (f == null || i < 50) return p; const sube = A[i] > B[i]; sen = sen ? (f > 25 && sube) : (f >= 55 && sube); return sen ? 1 : !sube ? -1 : 0; }; },
};
function corre(V, regla, modo, lev, a, b, porDia) {
  let e = 1, pos = 0, ent = 0, mx = 1, dd = 0, liq = 0, ops = 0, p0 = 0, pf = 0;
  for (let i = 1; i < V.length; i++) { const v = V[i]; if (v.t < a || v.t >= b) continue; if (!p0) p0 = V[i - 1].c; pf = v.c;
    if (pos) { const liqP = pos > 0 ? ent * (1 - 0.95 / lev) : ent * (1 + 0.95 / lev);
      if ((pos > 0 && v.l <= liqP) || (pos < 0 && v.h >= liqP)) { e *= 0.05; liq++; pos = 0; }
      else { e *= 1 + pos * lev * (v.c / V[i - 1].c - 1); e *= 1 - pos * lev * (fund.get(Math.floor(v.t / DIA)) || 0) / porDia; ent = ent; } }
    let q = regla(i, pos); if (modo === "l" && q < 0) q = 0;
    if (q !== pos) { e *= 1 - FEE * lev * ((pos ? 1 : 0) + (q ? 1 : 0)); pos = q; ent = v.c; ops++; }
    // recalcula entrada para la liquidación como si el precio de referencia fuera el cierre anterior (aprox.)
    if (pos) ent = v.c; mx = Math.max(mx, e); dd = Math.max(dd, 1 - e / mx); }
  return { e, btc: e * p0 / pf, dd, liq, ops, hold: pf / p0 }; }
const pc = x => ((x - 1) * 100).toFixed(0) + "%";
function velas(h) { const o = []; let cur = null; for (const l of zlib.gunzipSync(fs.readFileSync("datos/BTCUSDT.csv.gz")).toString().trim().split("\n")) { const c = l.split(",").map(Number), t = Math.floor(c[0] / (h * 36e5)) * h * 36e5;
  if (!cur || cur.t !== t) { cur && o.push(cur); cur = { t, o: c[1], h: c[2], l: c[3], c: c[4] }; } else { cur.h = Math.max(cur.h, c[2]); cur.l = Math.min(cur.l, c[3]); cur.c = c[4]; } } o.push(cur); return o; }
const VD = fs.readFileSync("diarios/BTCUSDT-1d.csv", "utf8").trim().split("\n").map(l => { const c = l.split(",").map(Number); return { t: c[0], o: c[1], h: c[2], l: c[3], c: c[4] }; });
const LIST = [["Donchian N", [10, 20, 30, 55]], ["SMA N", [50, 100, 200]], ["EMA 20/50", [0]], ["EMA 9/21 + RSI50", [0]], ["Supertrend N/3", [7, 10, 14]], ["Squeeze BB", [0]], ["Bot actual (miedo+EMA) +corto", [0]]];
function tabla(titulo, V, per, porDia, extra) {
  console.log(`\n=== ${titulo}   (cada celda: USDT / en BTC / caída máx)`); console.log("".padEnd(42), per.map(p => p[0].padEnd(28)).join(""));
  console.log("guardar BTC".padEnd(42), per.map(([, a, b]) => pc(corre(V, () => 1, "l", 1, a, b, porDia).hold).padEnd(28)).join(""));
  for (const [n, P] of LIST) { if (extra && n.startsWith("Bot")) continue; for (const k of P) for (const [modo, lev] of [["l", 1], ["lc", 1], ["lc", 2]]) {
    const r = per.map(([, a, b]) => corre(V, EST[n](V, k), modo, lev, a, b, porDia));
    console.log(`${n.replace("N", k)} ${modo === "l" ? "solo largo" : "largo+corto"} ${lev}x`.padEnd(42), r.map(x => `${pc(x.e)} / ${pc(x.btc)} / ${(x.dd * 100).toFixed(0)}%${x.liq ? " L" + x.liq : ""}`.padEnd(28)).join("")); } } }
const T = s => Date.parse(s);
const VL = fs.readFileSync("diarios/BTCUSDT-4h.csv", "utf8").trim().split("\n").map(l => { const c = l.split(",").map(Number); return { t: c[0], o: c[1], h: c[2], l: c[3], c: c[4] }; });
LIST.splice(0, LIST.length, ["Donchian N", [20, 30, 55, 80]], ["SMA N", [100, 150, 200, 300]], ["EMA 20/50", [0]], ["Squeeze BB", [0]]);
const PER = [["2020-2022", T("2020-01-01"), T("2023-01-01")], ["2023-2024", T("2023-01-01"), T("2025-01-01")], ["2025-hoy", T("2025-01-01"), T("2100-01-01")], ["oct25-hoy", T("2025-10-01"), T("2100-01-01")]];
tabla("4h desde 2020", VL, PER, 6, true);
