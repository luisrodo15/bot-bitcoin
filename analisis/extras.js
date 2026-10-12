// ¿Mejoran la estrategia (miedo/codicia + EMA20>EMA50) el RSI, MACD, financiación, ballenas y juntas de la Fed?
const fs = require("fs"), { FOMC } = require("./fomc.js");
const DIA = 864e5, FEE = 0.001;
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400) * DIA, +x.value]));
const L = fs.readFileSync("diarios/BTCUSDT-1d.csv", "utf8").trim().split("\n").map(l => l.split(","));
const T = L.map(c => Math.floor(+c[0] / DIA) * DIA), P = L.map(c => +c[4]);
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const e20 = ema(P, 20), e50 = ema(P, 50), m12 = ema(P, 12), m26 = ema(P, 26), macd = m12.map((x, i) => x - m26[i]), sig = ema(macd, 9);
const rsi = (() => { const o = [50]; let g = 0, l = 0; for (let i = 1; i < P.length; i++) { const d = P[i] - P[i - 1]; g = (g * 13 + Math.max(d, 0)) / 14; l = (l * 13 + Math.max(-d, 0)) / 14; o.push(l ? 100 - 100 / (1 + g / l) : 100); } return o; })();
// financiación: promedio de los últimos 3 días (9 pagos) hasta ese día
const fin = new Map(); { const F = fs.readFileSync("ballenas/financiacion.csv", "utf8").trim().split("\n").map(l => l.split(",")).map(c => [Math.floor(+c[0] / DIA) * DIA, +c[2]]); const byDay = new Map(); for (const [d, v] of F) byDay.set(d, [...(byDay.get(d) || []), v]); for (const t of T) { const v = []; for (let k = 0; k < 3; k++) v.push(...(byDay.get(t - k * DIA) || [])); if (v.length) fin.set(t, v.reduce((a, b) => a + b, 0) / v.length); } }
// ballenas: razón largo/corto de posiciones de los traders grandes, e interés abierto
const bal = new Map(); fs.readFileSync("ballenas/metricas.csv", "utf8").trim().split("\n").slice(1).forEach(l => { const c = l.split(","); bal.set(Date.parse(c[0].slice(0, 10)), { oi: +c[1], top: +c[4] }); });
const fomc = new Set(FOMC);
const base = (i, en) => { const f = fg.get(T[i]); if (f == null) return null; const up = e20[i] > e50[i]; return en ? (f > 30 && up) : (f >= 55 && up); };
const filtros = {
  "Base (miedo/codicia + EMA)": () => true,
  "+ RSI arriba de 50 para entrar": i => rsi[i] > 50,
  "+ MACD arriba de su señal para entrar": i => macd[i] > sig[i],
  "+ precio arriba de EMA20 y EMA50 para entrar": i => P[i] > e20[i] && P[i] > e50[i],
  "+ financiación no extrema (<0.03%) para entrar": i => !fin.has(T[i]) || fin.get(T[i]) < 0.0003,
  "+ financiación no extrema (<0.05%) para entrar": i => !fin.has(T[i]) || fin.get(T[i]) < 0.0005,
  "+ ballenas más largas que hace 7 días": i => { const a = bal.get(T[i]), b = bal.get(T[i] - 7 * DIA); return !a || !b || a.top >= b.top; },
  "+ ballenas en largo (razón > 1)": i => { const a = bal.get(T[i]); return !a || a.top > 1; },
  "+ interés abierto subiendo (7 días)": i => { const a = bal.get(T[i]), b = bal.get(T[i] - 7 * DIA); return !a || !b || a.oi >= b.oi; },
  "+ no entrar 2 días antes / día de la Fed": i => !(fomc.has(T[i]) || fomc.has(T[i] + DIA) || fomc.has(T[i] + 2 * DIA)),
};
function corre(filtro, a, b, salirTambien) { let u = 1, q = 0, mx = 1, dd = 0, ops = 0;
  for (let i = a; i < b; i++) { const w0 = base(i, q > 0); if (w0 == null) continue; let w = w0;
    if (!q && w) w = filtro(i); if (q && salirTambien && !filtro(i)) w = false;
    if (w && !q) { q = u * (1 - FEE) / P[i]; u = 0; ops++; } else if (!w && q) { u = q * P[i] * (1 - FEE); q = 0; ops++; }
    const eq = u + q * P[i]; mx = Math.max(mx, eq); dd = Math.max(dd, 1 - eq / mx); }
  return { x: u + q * P[b - 1], dd, ops }; }
const ix = d => T.findIndex(t => t >= Date.parse(d));
const per = [["2018-2021", ix("2018-02-01"), ix("2022-01-01")], ["2022-hoy (con ballenas)", ix("2022-01-01"), P.length], ["último año", ix("2025-10-01"), P.length]];
console.log("BTC. Columnas: " + per.map(p => p[0]).join(" | "));
for (const [n, f] of Object.entries(filtros)) console.log(n.padEnd(48), per.map(([, a, b]) => { const r = corre(f, a, b, false); return `${((r.x - 1) * 100).toFixed(0).padStart(5)}% (bajón ${(r.dd * 100).toFixed(0)}%, ${r.ops} ops)`; }).join(" | "));
