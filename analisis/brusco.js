// IDEA 2026-10-14: movimientos bruscos de 1 hora. CAIDA: esperando recompra, si el precio cae D% en los últimos 60 min y está bajo la venta, recompra ya.
// PICO: con BTC, si sube U% en 60 min y ya gana >= M%, vende ya (sin esperar +1.2%). Sobre el modo semanal actual.
// "No vender justo al +X%": al llegar a +X% activa un stop que sigue al precio (T% abajo del máximo) y solo vende
// cuando el precio se regresa T%. Recompra al -Y% desde la venta o si sube Z% arriba de la venta. Datos de 1 minuto.
// Mide en USDT y en cantidad de moneda, y % de semanas con más moneda.
const fs = require("fs"), zlib = require("zlib"), DIA = 864e5, SEM = 7 * DIA, FEE = 0.00075;
const m = process.argv[2] || "BTC";
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const D = fs.readFileSync(`diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").map(Number));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const PD = D.map(c => c[4]), E20 = ema(PD, 20), E50 = ema(PD, 50), idx = new Map(D.map((c, i) => [c[0], i]));
const M = zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n").map(l => l.split(",").map(Number));
let CD = 0, U = 0, MG = 0.005;
function corre(X, T, Y, Z, a, b) { const ven = []; let vi = 0;
  let usd = 1, coin = 0, sen = false, ref = 0, venta = 0, dia = -1, armado = false, max = 0, ops = 0;
  let semIni = null, semB = 0, up = 0, down = 0, sem = 0, b0 = 0, pf = 0;
  for (const [t, o, h, lo, c] of M) { if (t < a || t >= b) continue; if (!b0) { b0 = 1 / o; semB = b0; semIni = t; } pf = c;
    const d = Math.floor(t / DIA) * DIA;
    if (d !== dia) { dia = d; const i = idx.get(d - DIA), f = fg.get(Math.floor((d - DIA) / DIA)); if (i != null && f != null) {
      const sube = E20[i] > E50[i], nuevo = sen ? (f > 25 && sube) : (f >= 55 && sube);
      if (sen && !nuevo && coin > 0) { usd += coin * o * (1 - FEE); coin = 0; ops++; }
      if (!sen && nuevo) { coin = usd * (1 - FEE) / o; usd = 0; ref = o; venta = 0; armado = false; ops++; }
      if (!nuevo) { venta = 0; armado = false; } sen = nuevo; } }
    ven.push([t, c]); while (ven[vi][0] < t - 36e5) vi++; let hi60 = 0, lo60 = Infinity; for (let j = vi; j < ven.length; j++) { hi60 = Math.max(hi60, ven[j][1]); lo60 = Math.min(lo60, ven[j][1]); } if (vi > 5000) { ven.splice(0, vi); vi = 0; }
    if (sen && X && CD && coin === 0 && venta && c < venta && c <= hi60 * (1 - CD)) { coin = usd * (1 - FEE) / c; usd = 0; ref = c; venta = 0; ops++; }
    if (sen && X && U && coin > 0 && !armado && c >= lo60 * (1 + U) && c >= ref * (1 + MG)) { usd += coin * c * (1 - FEE); coin = 0; venta = c; armado = false; ops++; }
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
console.log(m, "año / 1a mitad / 2a mitad");
for (const [d, u, mg] of [[0, 0, 0], [0.01, 0, 0], [0.015, 0, 0], [0.02, 0, 0], [0.025, 0, 0], [0, 0.01, 0.005], [0, 0.015, 0.005], [0, 0.02, 0.005], [0, 0.015, 0.008], [0.015, 0.015, 0.005]]) { CD = d; U = u; MG = mg;
  const r = per.map(([, a, b]) => corre(0.012, 0.003, 0.02, 0.024, a, b));
  console.log(`${d ? "caída1h " + d * 100 + "% " : ""}${u ? "pico1h " + u * 100 + "% gana" + mg * 100 + "%" : ""}${!d && !u ? "ACTUAL" : ""}`.padEnd(30), r.map(x => `${pc(x.c)} sem+${(x.up * 100).toFixed(0)}/-${(x.down * 100).toFixed(0)} ${x.ops.toFixed(0)}op`.padEnd(28)).join("")); }
