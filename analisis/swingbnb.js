// Modo movimiento con datos de 1 minuto (último año): régimen diario (miedo y codicia + EMA20/50 del día anterior cerrado),
// dentro del régimen vende todo al +X% desde la compra y recompra al -Y% desde la venta (o si sigue subiendo X%).
// Mide: resultado, operaciones al año, % de semanas con ganancia (valor de la cuenta en USDT vs la semana anterior).
const fs = require("fs"), zlib = require("zlib"), DIA = 864e5, SEM = 7 * DIA, FEE = 0.00075;
const m = process.argv[2] || "BNB";
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const D = fs.readFileSync(`diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").map(Number));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const PD = D.map(c => c[4]), E20 = ema(PD, 20), E50 = ema(PD, 50), idx = new Map(D.map((c, i) => [c[0], i]));
const M = zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n").map(l => l.split(",").map(Number));
function corre(X, Y, a, b) {
  let usd = 1, coin = 0, sen = false, ref = 0, venta = 0, ops = 0, dia = -1, malo = true, ganadoras = 0, ventas = 0;
  let semIni = null, semVal = 1, semB = 0, semBUp = 0, semBDown = 0, b0 = 0, semanas = 0, semUp = 0, semConVenta = 0, ventaSem = false, t0 = 0, t1 = 0, mx = 1, dd = 0;
  const val = p => usd + coin * p, enB = p => usd / p + coin;
  for (const [t, o, h, lo, c] of M) { if (t < a || t >= b) continue; if (!t0) { t0 = t; b0 = 1 / o; semB = b0; } t1 = t;
    const d = Math.floor(t / DIA) * DIA;
    if (d !== dia) { dia = d; const i = idx.get(d - DIA); const f = fg.get(Math.floor((d - DIA) / DIA)); if (i != null && f != null) {
      const sube = E20[i] > E50[i]; const nuevo = sen ? (f > 25 && sube) : (f >= 55 && sube);
      if (sen && !nuevo && coin > 0) { usd += coin * o * (1 - FEE); ops++; ventas++; if (o > ref) ganadoras++; coin = 0; }
      if (!sen && nuevo) { coin = usd * (1 - FEE) / o; usd = 0; ref = o; venta = 0; ops++; }
      if (!nuevo) venta = 0;
      sen = nuevo; } }
    if (sen && X) {
      if (coin > 0 && h >= ref * (1 + X)) { const p = ref * (1 + X); usd += coin * p * (1 - FEE); coin = 0; venta = p; ops++; ventas++; ganadoras++; ventaSem = true; }
      else if (coin === 0 && venta && (lo <= venta * (1 - Y) || h >= venta * (1 + X))) { const p = lo <= venta * (1 - Y) ? venta * (1 - Y) : venta * (1 + X); coin = usd * (1 - FEE) / p; usd = 0; ref = p; venta = 0; ops++; }
    }
    if (semIni === null) semIni = t;
    if (t - semIni >= SEM) { const v = val(c); semanas++; if (v > semVal * 1.0001) semUp++; if (ventaSem) semConVenta++; const b = enB(c); if (b > semB * 1.0001) semBUp++; else if (b < semB * 0.9999) semBDown++; semB = b; semVal = v; semIni = t; ventaSem = false; }
    const v = val(c); mx = Math.max(mx, v); dd = Math.max(dd, 1 - v / mx); }
  const pf = M.findLast(r => r[0] <= t1)[4], fin = val(pf);
  return { bnb: enB(pf) / b0, bUp: semBUp / semanas, bDown: semBDown / semanas, r: fin, ops: ops / ((t1 - t0) / DIA / 365), semUp: semUp / semanas, semVenta: semConVenta / semanas, dd };
}
const pc = x => ((x - 1) * 100).toFixed(1) + "%";
const ini = M[0][0], fin = M[M.length - 1][0] + 6e4, mitad = ini + (fin - ini) / 2;
const per = [["año completo", ini, fin], ["1a mitad", ini, mitad], ["2a mitad", mitad, fin]];
console.log(m, "hold año:", pc(M[M.length - 1][4] / M[0][1]));
const combos = [[0, 0], [0.03, 0.03], [0.02, 0.02], [0.05, 0.05], [0.01, 0.02]];
console.log("regla".padEnd(14), per.map(p => p[0].padEnd(38)).join(""));
for (const [X, Y] of combos) { const r = per.map(([, a, b]) => corre(X, Y, a, b));
  console.log((X ? `+${X * 100}/-${Y * 100}` : "sin movimiento").padEnd(14), r.map(x => `USDT ${pc(x.r)} BNB ${pc(x.bnb)} semBNB+${(x.bUp * 100).toFixed(0)}% =${(100 - (x.bUp + x.bDown) * 100).toFixed(0)}% -${(x.bDown * 100).toFixed(0)}%`.padEnd(38)).join("")); }
