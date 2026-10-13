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
function corre(X, T, Y, Z, a, b, ATRK = 0) { const ventas = [];
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
        else if (armado) { if (T === 0) { const p = ref * (1 + X); usd += coin * p * (1 - FEE); ventas.push([t, true]); coin = 0; venta = p; armado = false; ops++; }
          else if (lo <= max * (1 - T)) { const p = Math.max(max * (1 - T), ref * (1 + X) * (1 - T)); usd += coin * p * (1 - FEE); ventas.push([t, p > ref * (1 + 2 * FEE)]); coin = 0; venta = p; armado = false; ops++; }
          else max = Math.max(max, h); }
      } else if (venta && (lo <= venta * (1 - Y) || h >= venta * (1 + Z))) { const p = lo <= venta * (1 - Y) ? venta * (1 - Y) : venta * (1 + Z); coin = usd * (1 - FEE) / p; usd = 0; ref = p; venta = 0; ops++; }
    }
    if (t - semIni >= SEM) { const bb = usd / c + coin; sem++; if (bb > semB * 1.0001) up++; else if (bb < semB * 0.9999) down++; semB = bb; semIni = t; }
  }
  const fin = usd + coin * pf; return { u: fin, c: (usd / pf + coin) / b0, up: up / sem, down: down / sem, ops: ops / ((b - a) / DIA / 365), ventas, a, b };
}
const pc = x => ((x - 1) * 100).toFixed(1) + "%";
const ini = M[0][0], fin = M[M.length - 1][0] + 6e4, mitad = ini + (fin - ini) / 2;
const per = [["año", ini, fin], ["1a mitad", ini, mitad], ["2a mitad", mitad, fin]];
// semanas "dentro" (tendencia buena al menos 4 días) y cuántas tuvieron venta ganadora
const dentroDia = new Set(); { let sen = false; for (const c of D) { const i = idx.get(c[0] - DIA), f = fg.get(Math.floor((c[0] - DIA) / DIA)); if (i == null || f == null) continue; const sube = E20[i] > E50[i]; sen = sen ? (f > 25 && sube) : (f >= 55 && sube); if (sen) dentroDia.add(c[0]); } }
const a0 = per[0][1], b0 = per[0][2], nS = Math.floor((b0 - a0) / SEM), semDentro = [];
for (let w = 0; w < nS; w++) { let k = 0; for (let d = 0; d < 7; d++) if (dentroDia.has(Math.floor((a0 + w * SEM) / DIA) * DIA + d * DIA)) k++; if (k >= 4) semDentro.push(w); }
const cob = r => { const S = new Set(r.ventas.filter(v => v[1]).map(([t]) => Math.floor((t - a0) / SEM))); return semDentro.filter(w => S.has(w)).length; };
const rows = [];
for (const X of [0.006, 0.008, 0.01, 0.012, 0.015]) for (const T of [0.001, 0.002, 0.003, 0.004, 0.005]) for (const Y of [0.005, 0.01, 0.015, 0.02, 0.025]) for (const zf of [0.5, 1, 2]) {
  if (T >= X - 0.0015) continue; const r = per.map(([, a, b]) => corre(X, T, Y, X * zf, a, b)); rows.push({ k: `+${X*100} stop${T*100} -${Y*100}/+${(X*zf*100).toFixed(1)}`, r, c: cob(r[0]) }); }
console.log(`semanas con tendencia buena: ${semDentro.length}`);
rows.sort((p, q) => q.c - p.c || Math.min(q.r[1].c, q.r[2].c) - Math.min(p.r[1].c, p.r[2].c));
for (const { k, r, c } of rows.slice(0, 12)) console.log(`${k.padEnd(24)} semanas con venta ${c}/${semDentro.length} BTC ${pc(r[0].c)} (${pc(r[1].c)} / ${pc(r[2].c)}) ventas ${r[0].ventas.length}`);
const act = rows.find(x => x.k === "+1.2 stop0.3 -2/+2.4"); console.log("ACTUAL", act.c, pc(act.r[0].c));
