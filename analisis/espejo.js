// Futuros BTC: bot actual (largo) + extras en futuros 1x. Datos de 1 minuto, mide en cantidad de BTC.
// espera: corto mientras el bot vendió y espera recomprar. espejo: en tendencia de bajada (EMA20<EMA50) hace el bot al revés
// (corto; cierra con +X% de ganancia y stop T desde el mínimo; vuelve a abrir corto si rebota +Y% o si cae Z% más).
// lev: apalancamiento del largo (futuros). Comisión spot 0.075%, futuros 0.05%/lado. Sin funding (los cortos normalmente cobran).
const fs = require("fs"), zlib = require("zlib"), DIA = 864e5, SEM = 7 * DIA, FS = 0.00075, FF = 0.0005;
const fg = new Map(JSON.parse(fs.readFileSync("diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const D = fs.readFileSync("diarios/BTCUSDT-1d.csv", "utf8").trim().split("\n").map(l => l.split(",").map(Number));
const ema = (A, n) => { const k = 2 / (n + 1), o = []; A.forEach((p, i) => o.push(i ? p * k + o[i - 1] * (1 - k) : p)); return o; };
const PD = D.map(c => c[4]), E20 = ema(PD, 20), E50 = ema(PD, 50), idx = new Map(D.map((c, i) => [c[0], i]));
const M = zlib.gunzipSync(fs.readFileSync("datos/BTCUSDT.csv.gz")).toString().trim().split("\n").map(l => l.split(",").map(Number));
function corre(o, a, b) {
  const { X = 0.012, T = 0.003, Y = 0.02, Z = 0.024, espera = false, espejo = false, lev = 1, sX = 0.012, sT = 0.003, sY = 0.02, sZ = 0.024 } = o;
  let eq = 1, pos = 0, E = 0, L = 1, fee = 0;   // pos +1 largo, -1 corto
  const abre = (p, s, l, f) => { pos = s; E = p; L = l; fee = f; eq *= 1 - f * l; };
  const cierra = p => { eq *= 1 + pos * L * (p / E - 1); eq *= 1 - fee * L; pos = 0; };
  let sen = false, baja = false, ref = 0, venta = 0, armado = false, max = 0, sref = 0, sventa = 0, sarm = false, smin = 0;
  let dia = -1, b0 = 0, pf = 0, ops = 0, liq = 0, semIni = 0, semB = 0, sem = 0, up = 0, down = 0;
  const fL = lev > 1 ? FF : FS;
  for (const [t, op, h, lo, c] of M) { if (t < a || t >= b) continue; if (!b0) { b0 = 1 / op; semB = b0; semIni = t; } pf = c;
    const d = Math.floor(t / DIA) * DIA;
    if (d !== dia) { dia = d; const i = idx.get(d - DIA), f = fg.get(Math.floor((d - DIA) / DIA)); if (i != null && f != null) {
      const sube = E20[i] > E50[i], nuevo = sen ? (f > 25 && sube) : (f >= 55 && sube);
      if (sen && !nuevo) { if (pos) { cierra(op); ops++; } venta = 0; armado = false; }
      if (!sen && nuevo) { if (pos) { cierra(op); ops++; } abre(op, 1, lev, fL); ref = op; venta = 0; armado = false; ops++; sventa = 0; }
      sen = nuevo; const nb = espejo && !sube;
      if (nb && !baja && !pos) { abre(op, -1, 1, FF); sref = op; sventa = 0; sarm = false; ops++; }
      if (!nb && baja && pos < 0) { cierra(op); ops++; }
      if (!nb) sventa = 0; baja = nb; } }
    // liquidación del largo apalancado
    if (pos > 0 && L > 1 && lo <= E * (1 - 0.95 / L)) { eq *= 1 - 0.95; pos = 0; liq++; venta = 0; armado = false; }
    if (sen) {
      if (pos > 0) {
        if (!armado && h >= ref * (1 + X)) { armado = true; max = h; }
        else if (armado) { if (lo <= max * (1 - T)) { const p = Math.max(max * (1 - T), ref * (1 + X) * (1 - T)); cierra(p); ops++; venta = p; armado = false;
            if (espera) { abre(p, -1, 1, FF); ops++; } } else max = Math.max(max, h); }
      } else if (venta && (lo <= venta * (1 - Y) || h >= venta * (1 + Z))) { const p = lo <= venta * (1 - Y) ? venta * (1 - Y) : venta * (1 + Z);
        if (pos < 0) { cierra(p); ops++; } abre(p, 1, lev, fL); ref = p; venta = 0; ops++; }
    } else if (baja) {
      if (pos < 0) {
        if (!sarm && lo <= sref * (1 - sX)) { sarm = true; smin = lo; }
        else if (sarm) { if (h >= smin * (1 + sT)) { const p = Math.min(smin * (1 + sT), sref * (1 - sX) * (1 + sT)); cierra(p); ops++; sventa = p; sarm = false; } else smin = Math.min(smin, lo); }
      } else if (sventa && (h >= sventa * (1 + sY) || lo <= sventa * (1 - sZ))) { const p = h >= sventa * (1 + sY) ? sventa * (1 + sY) : sventa * (1 - sZ);
        abre(p, -1, 1, FF); sref = p; sventa = 0; ops++; }
    }
    if (t - semIni >= SEM) { const v = eq * (pos ? 1 + pos * L * (c / E - 1) : 1) / c; sem++; if (v > semB * 1.0001) up++; else if (v < semB * 0.9999) down++; semB = v; semIni = t; }
  }
  const v = eq * (pos ? 1 + pos * L * (pf / E - 1) : 1);
  return { u: v, c: v / pf / b0, up: up / sem, down: down / sem, ops: ops / ((b - a) / DIA / 365), liq };
}
const pc = x => ((x - 1) * 100).toFixed(1) + "%";
const ini = M[0][0], fin = M[M.length - 1][0] + 6e4, mitad = ini + (fin - ini) / 2;
const per = [["año", ini, fin], ["1a mitad", ini, mitad], ["2a mitad", mitad, fin]];
const V = JSON.parse(process.argv[2] || "null") || [
  ["bot actual", {}], ["+ corto esperando", { espera: true }], ["+ espejo en bajada", { espejo: true }], ["+ ambos", { espera: true, espejo: true }],
  ["largo 1.5x", { lev: 1.5 }], ["largo 2x", { lev: 2 }], ["largo 2x + ambos", { lev: 2, espera: true, espejo: true }],
  ["espejo +2/-3/+3", { espejo: true, sX: 0.02, sT: 0.005, sY: 0.03, sZ: 0.03 }], ["espejo +3/-3/+3 stop1", { espejo: true, sX: 0.03, sT: 0.01, sY: 0.03, sZ: 0.03 }],
  ["espejo +1.5/-2/+3 stop.5", { espejo: true, sX: 0.015, sT: 0.005, sY: 0.02, sZ: 0.03 }]];
console.log("BTC (cantidad de BTC)".padEnd(28), per.map(p => p[0].padEnd(30)).join(""));
for (const [n, o] of V) { const r = per.map(([, a, b]) => corre(o, a, b));
  console.log(n.padEnd(28), r.map(x => `${pc(x.c)} usdt ${pc(x.u)} ${x.ops.toFixed(0)}op${x.liq ? " LIQ" + x.liq : ""}`.padEnd(30)).join("")); }
