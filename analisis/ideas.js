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
// semanas (de 7 días desde el inicio) con al menos una venta con ganancia, para una lista de corridas (lotes)
function semanasConVenta(rs) { const [a, b] = [rs[0].a, rs[0].b], n = Math.floor((b - a) / SEM), S = new Set();
  for (const r of rs) for (const [t, g] of r.ventas) if (g) S.add(Math.floor((t - a) / SEM)); return { pct: S.size / n, n }; }
const base = [0.012, 0.003, 0.02, 0.024], chica = [[0.003, 0.002, 0.008, 0.003], [0.005, 0.002, 0.005, 0.005], [0.006, 0.001, 0.008, 0.012]];
const R = cfg => per.map(([, a, b]) => corre(...cfg, a, b));
const rb = R(base);
console.log(`ACTUAL: BTC ${pc(rb[0].c)} (${pc(rb[1].c)} / ${pc(rb[2].c)}) ventas ${rb[0].ventas.length} semanas con venta ganadora ${(semanasConVenta([rb[0]]).pct*100).toFixed(0)}%`);
// Idea 1: dividir en dos lotes: p del BTC opera con meta chica, el resto con la actual (lotes independientes -> resultado = mezcla)
for (const ch of chica) { const rc = R(ch);
  for (const pp of [0.2, 0.3, 0.5]) { const mix = i => pp * rc[i].c + (1 - pp) * rb[i].c;
    console.log(`lote ${pp*100}% a +${ch[0]*100}%: BTC ${pc(mix(0))} (${pc(mix(1))} / ${pc(mix(2))}) ventas ${rb[0].ventas.length + rc[0].ventas.length} semanas con venta ${(semanasConVenta([rb[0], rc[0]]).pct*100).toFixed(0)}%`); } }
const desde = Date.parse("2026-08-21"); for (const [n, cfg] of [["actual", base], ["+0.6", chica[2]], ["+0.3", chica[0]]]) { const r = corre(...cfg, per[0][1], per[0][2]); const v = r.ventas.filter(([t, g]) => t >= desde);
 const sem = new Set(v.filter(x => x[1]).map(([t]) => Math.floor((t - desde) / SEM))); console.log(`${n}: desde 21-ago ventas ${v.length}, ganadoras ${v.filter(x => x[1]).length}, semanas con venta ${sem.size} de ${Math.floor((per[0][2] - desde) / SEM)}`); }
