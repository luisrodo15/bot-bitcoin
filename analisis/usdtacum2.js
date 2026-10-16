// "No vender justo al +X%": al llegar a +X% activa un stop que sigue al precio (T% abajo del máximo) y solo vende
// cuando el precio se regresa T%. Recompra al -Y% desde la venta o si sube Z% arriba de la venta. Datos de 1 minuto.
// Mide en USDT y en cantidad de moneda, y % de semanas con más moneda.
let FEE = 0.00075; const fs = require("fs"), zlib = require("zlib"), DIA = 864e5, SEM = 7 * DIA;
const m = process.argv[2] || "BTC";
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const D = fs.readFileSync(`diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").map(Number));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const PD = D.map(c => c[4]), E20 = ema(PD, 20), E50 = ema(PD, 50), idx = new Map(D.map((c, i) => [c[0], i]));
const M = zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n").map(l => l.split(",").map(Number));
function corre(X, T, Y, Z, a, b, S = 1) {
  let usd = 1, coin = 0, parte = 0, sen = false, ref = 0, venta = 0, dia = -1, armado = false, max = 0, ops = 0, costo = 0, guard = 0, p0 = 0, pf = 0, ventas = 0;
  const vende = p => { const r = coin * p * (1 - FEE), g = r - costo; if (g > 0) { guard += g; usd += r - g; } else usd += r; coin = 0; costo = 0; parte = 0; ops++; ventas++; };
  const compra = (p, f = 1) => { if (usd <= 0) return; const u = usd * f; coin += u * (1 - FEE) / p; costo += u; usd -= u; ops++; };
  for (const [t, o, h, lo, c] of M) { if (t < a || t >= b) continue; if (!p0) p0 = o; pf = c;
    const d = Math.floor(t / DIA) * DIA;
    if (d !== dia) { dia = d; const i = idx.get(d - DIA), f = fg.get(Math.floor((d - DIA) / DIA)); if (i != null && f != null) {
      const sube = E20[i] > E50[i], nuevo = sen ? (f > 25 && sube) : (f >= 55 && sube);
      if (sen && !nuevo && coin > 0) vende(o);
      if (!sen && nuevo) { compra(o); ref = o; venta = 0; armado = false; }
      if (!nuevo) { venta = 0; armado = false; } sen = nuevo; } }
    if (sen && X) {
      if (coin > 0) {
        if (!armado && h >= ref * (1 + X)) { armado = true; max = h; }
        else if (armado) { if (lo <= max * (1 - T)) { const p = Math.max(max * (1 - T), ref * (1 + X) * (1 - T)); vende(p); venta = p; armado = false; } else max = Math.max(max, h); }
      } else if (venta && (lo <= venta * (1 - Y) || h >= venta * (1 + Z))) { const p = lo <= venta * (1 - Y) ? venta * (1 - Y) : venta * (1 + Z);
        if (S < 1 && lo <= venta * (1 - Y)) { compra(p, S); parte = venta; ref = (costo / coin) * (1 - FEE); venta = 0; } else { compra(p); ref = p; venta = 0; } }
      if (parte && coin > 0 && usd > 0 && lo <= parte * (1 - 2 * Y)) { compra(parte * (1 - 2 * Y)); ref = (costo / coin) * (1 - FEE); parte = 0; armado = false; }
    }
  }
  return { tot: usd + coin * pf + guard, guard, ventas, hold: pf / p0 };
}
const pc = x => ((x - 1) * 100).toFixed(1) + "%";
const ini = M[0][0], fin = M[M.length - 1][0] + 6e4, mitad = ini + (fin - ini) / 2;
const per = [["año", ini, fin], ["1a mitad", ini, mitad], ["2a mitad", mitad, fin]];
for (const fee of [0.00075, 0.0005, 0]) { FEE = fee; console.log(m, "comisión", fee * 100 + "%");
for (const X of [0.006, 0.009, 0.012, 0.015]) for (const S of [1, 0.5]) { const r = per.map(([, a, b]) => corre(X, 0.003, 0.02, 2 * X, a, b, S));
  console.log(`+${(X*100).toFixed(1)} ${S < 1 ? "2 partes" : "1 parte "}`.padEnd(16), r.map(x => `${pc(x.tot)} ${x.ventas}v`.padEnd(16)).join("")); } }
