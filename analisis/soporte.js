// Video "Gana dinero con Spot Trading sin riesgo" (Nacho AUGE): compra con orden límite en soporte (mínimo de los
// últimos N días en velas de 1h), opcional confirmación de volumen, vende con orden límite +T% (resistencia), nunca vende en pérdida.
// Filtro opcional: solo compra si la regla del bot (miedo/codicia + EMA20>EMA50) está en "tener".
const fs = require("fs"), zlib = require("zlib"), DIA = 864e5, H = 36e5, FEE = 0.00075;
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const D = fs.readFileSync("diarios/BTCUSDT-1d.csv", "utf8").trim().split("\n").map(l => l.split(",").map(Number));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const PD = D.map(c => c[4]), E20 = ema(PD, 20), E50 = ema(PD, 50), idx = new Map(D.map((c, i) => [c[0], i]));
const M = zlib.gunzipSync(fs.readFileSync("datos/BTCUSDT.csv.gz")).toString().trim().split("\n").map(l => l.split(",").map(Number));
const HH = []; for (const [t, o, h, l, c, v] of M) { const k = Math.floor(t / H) * H, u = HH[HH.length - 1]; if (u && u[0] === k) { u[2] = Math.max(u[2], h); u[3] = Math.min(u[3], l); u[4] = c; u[5] += v || 0; } else HH.push([k, o, h, l, c, v || 0]); }
function bueno(t) { const d = Math.floor(t / DIA) * DIA, i = idx.get(d - DIA), f = fg.get(Math.floor((d - DIA) / DIA)); return i != null && f != null && f >= 40 && E20[i] > E50[i]; }
function corre(N, T, vol, filtro, a, b) {
  let usd = 1, coin = 0, ref = 0, b0 = 0, pf = 0, ventas = 0, gan = 0, perd = 0, tIn = 0, tEnt = 0, maxDias = 0;
  for (let i = N * 24; i < HH.length; i++) { const [t, o, h, l, c, v] = HH[i]; if (t < a || t >= b) continue; if (!b0) b0 = 1 / o; pf = c;
    if (coin > 0) { if (h >= ref * (1 + T)) { usd = coin * ref * (1 + T) * (1 - FEE); coin = 0; ventas++; maxDias = Math.max(maxDias, (t - tEnt) / DIA); } continue; }
    if (filtro && !bueno(t)) continue;
    let sop = Infinity; for (let j = i - N * 24; j < i; j++) sop = Math.min(sop, HH[j][3]);
    if (l <= sop) { if (vol) { let m = 0; for (let j = i - 20; j < i; j++) m += HH[j][5]; if (v < 1.5 * m / 20) continue; }
      const p = Math.min(o, sop); coin = usd * (1 - FEE) / p; usd = 0; ref = p; tEnt = t; } }
  if (coin > 0) maxDias = Math.max(maxDias, (b - tEnt) / DIA);
  return { c: (usd / pf + coin) / b0, u: usd + coin * pf, ventas, abierto: coin > 0, maxDias };
}
const ini = HH[0][0], fin = HH[HH.length - 1][0] + H, mit = ini + (fin - ini) / 2, pc = x => ((x - 1) * 100).toFixed(1) + "%";
const per = [[ini, fin], [ini, mit], [mit, fin]];
console.log("BTC último año. Columnas: año / 1a mitad / 2a mitad · BTC ganado, USDT ganado, ventas, días máx atorado");
const R = [];
for (const N of [3, 7, 14]) for (const T of [0.02, 0.03, 0.05, 0.08]) for (const vol of [0, 1]) for (const filtro of [0, 1]) {
  const r = per.map(([a, b]) => corre(N, T, vol, filtro, a, b)); R.push([`sop ${N}d +${T * 100}% ${vol ? "vol" : "   "} ${filtro ? "filtro" : "      "}`, r]); }
R.sort((p, q) => Math.min(q[1][1].c, q[1][2].c) - Math.min(p[1][1].c, p[1][2].c));
for (const [n, r] of R.slice(0, 12)) console.log(n.padEnd(26), r.map(x => `${pc(x.c)} usd${pc(x.u)} ${x.ventas}v ${x.maxDias.toFixed(0)}d${x.abierto ? "*" : ""}`.padEnd(34)).join(""));
console.log("…peores:"); for (const [n, r] of R.slice(-3)) console.log(n.padEnd(26), r.map(x => `${pc(x.c)} usd${pc(x.u)} ${x.ventas}v ${x.maxDias.toFixed(0)}d${x.abierto ? "*" : ""}`.padEnd(34)).join(""));
