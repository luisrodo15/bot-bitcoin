// Indicadores de TradingView (EMA, RSI) y combinación con el índice de miedo y codicia, en precios diarios.
const fs = require("fs"), D = "diarios";
const fg = new Map(JSON.parse(fs.readFileSync(`${D}/miedo-codicia.json`)).data.map(x => [Math.floor(+x.timestamp / 86400) * 86400e3, +x.value]));
const FEE = 0.001, CORTE = Date.parse("2023-01-01"), ANIO = Date.parse("2025-10-01");
const ema = (P, n) => { const k = 2 / (n + 1), o = []; P.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const rsi = (P, n = 14) => { const o = [50]; let g = 0, l = 0; for (let i = 1; i < P.length; i++) { const d = P[i] - P[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; o.push(l ? 100 - 100 / (1 + g / l) : 100); } return o; };
const M = {};
for (const m of "BTC,ETH,SOL,BNB,XRP,DOGE,ADA".split(",")) {
  const L = fs.readFileSync(`${D}/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(","));
  const T = L.map(c => Math.floor(+c[0] / 864e5) * 864e5), P = L.map(c => +c[4]);
  M[m] = { T, P, e20: ema(P, 20), e50: ema(P, 50), e200: ema(P, 200), r: rsi(P), f: T.map(t => fg.get(t)) };
}
function corre(S, regla, a, b) { let u = 1, q = 0, mx = 1, dd = 0, ops = 0;
  for (let i = Math.max(a, 60); i < b; i++) { const p = S.P[i], w = regla(S, i, q > 0); if (w == null) continue;
    if (w && !q) { q = u * (1 - FEE) / p; u = 0; ops++; } else if (!w && q) { u = q * p * (1 - FEE); q = 0; ops++; }
    const eq = u + q * p; mx = Math.max(mx, eq); dd = Math.max(dd, 1 - eq / mx); }
  return { x: u + q * S.P[b - 1], dd, ops }; }
const idx = (S, t) => { const i = S.T.findIndex(x => x >= t); return i < 0 ? S.P.length : i; };
const R = {
  "Solo guardar": () => true,
  "EMA20 sobre EMA50": (S, i) => S.e20[i] > S.e50[i],
  "Precio sobre EMA50": (S, i) => S.P[i] > S.e50[i],
  "Precio sobre EMA200": (S, i) => S.P[i] > S.e200[i],
  "RSI: compra <30, vende >70": (S, i, en) => en ? S.r[i] < 70 : S.r[i] < 30,
  "RSI: compra >55, vende <45": (S, i, en) => en ? S.r[i] > 45 : S.r[i] > 55,
  "Miedo/codicia 55/30": (S, i, en) => S.f[i] == null ? null : en ? S.f[i] > 30 : S.f[i] >= 55,
  "Miedo/codicia 55/30 + EMA20>EMA50": (S, i, en) => S.f[i] == null ? null : en ? (S.f[i] > 30 && S.e20[i] > S.e50[i]) : (S.f[i] >= 55 && S.e20[i] > S.e50[i]),
  "Miedo/codicia 55/30 o EMA20>EMA50 (ambas para entrar)": (S, i, en) => S.f[i] == null ? null : en ? (S.f[i] > 30 || S.e20[i] > S.e50[i]) : (S.f[i] >= 55 && S.e20[i] > S.e50[i]),
};
const pct = x => ((x - 1) * 100).toFixed(0).padStart(5) + "%";
for (const [per, a0, nom] of [[0, Date.parse("2018-03-01"), "2018-2022 (sin usar para elegir nada)"], [1, CORTE, "2023-hoy"], [2, ANIO, "último año (oct 2025-hoy)"]]) {
  console.log(`\n== ${nom}`);
  for (const [n, f] of Object.entries(R)) {
    const r = Object.values(M).map(S => corre(S, f, idx(S, a0), per === 0 ? idx(S, CORTE) : S.P.length));
    console.log(n.padEnd(52), Object.keys(M).map((m, j) => `${m}${pct(r[j].x)}`).join(" "), "| bajón máx prom", (r.reduce((s, x) => s + x.dd, 0) / 7 * 100).toFixed(0) + "%", "| ops", r[0].ops);
  }
}
const f = R["Miedo/codicia 55/30 + EMA20>EMA50"], S = M.BTC;
for (let y = 2018; y <= 2026; y++) { const a = idx(S, Date.parse(`${y}-01-01`)), b = idx(S, Date.parse(`${y + 1}-01-01`)); const r = corre(S, f, a, b), h = corre(S, () => true, a, b); console.log(`BTC ${y}: estrategia ${pct(r.x)} (${r.ops} ops, bajón ${(r.dd*100).toFixed(0)}%)  guardar ${pct(h.x)}`); }
