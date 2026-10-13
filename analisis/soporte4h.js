// Video mejorado en velas de 4h: soporte = mínimo de las últimas K velas de 4h; compra límite en soporte; vende +T%;
// stop si baja S% bajo el soporte (0 = sin stop); filtro = solo compra con la regla del bot en "tener" (codicia>=55 entrar, EMA20>EMA50).
// Simulación por minuto dentro de cada vela para no hacer trampa. Mide BTC equivalente.
const fs = require("fs"), zlib = require("zlib"), DIA = 864e5, H4 = 4 * 36e5, FEE = 0.00075;
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const D = fs.readFileSync("diarios/BTCUSDT-1d.csv", "utf8").trim().split("\n").map(l => l.split(",").map(Number));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const PD = D.map(c => c[4]), E20 = ema(PD, 20), E50 = ema(PD, 50), idx = new Map(D.map((c, i) => [c[0], i]));
const M = zlib.gunzipSync(fs.readFileSync("datos/BTCUSDT.csv.gz")).toString().trim().split("\n").map(l => l.split(",").map(Number));
const lows = new Map(); for (const [t, , , l] of M) { const k = Math.floor(t / H4) * H4; lows.set(k, Math.min(lows.get(k) ?? Infinity, l)); }
const K4 = [...lows.keys()].sort((a, b) => a - b), LO = K4.map(k => lows.get(k)), pos = new Map(K4.map((k, i) => [k, i]));
// estado de la regla del bot por día (con histéresis 55/25)
const regla = new Map(); { let s = false; for (const c of D) { const i = idx.get(c[0] - DIA), f = fg.get(Math.floor((c[0] - DIA) / DIA)); if (i == null || f == null) continue; const up = E20[i] > E50[i]; s = s ? (f > 25 && up) : (f >= 55 && up); regla.set(c[0], s); } }
function corre(K, T, S, filtro, a, b) {
  let usd = 1, coin = 0, ref = 0, sop = 0, b0 = 0, pf = 0, ventas = 0, stops = 0, kAct = -1, nivel = 0;
  for (const [t, o, h, l, c] of M) { if (t < a || t >= b) continue; if (!b0) b0 = 1 / o; pf = c;
    const k = Math.floor(t / H4) * H4; if (k !== kAct) { kAct = k; const i = pos.get(k); nivel = i >= K ? Math.min(...LO.slice(i - K, i)) : 0; }
    const ok = !filtro || regla.get(Math.floor(t / DIA) * DIA);
    if (coin > 0) {
      if (h >= ref * (1 + T)) { usd = coin * ref * (1 + T) * (1 - FEE); coin = 0; ventas++; }
      else if (S && l <= sop * (1 - S)) { usd = coin * sop * (1 - S) * (1 - FEE); coin = 0; stops++; }
      else if (filtro && !ok) { usd = coin * c * (1 - FEE); coin = 0; stops++; }
    } else if (ok && nivel && l <= nivel) { const p = Math.min(o, nivel); coin = usd * (1 - FEE) / p; usd = 0; ref = p; sop = nivel; nivel = 0; }
  }
  return { c: (usd / pf + coin) / b0, ventas, stops };
}
const ini = M[0][0], fin = M[M.length - 1][0] + 6e4, mit = ini + (fin - ini) / 2, pc = x => ((x - 1) * 100).toFixed(1) + "%";
const per = [[ini, fin], [ini, mit], [mit, fin]], R = [];
for (const K of [6, 12, 30, 60]) for (const T of [0.012, 0.02, 0.03, 0.05]) for (const S of [0, 0.01, 0.02, 0.04]) for (const filtro of [0, 1])
  R.push([`4h K${K} +${T * 100}% stop${S * 100} ${filtro ? "filtro" : ""}`, per.map(([a, b]) => corre(K, T, S, filtro, a, b))]);
R.sort((p, q) => Math.min(q[1][1].c, q[1][2].c) - Math.min(p[1][1].c, p[1][2].c));
const f = r => r.map(x => `${pc(x.c)} ${x.ventas}v/${x.stops}s`.padEnd(20)).join("");
console.log("BTC último año: año / 1a mitad / 2a mitad (BTC ganado, ventas con ganancia/stops)");
for (const [n, r] of R.slice(0, 15)) console.log(n.padEnd(28), f(r));
const top = R.filter(x => x[1][0].ventas >= 20).slice(0, 8); console.log("con >=20 ventas/año:"); for (const [n, r] of top) console.log(n.padEnd(28), f(r));
