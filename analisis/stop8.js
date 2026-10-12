// Protección con stop móvil probada desde 2018 con máximos/mínimos diarios (pesimista: si el mínimo del día toca
// el stop, sale en el stop menos 0.5% extra; no recompra hasta el día siguiente con señal de compra).
const fs = require("fs"), DIA = 864e5, FEE = 0.001;
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const per = [["2018-2022", "2018-03-01", "2023-01-01"], ["2023-hoy", "2023-01-01", "2100-01-01"], ["último año", "2025-10-01", "2100-01-01"]];
function corre(m, stop, a, b) { const L = fs.readFileSync(`diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").map(Number));
  const P = L.map(c => c[4]), e20 = ema(P, 20), e50 = ema(P, 50); let e = 1, en = false, max = 0, mx = 1, dd = 0, sen = false;
  for (let i = 51; i < L.length; i++) { const t = L[i][0]; if (t < Date.parse(a) || t >= Date.parse(b)) continue;
    const f = fg.get(Math.floor(L[i - 1][0] / DIA)); if (f == null) continue; const sube = e20[i - 1] > e50[i - 1];
    sen = sen ? (f > 25 && sube) : (f >= 55 && sube); const compra = f >= 55 && sube;
    if (en && !sen) { en = false; e *= (L[i][1] / P[i - 1]) * (1 - FEE); } // sale a la apertura
    else if (en) { const sp = max * (1 - stop); if (stop && L[i][3] <= sp) { const x = Math.min(sp, L[i][1]) * 0.995; e *= x / P[i - 1] * (1 - FEE); en = false; }
      else { e *= P[i] / P[i - 1]; max = Math.max(max, L[i][2]); } }
    else if (sen && (stop ? compra : true)) { en = true; e *= (1 - FEE) * P[i] / L[i][1]; max = Math.max(L[i][1], L[i][2]);
      if (stop && L[i][3] <= L[i][1] * (1 - stop)) { /* mismo día: pesimista */ e *= (1 - stop) * 0.995 * L[i][1] / P[i] * (1 - FEE); en = false; } }
    mx = Math.max(mx, e); dd = Math.max(dd, 1 - e / mx); }
  return { e, dd }; }
const pc = x => ((x - 1) * 100).toFixed(0) + "%", MON = ["SOL","BTC","ETH","BNB","XRP","DOGE","ADA"];
for (const [n, a, b] of per) { console.log(`\n== ${n}`.padEnd(26), MON.map(m => m.padStart(14)).join(""), "   típico");
  for (const s of [0, 0.05, 0.08, 0.10, 0.12, 0.15, 0.20, 0.25]) { const r = MON.map(m => corre(m, s, a, b));
    console.log((s ? `stop ${s * 100}% desde máximo` : "sin protección").padEnd(25), r.map(x => `${pc(x.e)} b${(x.dd * 100).toFixed(0)}`.padStart(14)).join(""), pc(Math.exp(r.reduce((q, x) => q + Math.log(x.e), 0) / 7)).padStart(9)); } }
