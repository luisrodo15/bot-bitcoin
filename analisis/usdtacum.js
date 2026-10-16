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
function corre(X, T, Y, Z, a, b) {
  let usd = 1, coin = 0, sen = false, ref = 0, venta = 0, dia = -1, armado = false, max = 0, ops = 0, costo = 0, guard = 0, p0 = 0, pf = 0, ventas = 0;
  const vende = p => { const r = coin * p * (1 - FEE), g = r - costo; if (g > 0) { guard += g; usd += r - g; } else usd += r; coin = 0; costo = 0; ops++; ventas++; };
  const compra = p => { if (usd <= 0) return; coin = usd * (1 - FEE) / p; costo = usd; usd = 0; ops++; };
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
      } else if (venta && (lo <= venta * (1 - Y) || h >= venta * (1 + Z))) { const p = lo <= venta * (1 - Y) ? venta * (1 - Y) : venta * (1 + Z); compra(p); ref = p; venta = 0; }
    }
  }
  return { tot: usd + coin * pf + guard, guard, ventas, hold: pf / p0 };
}
const pc = x => ((x - 1) * 100).toFixed(1) + "%";
const ini = M[0][0], fin = M[M.length - 1][0] + 6e4, mitad = ini + (fin - ini) / 2;
const per = [["año", ini, fin], ["1a mitad", ini, mitad], ["2a mitad", mitad, fin]];
console.log(m, "  (total USDT | guardado | ventas)  hold año:", pc(corre(0.012,0.003,0.02,0.024,ini,fin).hold));
for (const X of [0.006, 0.009, 0.012, 0.015, 0.02, 0.03, 0.05]) for (const T of [0.003, 0.007]) { const Y = 0.02, Z = 2 * X;
  const r = per.map(([, a, b]) => corre(X, T, Y, Z, a, b));
  console.log(`+${(X*100).toFixed(1)} stop${(T*100).toFixed(1)}`.padEnd(14), r.map(x => `${pc(x.tot)} g${(x.guard*100).toFixed(1)}% ${x.ventas}v`.padEnd(24)).join("")); }
