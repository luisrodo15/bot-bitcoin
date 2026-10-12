// Estilo Holly AI: una biblioteca de estrategias; cada semana se prueban todas con los últimos N días
// y solo se usan las que pasan los filtros. Medido caminando hacia adelante (sin ver el futuro).
const fs = require("fs"), DIA = 864e5, FEE = 0.001;
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400) * DIA, +x.value]));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const sma = (A, n) => A.map((_, i) => { if (i < n - 1) return NaN; let s = 0; for (let k = i - n + 1; k <= i; k++) s += A[k]; return s / n; });
function preparar(m) {
  const L = fs.readFileSync(`diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(","));
  const T = L.map(c => Math.floor(+c[0] / DIA) * DIA), P = L.map(c => +c[4]), H = L.map(c => +c[2]), Lo = L.map(c => +c[3]);
  const I = { T, P, f: T.map(t => fg.get(t)) };
  for (const n of [10, 20, 30, 50, 100, 200]) { I["e" + n] = ema(P, n); I["s" + n] = sma(P, n); }
  const m12 = ema(P, 12), m26 = ema(P, 26), mc = m12.map((x, i) => x - m26[i]), sg = ema(mc, 9); I.macd = mc.map((x, i) => x - sg[i]);
  I.rsi = (() => { const o = [50]; let g = 0, l = 0; for (let i = 1; i < P.length; i++) { const d = P[i] - P[i - 1]; g = (g * 13 + Math.max(d, 0)) / 14; l = (l * 13 + Math.max(-d, 0)) / 14; o.push(l ? 100 - 100 / (1 + g / l) : 100); } return o; })();
  I.maxN = n => P.map((_, i) => i < n ? NaN : Math.max(...H.slice(i - n, i))); I.minN = n => P.map((_, i) => i < n ? NaN : Math.min(...Lo.slice(i - n, i)));
  I.hi20 = I.maxN(20); I.lo10 = I.minN(10); I.hi55 = I.maxN(55); I.lo20 = I.minN(20);
  return I;
}
// Cada estrategia: (I, i, dentro) -> true (estar en la moneda) / false / null (sin dato)
const EST = {
  "miedo/codicia 55/30 + EMA20>50": (I, i, en) => I.f[i] == null ? null : en ? (I.f[i] > 30 && I.e20[i] > I.e50[i]) : (I.f[i] >= 55 && I.e20[i] > I.e50[i]),
  "miedo/codicia 55/30": (I, i, en) => I.f[i] == null ? null : en ? I.f[i] > 30 : I.f[i] >= 55,
  "miedo/codicia 60/40": (I, i, en) => I.f[i] == null ? null : en ? I.f[i] > 40 : I.f[i] >= 60,
  "EMA10>EMA30": (I, i) => I.e10[i] > I.e30[i], "EMA20>EMA50": (I, i) => I.e20[i] > I.e50[i], "EMA50>EMA200": (I, i) => I.e50[i] > I.e200[i],
  "precio>SMA20": (I, i) => I.P[i] > I.s20[i], "precio>SMA50": (I, i) => I.P[i] > I.s50[i], "precio>SMA100": (I, i) => I.P[i] > I.s100[i], "precio>SMA200": (I, i) => I.P[i] > I.s200[i],
  "ruptura 20 días (sale en mínimo 10)": (I, i, en) => en ? I.P[i] > I.lo10[i] : I.P[i] > I.hi20[i],
  "ruptura 55 días (sale en mínimo 20)": (I, i, en) => en ? I.P[i] > I.lo20[i] : I.P[i] > I.hi55[i],
  "RSI impulso 55/45": (I, i, en) => en ? I.rsi[i] > 45 : I.rsi[i] > 55,
  "MACD arriba de señal": (I, i) => I.macd[i] > 0,
  "subió en 30 días": (I, i) => I.P[i] > I.P[i - 30],
  "subió en 90 días": (I, i) => I.P[i] > I.P[i - 90],
};
const N = Object.keys(EST);
// Señal diaria de cada estrategia corriendo sola desde el principio (para conocer su estado "dentro/fuera").
function senales(I) { const S = {}; for (const n of N) { let en = false; S[n] = I.P.map((_, i) => { if (i < 200) return null; const w = EST[n](I, i, en); if (w == null) return null; en = !!w; return en; }); } return S; }
// Rendimiento diario de cada estrategia (con comisión al cambiar)
function rendDiario(I, s) { return I.P.map((p, i) => { if (i < 1 || s[i - 1] == null) return 0; let r = s[i - 1] ? p / I.P[i - 1] - 1 : 0; if (s[i] != null && s[i] !== s[i - 1]) r -= FEE; return r; }); }
function evaluar(m, VENT, TOP) {
  const I = preparar(m), S = senales(I), R = Object.fromEntries(N.map(n => [n, rendDiario(I, S[n])]));
  const ini = I.T.findIndex(t => t >= Date.parse("2019-03-01"));
  let eqH = 1, eqF = 1, eqHold = 1, elegidas = [], mxH = 1, ddH = 0, cambios = 0, enH = false; const anual = {};
  for (let i = ini; i < I.P.length; i++) {
    // cada 7 días, como Holly cada noche: prueba todas con los últimos VENT días y se queda con las TOP mejores
    if ((i - ini) % 7 === 0) {
      const sc = N.map(n => { let e = 1, ok = true; for (let k = i - VENT; k < i; k++) { if (S[n][k] == null) ok = false; e *= 1 + R[n][k]; } return { n, e, ok }; }).filter(x => x.ok && x.e > 1).sort((a, b) => b.e - a.e);
      elegidas = sc.slice(0, TOP).map(x => x.n);
    }
    // posición: dentro si la mayoría de las elegidas dice "dentro" (si ninguna pasó el filtro, fuera)
    const votos = elegidas.filter(n => S[n][i - 1]).length, quiero = elegidas.length > 0 && votos * 2 > elegidas.length;
    let r = quiero ? I.P[i] / I.P[i - 1] - 1 : 0; if (quiero !== enH) { r -= FEE; cambios++; enH = quiero; }
    eqH *= 1 + r; eqF *= 1 + R[N[0]][i]; eqHold *= I.P[i] / I.P[i - 1];
    mxH = Math.max(mxH, eqH); ddH = Math.max(ddH, 1 - eqH / mxH);
    const y = new Date(I.T[i]).getUTCFullYear(); anual[y] = anual[y] || { h: 1, f: 1, g: 1 }; anual[y].h *= 1 + r; anual[y].f *= 1 + R[N[0]][i]; anual[y].g *= I.P[i] / I.P[i - 1];
  }
  return { eqH, eqF, eqHold, ddH, cambios, anual };
}
const pc = x => ((x - 1) * 100).toFixed(0) + "%";
for (const [VENT, TOP] of [[90, 3], [180, 3], [180, 5], [365, 3]]) {
  console.log(`\n== Estilo Holly: cada semana elige las ${TOP} mejores de los últimos ${VENT} días (2019-hoy)`);
  for (const m of ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA"]) { try { const r = evaluar(m, VENT, TOP); console.log(`${m.padEnd(5)} Holly ${pc(r.eqH).padStart(7)} (bajón ${(r.ddH * 100).toFixed(0)}%, ${r.cambios} cambios) | estrategia actual ${pc(r.eqF).padStart(7)} | guardar ${pc(r.eqHold).padStart(7)}`); } catch (e) { console.log(m, "sin datos suficientes"); } }
}
const b = evaluar("BTC", 180, 3); console.log("\nBTC por año (Holly 180/3 | actual | guardar):"); for (const [y, a] of Object.entries(b.anual)) console.log(y, pc(a.h), "|", pc(a.f), "|", pc(a.g));
