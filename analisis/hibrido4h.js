// HÍBRIDO 2026-10-13: bot actual (minuto) + señales 4h extra: vende si RSI4h>=A con ganancia>=m; recompra antes si RSI4h<=B y precio bajo la venta.
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
const H4 = 4 * 36e5, CL = [], K4 = new Map(); for (const r of M) { const k = Math.floor(r[0] / H4) * H4; if (!K4.has(k)) { K4.set(k, CL.length); CL.push(r[4]); } else CL[CL.length - 1] = r[4]; }
const RSI = (n => { const o = [50]; let g = 0, p = 0; for (let i = 1; i < CL.length; i++) { const d = CL[i] - CL[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; p = (p * (n - 1) + Math.max(-d, 0)) / n; o.push(p ? 100 - 100 / (1 + g / p) : 100); } return o; })(14);
let A = 999, B = 0, MIN = 0.005;
function corre(X, T, Y, Z, a, b) { let k4 = -1;
  let usd = 1, coin = 0, sen = false, ref = 0, venta = 0, dia = -1, armado = false, max = 0, ops = 0;
  let semIni = null, semB = 0, up = 0, down = 0, sem = 0, b0 = 0, pf = 0;
  for (const [t, o, h, lo, c] of M) { if (t < a || t >= b) continue; if (!b0) { b0 = 1 / o; semB = b0; semIni = t; } pf = c;
    const d = Math.floor(t / DIA) * DIA;
    if (d !== dia) { dia = d; const i = idx.get(d - DIA), f = fg.get(Math.floor((d - DIA) / DIA)); if (i != null && f != null) {
      const sube = E20[i] > E50[i], nuevo = sen ? (f > 25 && sube) : (f >= 55 && sube);
      if (sen && !nuevo && coin > 0) { usd += coin * o * (1 - FEE); coin = 0; ops++; }
      if (!sen && nuevo) { coin = usd * (1 - FEE) / o; usd = 0; ref = o; venta = 0; armado = false; ops++; }
      if (!nuevo) { venta = 0; armado = false; } sen = nuevo; } }
    const kk = Math.floor(t / H4) * H4; if (kk !== k4) { const j = K4.get(kk) - 1; k4 = kk; if (sen && j > 15) {
      if (coin > 0 && RSI[j] >= A && o >= ref * (1 + MIN)) { usd += coin * o * (1 - FEE); coin = 0; venta = o; armado = false; ops++; }
      else if (coin === 0 && venta && RSI[j] <= B && o < venta) { coin = usd * (1 - FEE) / o; usd = 0; ref = o; venta = 0; ops++; } } }
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
console.log("BTC híbrido: año / 1a mitad / 2a mitad");
for (const [a_, b_, m_] of [[999,0,0],[65,0,0.005],[67,0,0.005],[68,0,0.005],[69,0,0.005],[70,0,0.005],[71,0,0.005],[72,0,0.005],[73,0,0.005],[70,0,0.003],[70,0,0.008],[70,0,0.01],[68,0,0.008],[72,0,0.008]]) { A = a_; B = b_; MIN = m_;
  const r = per.map(([, a, b]) => corre(0.012, 0.003, 0.02, 0.024, a, b));
  console.log(`${a_ > 100 ? "ACTUAL" : "RSI>=" + a_}${b_ ? " recompra RSI<=" + b_ : ""} min${m_ * 100}`.padEnd(34), r.map(x => `${pc(x.c)} sem+${(x.up * 100).toFixed(0)}/-${(x.down * 100).toFixed(0)} ${x.ops.toFixed(0)}op`.padEnd(28)).join("")); }
