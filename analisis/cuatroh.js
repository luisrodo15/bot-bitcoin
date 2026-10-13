// Búsqueda en velas de 4h (como TradingView 4h) DENTRO de la regla del bot (codicia + EMA20>50 diaria):
// A) RSI: vende si RSI4h >= alto y precio >= compra*(1+min); recompra si RSI4h <= bajo.
// B) Bollinger: vende al tocar banda alta (20, k) con ganancia mínima; recompra al tocar banda baja o la media.
// C) EMA: vende cuando cierra bajo EMA n 4h con ganancia mínima; recompra al cerrar arriba de EMA n.
// Decide al cierre de cada vela de 4h (sin ver el futuro). Mide BTC equivalente, ventas.
const fs = require("fs"), zlib = require("zlib"), DIA = 864e5, H4 = 4 * 36e5, FEE = 0.00075;
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const D = fs.readFileSync("diarios/BTCUSDT-1d.csv", "utf8").trim().split("\n").map(l => l.split(",").map(Number));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const PD = D.map(c => c[4]), E20 = ema(PD, 20), E50 = ema(PD, 50), idx = new Map(D.map((c, i) => [c[0], i]));
const regla = new Map(); { let s = false; for (const c of D) { const i = idx.get(c[0] - DIA), f = fg.get(Math.floor((c[0] - DIA) / DIA)); if (i == null || f == null) continue; const up = E20[i] > E50[i]; s = s ? (f > 25 && up) : (f >= 55 && up); regla.set(c[0], s); } }
const M = zlib.gunzipSync(fs.readFileSync("datos/BTCUSDT.csv.gz")).toString().trim().split("\n").map(l => l.split(",").map(Number));
const C = []; for (const [t, o, h, l, c] of M) { const k = Math.floor(t / H4) * H4, u = C[C.length - 1]; if (u && u[0] === k) { u[2] = Math.max(u[2], h); u[3] = Math.min(u[3], l); u[4] = c; } else C.push([k, o, h, l, c]); }
const CL = C.map(c => c[4]);
const rsi = (n => { const o = [50]; let g = 0, p = 0; for (let i = 1; i < CL.length; i++) { const d = CL[i] - CL[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; p = (p * (n - 1) + Math.max(-d, 0)) / n; o.push(p ? 100 - 100 / (1 + g / p) : 100); } return o; })(14);
const sma = (n, i) => { let s = 0; for (let j = i - n + 1; j <= i; j++) s += CL[j]; return s / n; };
const sd = (n, i, m) => { let s = 0; for (let j = i - n + 1; j <= i; j++) s += (CL[j] - m) ** 2; return Math.sqrt(s / n); };
const EM = { 20: ema(CL, 20), 50: ema(CL, 50), 9: ema(CL, 9) };
function corre(tipo, p, a, b) {
  let usd = 1, coin = 0, ref = 0, b0 = 0, pf = 0, ops = 0, ventas = 0, fuera = false;
  for (let i = 60; i < C.length; i++) { const [t, o, h, l, c] = C[i]; if (t < a || t >= b) continue; if (!b0) b0 = 1 / o; pf = c;
    const ok = regla.get(Math.floor((t + H4) / DIA) * DIA) ?? regla.get(Math.floor(t / DIA) * DIA);
    if (!ok) { if (coin > 0) { usd = coin * c * (1 - FEE); coin = 0; ops++; } fuera = false; continue; }
    if (coin === 0 && !fuera) { coin = usd * (1 - FEE) / c; usd = 0; ref = c; ops++; continue; } // entra por la regla
    let vende = false, compra = false;
    if (tipo === "rsi") { vende = rsi[i] >= p.alto; compra = rsi[i] <= p.bajo; }
    if (tipo === "bb") { const m = sma(20, i), s = sd(20, i, m); vende = c >= m + p.k * s; compra = p.media ? c <= m : c <= m - p.k * s; }
    if (tipo === "ema") { const e = EM[p.n][i]; vende = c < e; compra = c > e; }
    if (coin > 0 && vende && c >= ref * (1 + p.min)) { usd = coin * c * (1 - FEE); coin = 0; ops++; ventas++; fuera = true; }
    else if (fuera && (compra || (p.sube && c >= ref * (1 + p.sube)))) { coin = usd * (1 - FEE) / c; usd = 0; ref = c; ops++; fuera = false; }
    else if (fuera) ref = ref; }
  return { c: (usd / pf + coin) / b0, ventas, ops };
}
const ini = C[0][0], fin = C[C.length - 1][0] + H4, mit = ini + (fin - ini) / 2, pc = x => ((x - 1) * 100).toFixed(1) + "%";
const per = [[ini, fin], [ini, mit], [mit, fin]], R = [];
const add = (n, tipo, p) => R.push([n, per.map(([a, b]) => corre(tipo, p, a, b))]);
for (const min of [0.005, 0.012, 0.02]) for (const sube of [0, 0.03]) {
  for (const alto of [65, 70, 75]) for (const bajo of [35, 40, 45, 50]) add(`RSI ${alto}/${bajo} min${min * 100} s${sube * 100}`, "rsi", { alto, bajo, min, sube });
  for (const k of [1.5, 2]) for (const media of [0, 1]) add(`BB k${k} ${media ? "media" : "baja "} min${min * 100} s${sube * 100}`, "bb", { k, media, min, sube });
  for (const n of [9, 20, 50]) add(`EMA${n} min${min * 100} s${sube * 100}`, "ema", { n, min, sube }); }
add("solo regla (sin 4h)", "rsi", { alto: 999, bajo: 0, min: 9, sube: 0 });
R.sort((p, q) => Math.min(q[1][1].c, q[1][2].c) - Math.min(p[1][1].c, p[1][2].c));
const f = r => r.map(x => `${pc(x.c)} ${x.ventas}v`.padEnd(16)).join("");
console.log("BTC último año, velas 4h: año / 1a mitad / 2a mitad (BTC ganado, ventas). Bot actual: 66.9% / 68.1% / -0.7%, ~25 ventas");
for (const [n, r] of R.slice(0, 15)) console.log(n.padEnd(30), f(r));
console.log("con >=20 ventas:"); for (const [n, r] of R.filter(x => x[1][0].ventas >= 20).slice(0, 8)) console.log(n.padEnd(30), f(r));
console.log(R.find(x => x[0].startsWith("solo"))[0], f(R.find(x => x[0].startsWith("solo"))[1]));
