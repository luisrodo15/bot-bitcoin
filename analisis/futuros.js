// Futuros: la estrategia actual en largo, y además en corto cuando la tendencia es de bajada. Apalancamiento 1x-3x.
// Comisión de futuros 0.05% por lado (taker), financiamiento diario real de BTC (los largos pagan, los cortos cobran),
// liquidación si el máximo/mínimo del día toca el precio de liquidación (pierde todo lo de esa operación).
const fs = require("fs"), DIA = 864e5, FEE = 0.0005;
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const fund = new Map(); for (const l of fs.readFileSync("ballenas/financiacion.csv", "utf8").trim().split("\n")) { const c = l.split(","), d = Math.floor(+c[0] / DIA); fund.set(d, (fund.get(d) || 0) + +c[2]); }
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const per = [["2020-2022", "2020-01-01", "2023-01-01"], ["2023-hoy", "2023-01-01", "2100-01-01"], ["último año", "2025-10-01", "2100-01-01"]];
// modo: "spot" (actual), "largo" (futuros solo largo), "largo+corto" (corto cuando EMA20<EMA50 y miedo/codicia < 45)
function corre(m, modo, lev, a, b) { const L = fs.readFileSync(`diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").map(Number));
  const P = L.map(c => c[4]), e20 = ema(P, 20), e50 = ema(P, 50); let e = 1, pos = 0, ent = 0, sen = false, mx = 1, dd = 0, liq = 0;
  const fee = modo === "spot" ? 0.001 : FEE;
  for (let i = 51; i < L.length; i++) { const t = L[i][0]; if (t < Date.parse(a) || t >= Date.parse(b)) continue;
    const f = fg.get(Math.floor(L[i - 1][0] / DIA)); if (f == null) continue; const sube = e20[i - 1] > e50[i - 1];
    sen = sen ? (f > 25 && sube) : (f >= 55 && sube);
    const quiero = sen ? 1 : (modo === "largo+corto" && !sube && f < 45 ? -1 : 0);
    if (quiero !== pos) { e *= 1 - fee * lev * ((pos ? 1 : 0) + (quiero ? 1 : 0)); pos = quiero; ent = P[i - 1]; }
    if (pos) { const lv = modo === "spot" ? 1 : lev, liqP = pos > 0 ? ent * (1 - 0.95 / lv) : ent * (1 + 0.95 / lv);
      if ((pos > 0 && L[i][3] <= liqP) || (pos < 0 && L[i][2] >= liqP)) { e *= 0.0 + (1 - Math.min(1, lv * Math.abs(liqP / P[i - 1] - 1))) ; liq++; pos = 0; }
      else { e *= 1 + pos * lv * (P[i] / P[i - 1] - 1); if (modo !== "spot") e *= 1 - pos * lv * (fund.get(Math.floor(t / DIA)) || 0); ent = ent; } }
    mx = Math.max(mx, e); dd = Math.max(dd, 1 - e / mx); }
  return { e, dd, liq }; }
const pc = x => ((x - 1) * 100).toFixed(0) + "%", MON = ["SOL","BTC","ETH","BNB","XRP","DOGE","ADA"];
const V = [["spot", 1], ["largo", 1], ["largo+corto", 1], ["largo", 2], ["largo+corto", 2], ["largo", 3], ["largo+corto", 3]];
for (const [n, a, b] of per) { console.log(`\n== ${n}`.padEnd(24), MON.map(m => m.padStart(15)).join(""), "  típico");
  for (const [modo, lev] of V) { const r = MON.map(m => corre(m, modo, lev, a, b));
    console.log(`${modo} ${modo === "spot" ? "(actual)" : lev + "x"}`.padEnd(23), r.map(x => `${pc(x.e)} b${(x.dd * 100).toFixed(0)}${x.liq ? " L" + x.liq : ""}`.padStart(15)).join(""), pc(Math.exp(r.reduce((q, x) => q + Math.log(Math.max(x.e, 1e-9)), 0) / 7)).padStart(8)); } }
