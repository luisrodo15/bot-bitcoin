// Funding neutral: compras la moneda en Spot y abres el mismo tamaño en corto (Futuros 2x). El precio se cancela; cobras (o pagas) el funding.
// Capital = posición (Spot) + mitad de margen = 1.5x la posición. Cambiar de moneda o entrar/salir cuesta 0.25% de la posición.
const fs = require("fs"), H = process.env.DATOS || __dirname + "/funding/", COSTO = 0.0025, CAP = 1.5;
const M = ["BTC", "ETH", "BNB", "XRP", "SOL", "DOGE", "ADA", "LINK", "LTC", "TRX", "AVAX"];
const F = {}; for (const m of M) { F[m] = new Map(); for (const l of fs.readFileSync(H + m + "USDT.csv", "utf8").trim().split("\n")) { const [t, , r] = l.split(","); F[m].set(Math.round(+t / 288e5), +r); } }
const T = [...F.BTC.keys()].sort((a, b) => a - b);
const per = [[2020,1,2021,1],[2021,1,2022,1],[2022,1,2023,1],[2023,1,2024,1],[2024,1,2025,1],[2025,1,2026,10]].map(([x,a,y,b])=>[Date.UTC(x,a-1,1)/288e5,Date.UTC(y,b-1,1)/288e5]);
// regla(k) -> moneda o null, con datos hasta k-1
function corre(regla, a, b) { let cual = null, g = 0, n = 0, dentro = 0, tot = 0;
  for (let k = 30; k < T.length; k++) { const t = T[k]; if (t < a || t >= b) continue; tot++;
    const q = regla(k); if (q !== cual) { g -= COSTO * ((cual ? 1 : 0) + (q ? 1 : 0)) / 2 * 2; n++; cual = q; } // salir y entrar
    if (cual) { const r = F[cual].get(t); if (r != null) g += r; dentro++; } }
  const años = (b - a) * 288e5 / 3.156e10; return { pct: g / CAP / años * 100, n, dentro: dentro / tot }; }
const prom = (m, k, L) => { let s = 0, c = 0; for (let j = k - L; j < k; j++) { const r = F[m].get(T[j]); if (r != null) { s += r; c++; } } return c > L * 0.8 ? s / c : null; };
const fmt = r => r.map(y => `${y.pct.toFixed(1)}%`.padStart(7)).join("") + `  cambios ${r.reduce((a, y) => a + y.n, 0)}  dentro ${(r.reduce((a, y) => a + y.dentro, 0) / r.length * 100).toFixed(0)}%`;
console.log("% al año sobre tu capital. Años: 2020 | 2021 | 2022 | 2023 | 2024 | 2025-sep26");
for (const m of ["BTC", "ETH", "BNB", "XRP", "SOL", "DOGE"]) console.log(`siempre ${m}`.padEnd(34), fmt(per.map(([a, b]) => corre(() => m, a, b))));
for (const L of [9, 21, 63]) for (const U of [0, 0.0001, 0.0002]) for (const conj of [["BTC", "ETH"], M]) {
  const regla = k => { let mej = null, mv = U; for (const m of conj) { const p = prom(m, k, L); if (p != null && p > mv) { mv = p; mej = m; } } return mej; };
  // histéresis: solo cambia si la nueva paga claramente más (evita cambios por centavos)
  let act = null; const regla2 = k => { const best = regla(k); if (!best) return act = null; if (act && act !== best) { const pa = prom(act, k, L), pb = prom(best, k, L); if (pa != null && pa > U && pb - pa < 0.00005) return act; } return act = best; };
  console.log(`${conj.length > 2 ? "11 monedas" : "BTC/ETH"} prom ${L / 3}d >${(U * 3 * 365 * 100).toFixed(0)}%/año`.padEnd(34), fmt(per.map(([a, b]) => { act = null; return corre(regla2, a, b); }))); }
