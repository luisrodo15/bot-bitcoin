// ¿Vigilar minuto a minuto mejora la estrategia diaria? Señal diaria (miedo/codicia 55/25 + EMA20>50) y además,
// cada minuto, una protección: sale si el precio cae X% desde el máximo desde que compró (o desde la compra),
// y no vuelve a comprar hasta el día siguiente con señal. Datos de 1 minuto de los últimos 12 meses.
const fs = require("fs"), zlib = require("zlib"), DIA = 864e5, FEE = 0.001;
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
function senalDiaria(m) { const L = fs.readFileSync(`diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").map(Number));
  const P = L.map(c => c[4]), e20 = ema(P, 20), e50 = ema(P, 50), S = new Map(); let en = false;
  for (let i = 50; i < L.length; i++) { const f = fg.get(Math.floor(L[i][0] / DIA)); if (f == null) continue; const sube = e20[i] > e50[i];
    en = en ? (f > 25 && sube) : (f >= 55 && sube); S.set(Math.floor(L[i][0] / DIA) + 1, { en, compra: f >= 55 && sube }); } // vale para el día siguiente
  return S; }
function corre(m, stop, tipo) { const S = senalDiaria(m), L = zlib.gunzipSync(fs.readFileSync(`datos/${m}USDT.csv.gz`)).toString().trim().split("\n");
  let e = 1, en = false, ent = 0, max = 0, bloqueado = -1, ops = 0, paradas = 0, prev = null, mx = 1, dd = 0;
  for (const l of L) { const c = l.split(","), t = +c[0], p = +c[4], d = Math.floor(t / DIA), s = S.get(d); if (!s) { prev = p; continue; }
    if (en && prev) e *= p / prev;
    if (en) { max = Math.max(max, p); const ref = tipo === "desde máximo" ? max : ent;
      if (!s.en) { en = false; e *= 1 - FEE; ops++; }
      else if (stop && p <= ref * (1 - stop)) { en = false; e *= 1 - FEE; ops++; paradas++; bloqueado = d; } }
    else if (s.en && s.compra !== undefined && d !== bloqueado && (stop ? s.compra : true)) { en = true; ent = max = p; e *= 1 - FEE; ops++; }
    mx = Math.max(mx, e); dd = Math.max(dd, 1 - e / mx); prev = p; }
  return { e, ops, paradas, dd }; }
const pc = x => ((x - 1) * 100).toFixed(1) + "%", MON = ["SOL","BTC","ETH","BNB","XRP","DOGE","ADA"];
const V = [[0, "sin protección"]]; for (const s of [0.03, 0.05, 0.08, 0.12, 0.15]) for (const tipo of ["desde máximo", "desde compra"]) V.push([s, tipo]);
console.log("variante".padEnd(28), MON.map(m => m.padStart(15)).join(""));
for (const [s, tipo] of V) { const r = MON.map(m => corre(m, s, tipo)); console.log((s ? `sale si cae ${s * 100}% ${tipo}` : tipo).padEnd(28), r.map(x => `${pc(x.e)} b${(x.dd * 100).toFixed(0)}`.padStart(15)).join(""), " típico", pc(Math.exp(r.reduce((a, x) => a + Math.log(x.e), 0) / r.length))); }
