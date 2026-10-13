// Estrategia que propuso ChatGPT (2026-10-13): entra si 4h EMA50>EMA200, 1h precio>EMA200, retroceso a EMA20 de 1h y vela que rebota.
// Sale a +TP% o -SL%. Una operación a la vez. Velas de 1h/4h armadas de datos de 1 minuto; TP/SL revisados minuto a minuto.
const fs = require("fs"), zlib = require("zlib"), FEE = +(process.argv[3] || 0.00075), DIA = 864e5, SEM = 7 * DIA;
const m = process.argv[2] || "BTC";
const M = zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n").map(l => l.split(",").map(Number));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const velas = ms => { const V = []; for (const [t, o, h, l, c] of M) { const b = Math.floor(t / ms) * ms, u = V[V.length - 1];
  if (!u || u.t !== b) V.push({ t: b, o, h, l, c }); else { u.h = Math.max(u.h, h); u.l = Math.min(u.l, l); u.c = c; } } return V; };
const H = velas(36e5), F = velas(4 * 36e5);
const h20 = ema(H.map(v => v.c), 20), h200 = ema(H.map(v => v.c), 200), f50 = ema(F.map(v => v.c), 50), f200 = ema(F.map(v => v.c), 200);
const fIdx = new Map(F.map((v, i) => [v.t, i]));
// señal al cierre de cada vela de 1h (usa la última vela de 4h ya cerrada)
const senal = new Map();
H.forEach((v, i) => { if (i < 200) return; const fi = fIdx.get(Math.floor(v.t / 144e5) * 144e5) - 1; if (!(fi >= 200)) return;
  const ok = f50[fi] > f200[fi] && v.c > h200[i] && v.l <= h20[i] * 1.001 && v.c > h20[i] && v.c > v.o;
  if (ok) senal.set(v.t + 36e5, true); });
function corre(TP, SL) {
  let usd = 1, coin = 0, ent = 0, ops = 0, gan = 0, per = 0, b0 = 0, pf = 0, semB = 0, semIni = 0, up = 0, down = 0, sem = 0;
  for (const [t, o, h, l, c] of M) { if (!b0) { b0 = 1 / o; semB = b0; semIni = t; } pf = c;
    if (coin) { if (l <= ent * (1 - SL)) { usd = coin * ent * (1 - SL) * (1 - FEE); coin = 0; per++; ops++; }
      else if (h >= ent * (1 + TP)) { usd = coin * ent * (1 + TP) * (1 - FEE); coin = 0; gan++; ops++; } }
    else if (t % 36e5 === 0 && senal.get(t)) { coin = usd * (1 - FEE) / o; usd = 0; ent = o; }
    if (t - semIni >= SEM) { const bb = usd / c + coin; sem++; if (bb > semB * 1.0001) up++; else if (bb < semB * 0.9999) down++; semB = bb; semIni = t; } }
  const fin = usd + coin * pf; return { usdt: fin, btc: (usd / pf + coin) / b0, ops, gan, per, up: up / sem, down: down / sem };
}
const pc = x => ((x - 1) * 100).toFixed(1) + "%";
console.log(`${m} ${new Date(M[0][0]).toISOString().slice(0,10)} a ${new Date(M[M.length-1][0]).toISOString().slice(0,10)}, comisión ${FEE*100}% por lado. Precio: ${pc(M[M.length-1][4]/M[0][1])}`);
for (const [tp, sl] of [[0.015, 0.008], [0.012, 0.008], [0.02, 0.01], [0.015, 0.015]]) { const r = corre(tp, sl);
  console.log(`TP +${tp*100}% SL -${sl*100}%: USDT ${pc(r.usdt)} | cantidad BTC ${pc(r.btc)} | ${r.ops} ops (${r.gan} ganadas, ${r.per} perdidas) | semanas +BTC ${(r.up*100).toFixed(0)}% / -BTC ${(r.down*100).toFixed(0)}%`); }
