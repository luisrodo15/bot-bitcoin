// Idea 2026-10-17 (la pidió el usuario): entrar en la moneda de Futuros que MÁS subió en el día y salir rápido.
// Cada día, al cierre (00:00 UTC), toma la que más subió ese día (con volumen >= VMIN USDT) y opera al día siguiente:
//  - "largo": compra esperando que siga subiendo; "corto": apuesta a que baje después del brinco.
//  - Sale con +TP% o -SL%, o al cierre si pasaron H días. Si el mismo día toca las dos, cuenta la pérdida (lo peor).
// Comisión 0.05% por lado + 0.1% de deslizamiento por lado. Incluye monedas ya quitadas de Binance (sin sesgo).
// Datos: rama ganadoras (workflow ganadoras.yml). Correr: node analisis/ganadoras.js <carpeta con CSV>
const fs = require("fs"), dir = process.argv[2] || __dirname + "/ganadoras", COSTO = 2 * (0.0005 + 0.001);
const dias = new Map(); // día -> [{s, o,h,l,c, sube, vol}]
const serie = {};
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".csv"))) { const s = f.slice(0, -4);
  const v = fs.readFileSync(dir + "/" + f, "utf8").trim().split("\n").map(l => l.split(",").map(Number)).filter(x => x.length >= 6 && x[4] > 0);
  serie[s] = new Map(v.map(x => [x[0], x]));
  v.forEach((x, i) => { if (!i) return; const d = { s, sube: x[4] / v[i - 1][4] - 1, vol: x[5] * x[4] }; (dias.get(x[0]) || dias.set(x[0], []).get(x[0])).push(d); }); }
const D = [...dias.keys()].sort((a, b) => a - b), DIA = 864e5;
function corre(lado, minSube, VMIN, TP, SL, H, a, b) { const r = []; let libre = 0;
  for (const t of D) { if (t < a || t >= b || t < libre) continue;
    const top = dias.get(t).filter(d => d.vol >= VMIN).sort((p, q) => q.sube - p.sube)[0];
    if (!top || top.sube < minSube) continue;
    const S = serie[top.s], v0 = S.get(t + DIA); if (!v0) continue; const ent = v0[1]; let res = null, k = 0;
    for (; k < H; k++) { const v = S.get(t + DIA * (k + 1)); if (!v) { res = res ?? 0; break; } const [, , h, l, c] = v;
      const malo = lado > 0 ? l <= ent * (1 - SL) : h >= ent * (1 + SL), bueno = lado > 0 ? h >= ent * (1 + TP) : l <= ent * (1 - TP);
      if (malo) { res = -SL - 0.003; break; } if (bueno) { res = TP; break; } if (k === H - 1) res = lado * (c / ent - 1); }
    r.push(res - COSTO); libre = t + DIA * (k + 2); }
  return r; }
const per = [[2023], [2024], [2025], [2026]].map(([y]) => [Date.UTC(y, 0, 2), Date.UTC(y + 1, 0, 1)]);
// con pérdida máxima 1 USDT por entrada: tamaño = 1/SL USDT
console.log(`${Object.keys(serie).length} monedas, ${new Date(D[0]).toISOString().slice(0, 10)} a ${new Date(D.at(-1)).toISOString().slice(0, 10)}`);
console.log("USDT ganados arriesgando 1 USDT por entrada. Años: 2023 | 2024 | 2025 | 2026   (entradas, % que ganan)");
const filas = [];
for (const lado of [1, -1]) for (const minSube of [0.1, 0.3]) for (const VMIN of [2e7]) for (const [TP, SL] of [[0.05, 0.05], [0.1, 0.05], [0.2, 0.1], [0.3, 0.15], [0.03, 0.1]]) for (const H of [1, 3]) {
  const rs = per.map(([a, b]) => corre(lado, minSube, VMIN, TP, SL, H, a, b)), u = rs.map(r => r.reduce((s, x) => s + x, 0) / SL);
  const n = rs.flat().length, gana = rs.flat().filter(x => x > 0).length;
  filas.push({ txt: `${lado > 0 ? "largo" : "corto"} sube>=${minSube * 100}% +${TP * 100}/-${SL * 100}% ${H}d`.padEnd(32) + u.map(x => x.toFixed(1).padStart(7)).join("") + `  total ${u.reduce((s, x) => s + x, 0).toFixed(1).padStart(6)}  (${n}, ${(100 * gana / Math.max(n, 1)).toFixed(0)}%)`, pos: u.filter(x => x > 0).length }); }
filas.forEach(f => console.log(f.txt, f.pos === 4 ? "  <- positivo los 4 años" : ""));
