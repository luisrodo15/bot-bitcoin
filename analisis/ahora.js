// Foto técnica de ahora para la revisión de cada hora. Uso: node analisis/ahora.js <carpeta de la rama "ahora"> [moneda]
// Lee velas de 15m/1h/4h/1d y el índice de miedo y codicia; imprime indicadores tipo TradingView y el estado de la regla del bot.
const fs = require("fs"), path = require("path"), D = process.argv[2] || "ahora", M = process.argv[3] || "BNB";
const leer = i => JSON.parse(fs.readFileSync(path.join(D, `${M}-${i}.json`))).map(k => ({ t: k[0], o: +k[1], h: +k[2], l: +k[3], c: +k[4], v: +k[5], fin: k[6] }));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const rsi = (P, n = 14) => { let g = 0, l = 0; for (let i = 1; i < P.length; i++) { const d = P[i] - P[i - 1]; g = (g * (n - 1) + Math.max(d, 0)) / n; l = (l * (n - 1) + Math.max(-d, 0)) / n; } return l ? 100 - 100 / (1 + g / l) : 100; };
const f = (x, d = 2) => x.toFixed(d), pc = x => (x >= 0 ? "+" : "") + (x * 100).toFixed(1) + "%";
function foto(i) { const V = leer(i).filter(k => k.fin < Date.now()), P = V.map(k => k.c), n = P.length - 1;
  const e20 = ema(P, 20), e50 = ema(P, 50), e200 = ema(P, 200), m = ema(P, 12).map((x, j) => x - ema(P, 26)[j]), s = ema(m, 9);
  const u = P.slice(-20), media = u.reduce((a, b) => a + b) / 20, de = Math.sqrt(u.reduce((a, b) => a + (b - media) ** 2, 0) / 20);
  const vol = V.slice(-21, -1).reduce((a, k) => a + k.v, 0) / 20, tr = V.slice(-14).map((k, j, A) => k.h - k.l);
  return { i, precio: P[n], rsi: rsi(P), macd: m[n] - s[n], macdAntes: m[n - 1] - s[n - 1], e20: e20[n], e50: e50[n], e200: e200[n], boll: (P[n] - (media - 2 * de)) / (4 * de || 1), volX: V[n].v / vol, atr: tr.reduce((a, b) => a + b) / 14 / P[n], max: Math.max(...V.slice(-50).map(k => k.h)), min: Math.min(...V.slice(-50).map(k => k.l)) }; }
const fg = JSON.parse(fs.readFileSync(path.join(D, "miedo-codicia.json"))).data.map(x => +x.value);
console.log(`${M} · datos de ${fs.readFileSync(path.join(D, "hora.txt"), "utf8").trim()} · miedo y codicia ${fg[0]} (hace 7 días ${fg[7]})`);
for (const i of ["15m", "1h", "4h", "1d"]) { const x = foto(i);
  console.log(`${i.padEnd(3)} precio ${f(x.precio)} | RSI ${f(x.rsi, 0)} | MACD ${x.macd > 0 ? "arriba" : "abajo"}${Math.sign(x.macd) !== Math.sign(x.macdAntes) ? " (recién cruzó)" : ""} | precio ${x.precio > x.e20 ? ">" : "<"} EMA20, EMA20 ${x.e20 > x.e50 ? ">" : "<"} EMA50, EMA50 ${x.e50 > x.e200 ? ">" : "<"} EMA200 | Bollinger ${f(x.boll * 100, 0)}% | volumen ${f(x.volX, 1)}x | ATR ${pc(x.atr)} | rango 50 velas ${f(x.min)}-${f(x.max)}`); }
const d = foto("1d"); console.log(`Regla del bot: ${fg[0] >= 55 ? "codicia" : fg[0] <= 25 ? "miedo" : "neutral"} y tendencia diaria ${d.e20 > d.e50 ? "arriba" : "abajo"} (EMA20 ${f(d.e20)} vs EMA50 ${f(d.e50)}, distancia ${pc(d.e20 / d.e50 - 1)}) -> ${fg[0] >= 55 && d.e20 > d.e50 ? "tener BNB" : fg[0] <= 25 || d.e20 < d.e50 ? "estar en USDT" : "mantener lo que tenga"}`);
