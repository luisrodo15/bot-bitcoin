// Carry y tendencia en forex y oro, diario, sin apalancamiento (multiplica % y caídas por el apalancamiento que uses).
// Swap = diferencia de tasas a 3 meses (FRED) menos lo que se queda el broker (MARK %/año). Spread por cada cambio de posición.
const fs = require("fs"), D = process.env.DATOS || __dirname + "/forex/", MARK = +(process.env.MARK ?? 1.5);
const yh = n => { const r = JSON.parse(fs.readFileSync(D + "yahoo-" + n + ".json")).chart.result[0]; const o = []; r.timestamp.forEach((t, i) => { const c = r.indicators.quote[0].close[i]; if (c > 0) o.push([new Date(t * 1e3).toISOString().slice(0, 10), c]); }); return o; };
const fred = n => fs.readFileSync(D + n + ".csv", "utf8").trim().split("\n").slice(1).map(l => l.split(",")).filter(x => x[1] !== "." && x[1] !== "").map(([d, v]) => [d, +v]);
const tasaEn = s => { let k = 0; return d => { while (k + 1 < s.length && s[k + 1][0] <= d) k++; return s[k][1]; }; };
const R = { MXN: fred("IR3TIB01MXM156N"), JPY: fred("IR3TIB01JPM156N"), USD: fred("IR3TIB01USM156N"), EUR: fred("ECBDFR"), XAU: [["1990-01-01", 0]] };
// par: precio = cuántas COTIZADA por 1 BASE. Largo = tienes BASE y debes COTIZADA: cobras r_base - r_cot.
const PARES = { USDMXN: ["MXNX", "USD", "MXN", 0.0004], MXNJPY: ["MXNJPYX", "MXN", "JPY", 0.0005], USDJPY: ["JPYX", "USD", "JPY", 0.0001], EURUSD: ["EURUSDX", "EUR", "USD", 0.0001], XAUUSD: ["GCF", "XAU", "USD", 0.0003] };
function serie(par) { const [y, b, q, sp] = PARES[par], rb = tasaEn(R[b]), rq = tasaEn(R[q]); return { p: yh(y), dif: d => (rb(d) - rq(d)) / 100, sp }; }
const PER = [["2008-01-01", "2013-01-01"], ["2013-01-01", "2018-01-01"], ["2018-01-01", "2020-01-01"], ["2020-01-01", "2022-01-01"], ["2022-01-01", "2024-01-01"], ["2024-01-01", "2025-01-01"], ["2025-01-01", "2027-01-01"]];
// regla(i, cierres) -> 1 largo, -1 corto, 0 fuera, usando solo datos hasta el día i-1
function corre(S, regla, a, b) {
  const p = S.p, cl = S.cl || (S.cl = p.map(x => x[1])); let eq = 1, pos = 0, max = 1, dd = 0, ops = 0, swap = 0, dias = 0;
  for (let i = 201; i < p.length; i++) { const d = p[i][0]; if (d < a || d >= b) continue;
    const s = regla(i - 1, cl); if (s !== pos) { eq *= 1 - S.sp * Math.abs(s - pos); ops++; pos = s; }
    if (pos) { const dt = (Date.parse(d) - Date.parse(p[i - 1][0])) / 864e5, sw = (pos * S.dif(d) - MARK / 100) * dt / 365; swap += sw; eq *= 1 + pos * (cl[i] / cl[i - 1] - 1) + sw; dias++; }
    max = Math.max(max, eq); dd = Math.max(dd, 1 - eq / max); }
  return { eq, dd, ops, swap };
}
const smaC = new WeakMap(); const sma = (cl, n, i) => { const c0 = smaC.get(cl) || (smaC.set(cl, {}), smaC.get(cl)); const m = c0[n] || (c0[n] = (() => { const o = []; let s = 0; cl.forEach((c, j) => { s += c; if (j >= n) s -= cl[j - n]; o.push(j >= n - 1 ? s / n : null); }); return o; })()); return m[i]; };
const fmt = r => r.map(y => `${((y.eq - 1) * 100).toFixed(0)}%`.padStart(6)).join("") + `  caída máx ${(Math.max(...r.map(y => y.dd)) * 100).toFixed(0)}%`;
console.log(`MARK ${MARK}%/año que se queda el broker del swap. Periodos: 2008-12 | 13-17 | 18-19 | 20-21 | 22-23 | 2024 | 2025-hoy`);
for (const par of Object.keys(PARES)) { const S = serie(par);
  const dir = Math.sign(S.dif("2026-10-01")) || 1;
  const reglas = { [`carry siempre (${dir > 0 ? "largo" : "corto"})`]: () => dir };
  for (const n of [20, 50, 100, 200]) reglas[`carry + tendencia SMA${n}`] = (i, cl) => (dir > 0 ? cl[i] > sma(cl, n, i) : cl[i] < sma(cl, n, i)) ? dir : 0;
  for (const n of [50, 100, 200]) reglas[`tendencia SMA${n} solo largo`] = (i, cl) => cl[i] > sma(cl, n, i) ? 1 : 0;
  for (const n of [20, 50, 100, 200]) reglas[`tendencia SMA${n} largo/corto`] = (i, cl) => cl[i] > sma(cl, n, i) ? 1 : -1;
  console.log(`\n${par} (swap hoy ${(S.dif("2026-10-01") * 100).toFixed(2)}%/año para el largo)`);
  for (const [n, f] of Object.entries(reglas)) { const r = PER.map(([a, b]) => corre(S, f, a, b)); const tot = r.reduce((x, y) => x * y.eq, 1), años = (Date.parse("2026-10-16") - Date.parse("2008-07-01")) / 3.156e10;
    console.log(n.padEnd(30), fmt(r), ` | ${((tot ** (1 / años) - 1) * 100).toFixed(1)}%/año`); } }
