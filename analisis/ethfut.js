// Busca la mejor configuración de futuros para ETH: reglas de corto distintas y apalancamiento 1x/1.5x/2x.
// Liquidación con máximos/mínimos diarios; pérdida diaria acotada a lo invertido.
const fs = require("fs"), DIA = 864e5, FEE = 0.0005;
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const fund = new Map(); for (const l of fs.readFileSync("ballenas/financiacion.csv", "utf8").trim().split("\n")) { const c = l.split(","), d = Math.floor(+c[0] / DIA); fund.set(d, (fund.get(d) || 0) + +c[2]); }
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const per = [["2020-2022", "2020-01-01", "2023-01-01"], ["2023-hoy", "2023-01-01", "2100-01-01"], ["último año", "2025-10-01", "2100-01-01"]];
const CORTO = {
  "sin corto (spot)": () => false,
  "corto si EMA20<50": (x) => !x.sube,
  "corto si EMA20<50 y F&G<45": (x) => !x.sube && x.f < 45,
  "corto si EMA20<50 y F&G<30": (x) => !x.sube && x.f < 30,
  "corto si EMA50<200": (x) => x.e50 < x.e200,
  "corto si EMA20<50 y EMA50<200": (x) => !x.sube && x.e50 < x.e200,
  "corto si precio<SMA200 y EMA20<50": (x) => !x.sube && x.p < x.s200,
};
function corre(m, regla, lev, a, b) { const L = fs.readFileSync(`diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").map(Number));
  const P = L.map(c => c[4]), e20 = ema(P, 20), e50 = ema(P, 50), e200 = ema(P, 200), s200 = P.map((_, i) => i < 199 ? NaN : P.slice(i - 199, i + 1).reduce((q, v) => q + v) / 200);
  const spot = regla === "sin corto (spot)", fee = spot ? 0.001 : FEE, lv = spot ? 1 : lev;
  let e = 1, pos = 0, ent = 0, sen = false, mx = 1, dd = 0, liq = 0, ops = 0;
  for (let i = 201; i < L.length; i++) { const t = L[i][0]; if (t < Date.parse(a) || t >= Date.parse(b)) continue;
    const f = fg.get(Math.floor(L[i - 1][0] / DIA)); if (f == null) continue;
    const x = { f, sube: e20[i - 1] > e50[i - 1], e50: e50[i - 1], e200: e200[i - 1], p: P[i - 1], s200: s200[i - 1] };
    sen = sen ? (f > 25 && x.sube) : (f >= 55 && x.sube);
    const quiero = sen ? 1 : CORTO[regla](x) ? -1 : 0;
    if (quiero !== pos) { e *= 1 - fee * lv * ((pos ? 1 : 0) + (quiero ? 1 : 0)); if (quiero) ops++; pos = quiero; ent = P[i - 1]; }
    if (pos) { const liqP = pos > 0 ? ent * (1 - 0.9 / lv) : ent * (1 + 0.9 / lv);
      if (lv > 1 && ((pos > 0 && L[i][3] <= liqP) || (pos < 0 && L[i][2] >= liqP))) { e *= Math.max(0, 1 - lv * Math.abs(liqP / P[i - 1] - 1)) * 0.98; liq++; pos = 0; }
      else { e *= Math.max(0, 1 + pos * lv * (P[i] / P[i - 1] - 1)); if (!spot) e *= 1 - pos * lv * (fund.get(Math.floor(t / DIA)) || 0); } }
    mx = Math.max(mx, e); dd = Math.max(dd, 1 - e / mx); }
  return { e, dd, liq, ops }; }
const pc = x => ((x - 1) * 100).toFixed(0) + "%";
for (const m of ["ETH", "BTC"]) { console.log(`\n${m}`.padEnd(42), per.map(p => p[0].padStart(20)).join(""));
  for (const r of Object.keys(CORTO)) for (const lev of r.startsWith("sin") ? [1] : [1, 1.5, 2]) { const R = per.map(([, a, b]) => corre(m, r, lev, a, b));
    console.log(`${r}${r.startsWith("sin") ? "" : " " + lev + "x"}`.padEnd(41), R.map(x => `${pc(x.e)} b${(x.dd * 100).toFixed(0)}${x.liq ? " L" + x.liq : ""}`.padStart(20)).join("")); } }
