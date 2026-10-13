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
const V4 = {}; function velas(hrs) { if (V4[hrs]) return V4[hrs]; const ms = hrs * 36e5, V = []; for (const [t, o, h, l, c] of M) { const b = Math.floor(t / ms) * ms, u = V[V.length - 1]; if (!u || u.t !== b) V.push({ t: b, c }); else u.c = c; } return V4[hrs] = V; }
function tendencia(hrs, nf, ns) { const V = velas(hrs), P = V.map(v => v.c), F = ema(P, nf), S = ema(P, ns), m = new Map(); V.forEach((v, i) => m.set(v.t + hrs * 36e5, F[i] > S[i])); return m; }
function corre(X, T, Y, Z, a, b, TF = 0, nf = 20, ns = 50) { const TM = TF ? tendencia(TF, nf, ns) : null, msTF = TF * 36e5;
  let usd = 1, coin = 0, sen = false, ref = 0, venta = 0, dia = -1, armado = false, max = 0, ops = 0;
  let semIni = null, semB = 0, up = 0, down = 0, sem = 0, b0 = 0, pf = 0;
  for (const [t, o, h, lo, c] of M) { if (t < a || t >= b) continue; if (!b0) { b0 = 1 / o; semB = b0; semIni = t; } pf = c;
    const d = Math.floor(t / DIA) * DIA;
    const nuevaVela = TF ? (t % msTF === 0) : (d !== dia);
    if (nuevaVela) { dia = d; const i = idx.get(d - DIA), f = fg.get(Math.floor((d - DIA) / DIA)); const tv = TF ? TM.get(t) : null; if (i != null && f != null && (!TF || tv != null)) {
      const sube = TF ? tv : E20[i] > E50[i], nuevo = sen ? (f > 25 && sube) : (f >= 55 && sube);
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
for (const [n, TF, nf, ns] of [["diaria EMA20/50 (actual)", 0], ["4h EMA20/50", 4, 20, 50], ["4h EMA50/200", 4, 50, 200], ["4h EMA120/300 (≈diaria)", 4, 120, 300], ["4h EMA30/90", 4, 30, 90]]) {
  const r = per.map(([, a, b]) => corre(0.012, 0.003, 0.02, 0.024, a, b, TF, nf, ns));
  console.log(`${n.padEnd(26)} BTC año ${pc(r[0].c)} (mitades ${pc(r[1].c)} / ${pc(r[2].c)}) USDT ${pc(r[0].u)} ops/año ${r[0].ops.toFixed(0)} semanas +${(r[0].up*100).toFixed(0)}% -${(r[0].down*100).toFixed(0)}%`); }
