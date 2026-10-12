// Estrategias con el índice de miedo y codicia (noticias + redes sociales) en precios diarios.
const fs = require("fs"), D = process.argv[2] || "diarios";
const fg = new Map(JSON.parse(fs.readFileSync(`${D}/miedo-codicia.json`)).data.map(x => [Math.floor(+x.timestamp / 86400) * 86400e3, +x.value]));
const FEE = 0.001, CORTE = Date.parse("2023-01-01");
function corre(S, regla, a, b) { // regla(v, enMoneda) -> true = estar en la moneda
  let usdt = 1, q = 0, max = 1, dd = 0, ops = 0;
  for (let i = a; i < b; i++) { const p = S.P[i], v = fg.get(S.T[i]); if (v == null) continue;
    const quiero = regla(v, q > 0, S, i);
    if (quiero && !q) { q = usdt * (1 - FEE) / p; usdt = 0; ops++; } else if (!quiero && q) { usdt = q * p * (1 - FEE); q = 0; ops++; }
    const eq = usdt + q * p; if (eq > max) max = eq; dd = Math.max(dd, 1 - eq / max); }
  return { x: usdt + q * S.P[b - 1], dd, ops };
}
const monedas = {};
for (const m of "BTC,ETH,SOL,BNB,XRP,DOGE,ADA".split(",")) {
  const L = fs.readFileSync(`${D}/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(","));
  const S = { T: L.map(c => Math.floor(+c[0] / 864e5) * 864e5), P: L.map(c => +c[4]) };
  S.i0 = S.T.findIndex(t => fg.has(t)); S.ic = S.T.findIndex(t => t >= CORTE); monedas[m] = S;
}
const reglas = [];
for (const X of [10, 15, 20, 25, 30, 35, 40, 45]) for (const Y of [50, 55, 60, 65, 70, 75, 80, 85, 90]) {
  reglas.push({ n: `contra: compra con miedo<=${X}, vende con codicia>=${Y}`, f: (v, en) => en ? v < Y : v <= X });
  reglas.push({ n: `sigue: compra con codicia>=${Y}, vende con miedo<=${X}`, f: (v, en) => en ? v > X : v >= Y });
}
const fmt = r => `${((r.x - 1) * 100).toFixed(0)}%`;
const res = reglas.map(R => { const a = {}, b = {}; for (const [m, S] of Object.entries(monedas)) { a[m] = corre(S, R.f, S.i0, S.ic); b[m] = corre(S, R.f, S.ic, S.P.length); } return { R, a, b }; });
const score = o => Object.values(o).reduce((s, r) => s + Math.log(r.x), 0);
res.sort((x, y) => score(y.a) - score(x.a));
const hold = Object.fromEntries(Object.entries(monedas).map(([m, S]) => [m, { a: corre(S, () => true, S.i0, S.ic), b: corre(S, () => true, S.ic, S.P.length) }]));
console.log("Solo guardar:  2018-2022 | 2023-hoy");
for (const m in hold) console.log(`  ${m}: ${fmt(hold[m].a)} (bajón máx ${(hold[m].a.dd * 100).toFixed(0)}%) | ${fmt(hold[m].b)} (bajón ${(hold[m].b.dd * 100).toFixed(0)}%)`);
console.log("\nMejores reglas elegidas con 2018-2022, y cómo les fue en 2023-hoy (por moneda):");
for (const r of res.slice(0, 6)) console.log(r.R.n, "\n   elegir:", Object.entries(r.a).map(([m, x]) => `${m} ${fmt(x)}`).join(", "), "\n   probar:", Object.entries(r.b).map(([m, x]) => `${m} ${fmt(x)} (hold ${fmt(hold[m].b)}, bajón ${(x.dd * 100).toFixed(0)}%, ${x.ops} ops)`).join(", "));
const ganaHold = res.slice(0, 20).map(r => Object.keys(monedas).filter(m => r.b[m].x > hold[m].b.x).length);
console.log("\nTop 20: en cuántas monedas le ganan a solo guardar en 2023-hoy:", ganaHold.join(" "));
console.log("Top 20: en cuántas monedas ganan dinero en 2023-hoy:", res.slice(0, 20).map(r => Object.values(r.b).filter(x => x.x > 1).length).join(" "));
// Último año (oct 2025 - hoy), con varias reglas vecinas, para ver si protege en la bajada.
const ini = Date.parse("2025-10-01");
console.log("\nÚltimo año (oct 2025-hoy): regla | por moneda resultado (solo guardar)");
for (const [X, Y] of [[30, 55], [35, 55], [40, 55], [30, 50], [40, 60], [25, 60], [35, 65]]) {
  const f = (v, en) => en ? v > X : v >= Y;
  console.log(`codicia>=${Y} / miedo<=${X}:`, Object.entries(monedas).map(([m, S]) => { const a = S.T.findIndex(t => t >= ini); const r = corre(S, f, a, S.P.length), h = corre(S, () => true, a, S.P.length); return `${m} ${fmt(r)} (${fmt(h)}) ${r.ops}ops`; }).join(", "));
}
// Año por año para BTC con la regla 30/55
for (const y of [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]) { const S = monedas.BTC, a = S.T.findIndex(t => t >= Date.parse(`${y}-01-01`)), b0 = S.T.findIndex(t => t >= Date.parse(`${y + 1}-01-01`)), b = b0 < 0 ? S.P.length : b0; const f = (v, en) => en ? v > 30 : v >= 55; console.log(`BTC ${y}: regla ${fmt(corre(S, f, Math.max(a, S.i0), b))}  guardar ${fmt(corre(S, () => true, Math.max(a, S.i0), b))}`); }
