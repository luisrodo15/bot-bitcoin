// "Movimiento dentro de la tendencia": mientras la regla principal dice tener la moneda, una parte (f) se vende
// cuando sube X% desde la última compra y se recompra cuando baja Y% desde esa venta. Datos diarios desde 2018,
// pesimista: si en un día se tocan las dos cosas, solo cuenta la primera que le conviene MENOS al bot.
const fs = require("fs"), DIA = 864e5, FEE = 0.00075;
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const per = [["2018-2022", "2018-03-01", "2023-01-01"], ["2023-hoy", "2023-01-01", "2100-01-01"], ["último año", "2025-10-01", "2100-01-01"]];
function corre(m, X, Y, f, a, b) {
  const L = fs.readFileSync(`diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").map(Number));
  const P = L.map(c => c[4]), e20 = ema(P, 20), e50 = ema(P, 50);
  let usd = 1, coin = 0, sen = false, ref = 0, fuera = false, ventaP = 0, ops = 0, t0 = 0, t1 = 0, mx = 1, dd = 0;
  const comprar = (u, p) => { coin += u * (1 - FEE) / p; usd -= u; ops++; }, vender = (c, p) => { usd += c * p * (1 - FEE); coin -= c; ops++; };
  for (let i = 51; i < L.length; i++) { const t = L[i][0]; if (t < Date.parse(a) || t >= Date.parse(b)) continue; if (!t0) t0 = t; t1 = t;
    const fv = fg.get(Math.floor(L[i - 1][0] / DIA)); if (fv == null) continue; const sube = e20[i - 1] > e50[i - 1];
    const nuevo = sen ? (fv > 25 && sube) : (fv >= 55 && sube), o = L[i][1], h = L[i][2], lo = L[i][3];
    if (sen && !nuevo) { if (coin > 0) vender(coin, o); fuera = false; }
    else if (!sen && nuevo) { comprar(usd, o); ref = o; fuera = false; }
    else if (sen && f > 0) {
      if (!fuera && h >= ref * (1 + X)) { const p = ref * (1 + X); vender(coin * f, p); fuera = true; ventaP = p; }
      else if (fuera && lo <= ventaP * (1 - Y)) { const p = ventaP * (1 - Y); comprar(usd, p); fuera = false; ref = p; }
      else if (fuera && h >= ventaP * (1 + X)) { /* siguió subiendo: recompra para no quedarse fuera */ const p = ventaP * (1 + X); comprar(usd, p); fuera = false; ref = p; }
    }
    sen = nuevo; const v = usd + coin * P[i]; mx = Math.max(mx, v); dd = Math.max(dd, 1 - v / mx); }
  return { e: usd + coin * P[L.length - 1 < 0 ? 0 : Math.min(L.length - 1, L.findIndex(c => c[0] >= t1))], ops: ops / ((t1 - t0) / DIA / 365), dd };
}
const pc = x => ((x - 1) * 100).toFixed(0) + "%", MON = (process.argv[2] || "BNB,BTC,ETH,SOL").split(",");
const combos = [[0, 0, 0]]; for (const X of [0.03, 0.05, 0.08, 0.12]) for (const Y of [0.03, 0.05, 0.08]) for (const f of [0.3, 0.5, 1]) combos.push([X, Y, f]);
for (const [n, a, b] of per) { console.log(`\n== ${n}`.padEnd(22), MON.map(m => m.padStart(20)).join(""));
  for (const [X, Y, f] of combos) { const r = MON.map(m => corre(m, X, Y, f, a, b));
    console.log((X ? `+${X * 100}/-${Y * 100} parte ${f * 100}%` : "regla actual").padEnd(21), r.map(x => `${pc(x.e)} ${x.ops.toFixed(0)}op/a b${(x.dd * 100).toFixed(0)}`.padStart(20)).join("")); } }
