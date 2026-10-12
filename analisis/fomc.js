// Juntas de la Reserva Federal de EUA (día de la decisión de tasas). Fuente: calendarios públicos de la Fed.
const FOMC = `2018-01-31 2018-03-21 2018-05-02 2018-06-13 2018-08-01 2018-09-26 2018-11-08 2018-12-19
2019-01-30 2019-03-20 2019-05-01 2019-06-19 2019-07-31 2019-09-18 2019-10-30 2019-12-11
2020-01-29 2020-03-03 2020-03-15 2020-04-29 2020-06-10 2020-07-29 2020-09-16 2020-11-05 2020-12-16
2021-01-27 2021-03-17 2021-04-28 2021-06-16 2021-07-28 2021-09-22 2021-11-03 2021-12-15
2022-01-26 2022-03-16 2022-05-04 2022-06-15 2022-07-27 2022-09-21 2022-11-02 2022-12-14
2023-02-01 2023-03-22 2023-05-03 2023-06-14 2023-07-26 2023-09-20 2023-11-01 2023-12-13
2024-01-31 2024-03-20 2024-05-01 2024-06-12 2024-07-31 2024-09-18 2024-11-07 2024-12-18
2025-01-29 2025-03-19 2025-05-07 2025-06-18 2025-07-30 2025-09-17 2025-10-29 2025-12-10
2026-01-28 2026-03-18 2026-04-29 2026-06-17 2026-07-29 2026-09-16`.split(/\s+/).map(d => Date.parse(d));
module.exports = { FOMC };
if (require.main === module) {
  const fs = require("fs");
  for (const m of ["BTC", "ETH"]) {
    const L = fs.readFileSync(`diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(","));
    const T = L.map(c => Math.floor(+c[0] / 864e5) * 864e5), P = L.map(c => +c[4]), ret = P.map((p, i) => i ? p / P[i - 1] - 1 : 0);
    const S = new Set(FOMC), grupos = { "3 días antes": [], "día antes": [], "día de la junta": [], "día después": [], "otros días": [] };
    T.forEach((t, i) => { if (!i) return; const r = ret[i];
      if (S.has(t)) grupos["día de la junta"].push(r); else if (S.has(t + 864e5)) grupos["día antes"].push(r); else if (S.has(t - 864e5)) grupos["día después"].push(r); else grupos["otros días"].push(r);
      if (S.has(t + 3 * 864e5) || S.has(t + 2 * 864e5)) grupos["3 días antes"].push(r); });
    console.log(m); for (const [k, v] of Object.entries(grupos)) { const mu = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length); console.log(`  ${k.padEnd(16)} n=${String(v.length).padStart(4)} promedio ${(mu * 100).toFixed(2)}%  movimiento típico ${(sd * 100).toFixed(2)}%  (error ±${(sd / Math.sqrt(v.length) * 200).toFixed(2)}%)`); }
  }
}
