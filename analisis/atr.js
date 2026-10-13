// IDEA 2026-10-13: meta y stop adaptados a la volatilidad (ATR14 diario %). X=kx*ATR, T=kt*ATR, Y=ky*ATR, Z=2*X.
// "No vender justo al +X%": al llegar a +X% activa un stop que sigue al precio (T% abajo del máximo) y solo vende
// cuando el precio se regresa T%. Recompra al -Y% desde la venta o si sube Z% arriba de la venta. Datos de 1 minuto.
// Mide en USDT y en cantidad de moneda, y % de semanas con más moneda.
const fs = require("fs"), zlib = require("zlib"), DIA = 864e5, SEM = 7 * DIA, FEE = 0.00075;
const m = process.argv[2] || "BTC";
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const D = fs.readFileSync(`diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").map(Number));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const TR = D.map((c, i) => i ? Math.max(c[2] - c[3], Math.abs(c[2] - D[i - 1][4]), Math.abs(c[3] - D[i - 1][4])) / D[i - 1][4] : (c[2] - c[3]) / c[4]), ATR = ema(TR, 14);
const PD = D.map(c => c[4]), E20 = ema(PD, 20), E50 = ema(PD, 50), idx = new Map(D.map((c, i) => [c[0], i]));
const M = zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n").map(l => l.split(",").map(Number));
function corre(kx, kt, ky, kz, a, b) { let X = 0.012, T = 0.003, Y = 0.02, Z = 0.024;
  let usd = 1, coin = 0, sen = false, ref = 0, venta = 0, dia = -1, armado = false, max = 0, ops = 0;
  let semIni = null, semB = 0, up = 0, down = 0, sem = 0, b0 = 0, pf = 0;
  for (const [t, o, h, lo, c] of M) { if (t < a || t >= b) continue; if (!b0) { b0 = 1 / o; semB = b0; semIni = t; } pf = c;
    const d = Math.floor(t / DIA) * DIA;
    if (d !== dia) { dia = d; const i = idx.get(d - DIA); if (i != null && kx < 1) { const A = ATR[i]; X = kx * A; T = kt * A; Y = ky * A; Z = kz * X; } const f = fg.get(Math.floor((d - DIA) / DIA)); if (i != null && f != null) {
      const sube = E20[i] > E50[i], nuevo = sen ? (f > 25 && sube) : (f >= 55 && sube);
      if (sen && !nuevo && coin > 0) { usd += coin * o * (1 - FEE); coin = 0; ops++; }
      if (!sen && nuevo) { coin = usd * (1 - FEE) / o; usd = 0; ref = o; venta = 0; armado = false; ops++; }
      if (!nuevo) { venta = 0; armado = false; } sen = nuevo; } }
    if (sen && X) {
      if (coin > 0) {
        if (!armado && h >= ref * (1 + X)) { armado = true; max = h; }
        else if (armado) { if (T === 0) { const p = ref * (1 + X); usd += coin * p * (1 - FEE); coin = 0; venta = p; armado = false; ops++; }
          else if (lo <= max * (1 - T)) { const p = Math.max(max * (1 - T), ref * (1 + X) * (1 - T)); usd += coin * p * (1 - FEE); coin = 0; venta = p; armado = false; ops++; }
          else max = Math.max(max, h); }
      } else if (venta && (lo <= venta * (1 - Y) || h >= venta * (1 + Z))) { const p = lo <= venta * (1 - Y) ? venta * (1 - Y) : venta * (1 + Z); coin = usd * (1 - FEE) / p; usd = 0; ref = p; venta = 0; ops++; }
    }
    if (t - semIni >= SEM) { const bb = usd / c + coin; sem++; if (bb > semB * 1.0001) up++; else if (bb < semB * 0.9999) down++; semB = bb; semIni = t; }
  }
  const fin = usd + coin * pf; return { u: fin, c: (usd / pf + coin) / b0, up: up / sem, down: down / sem, ops: ops / ((b - a) / DIA / 365) };
}
const pc = x => ((x - 1) * 100).toFixed(1) + "%";
const ini = M[0][0], fin = M[M.length - 1][0] + 6e4, mitad = ini + (fin - ini) / 2;
const per = [["año", ini, fin], ["1a mitad", ini, mitad], ["2a mitad", mitad, fin]];
const C = [[9,0,0,0]]; for (const kx of [0.3, 0.4, 0.5, 0.6]) for (const kt of [0.1, 0.15]) for (const ky of [0.5, 0.7, 1]) C.push([kx, kt, ky, 2]);
console.log(m, "ATR medio %", (ATR.slice(-365).reduce((a, b) => a + b) / 365 * 100).toFixed(2));
const R = C.map(([X, T, Y, Z]) => [`${X > 1 ? "ACTUAL +1.2/0.3/-2/+2.4" : `x${X} t${T} y${Y}`}`, per.map(([, a, b]) => corre(X, T, Y, Z, a, b))]);
R.sort((p, q) => Math.min(q[1][1].c, q[1][2].c) - Math.min(p[1][1].c, p[1][2].c));
for (const [n, r] of R.slice(0, 14).concat(R.filter(x => x[0].startsWith("ACTUAL")))) console.log(n.padEnd(24), r.map(x => `${pc(x.c)} sem+${(x.up * 100).toFixed(0)}/-${(x.down * 100).toFixed(0)} ${x.ops.toFixed(0)}op`.padEnd(28)).join(""));
