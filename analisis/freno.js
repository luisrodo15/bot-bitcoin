// FRENO 2026-10-13: recompra "con rebote": tras bajar -Y% desde la venta no compra de inmediato; sigue el mínimo y compra cuando rebota RB% desde el mínimo
// (así no compra mientras sigue cayendo). Opcional: stop S% bajo la recompra de abajo.
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
let RB = 0, S = 0;
function corre(X, T, Y, Z, a, b) { let minV = 0, deAbajo = false;
  let usd = 1, coin = 0, sen = false, ref = 0, venta = 0, dia = -1, armado = false, max = 0, ops = 0;
  let semIni = null, semB = 0, up = 0, down = 0, sem = 0, b0 = 0, pf = 0;
  for (const [t, o, h, lo, c] of M) { if (t < a || t >= b) continue; if (!b0) { b0 = 1 / o; semB = b0; semIni = t; } pf = c;
    const d = Math.floor(t / DIA) * DIA;
    if (d !== dia) { dia = d; const i = idx.get(d - DIA), f = fg.get(Math.floor((d - DIA) / DIA)); if (i != null && f != null) {
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
      } else if (venta) {
        if (!RB) { if (lo <= venta * (1 - Y) || h >= venta * (1 + Z)) { const p = lo <= venta * (1 - Y) ? venta * (1 - Y) : venta * (1 + Z); coin = usd * (1 - FEE) / p; usd = 0; ref = p; deAbajo = p < venta; venta = 0; ops++; } }
        else { if (minV && h >= minV * (1 + RB)) { const p = minV * (1 + RB); coin = usd * (1 - FEE) / p; usd = 0; ref = p; deAbajo = true; venta = 0; minV = 0; ops++; }
          else if (!minV && h >= venta * (1 + Z)) { const p = venta * (1 + Z); coin = usd * (1 - FEE) / p; usd = 0; ref = p; deAbajo = false; venta = 0; ops++; }
          else { if (lo <= venta * (1 - Y)) minV = minV ? Math.min(minV, lo) : lo; } }
      }
      if (S && coin > 0 && deAbajo && lo <= ref * (1 - S)) { const p = ref * (1 - S); usd += coin * p * (1 - FEE); coin = 0; venta = p / (1 - Y) ; armado = false; deAbajo = false; ops++; }
    }
    if (t - semIni >= SEM) { const bb = usd / c + coin; sem++; if (bb > semB * 1.0001) up++; else if (bb < semB * 0.9999) down++; semB = bb; semIni = t; }
  }
  const fin = usd + coin * pf; return { u: fin, c: (usd / pf + coin) / b0, up: up / sem, down: down / sem, ops: ops / ((b - a) / DIA / 365) };
}
const pc = x => ((x - 1) * 100).toFixed(1) + "%";
const ini = M[0][0], fin = M[M.length - 1][0] + 6e4, mitad = ini + (fin - ini) / 2;
const per = [["año", ini, fin], ["1a mitad", ini, mitad], ["2a mitad", mitad, fin]];
console.log(m, "año / 1a mitad / 2a mitad");
for (const [rb, sl] of [[0, 0], [0.002, 0], [0.003, 0], [0.005, 0], [0.007, 0], [0.01, 0], [0.015, 0], [0, 0.02], [0, 0.03], [0, 0.05], [0.005, 0.03], [0.005, 0.05]]) { RB = rb; S = sl;
  const r = per.map(([, a, b]) => corre(0.012, 0.003, 0.02, 0.024, a, b));
  console.log(`${rb ? "rebote " + (rb * 100).toFixed(1) + "%" : "ACTUAL"}${sl ? " stop " + sl * 100 + "%" : ""}`.padEnd(24), r.map(x => `${pc(x.c)} sem+${(x.up * 100).toFixed(0)}/-${(x.down * 100).toFixed(0)} ${x.ops.toFixed(0)}op`.padEnd(28)).join("")); }
