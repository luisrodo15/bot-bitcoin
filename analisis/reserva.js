// ¿Conviene guardar USDT y comprar BTC solo si baja X%? Para cada día: comprar ya vs. esperar bajada de X% desde ese día
// (si en N días no baja, compra al precio de ese momento). Mide BTC obtenido por cada dólar, relativo a comprar ya.
const fs = require("fs"); const m = process.argv[2] || "BTC";
const D = fs.readFileSync(`diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").map(Number));
const res = (X, N, a, b) => { let s = 0, n = 0, gana = 0;
  for (let i = 0; i < D.length - N; i++) { if (D[i][0] < a || D[i][0] >= b) continue; const p0 = D[i][4], meta = p0 * (1 - X); let p = D[i + N][4];
    for (let j = i + 1; j <= i + N; j++) if (D[j][3] <= meta) { p = meta; break; }
    const r = p0 / p; s += r; n++; if (r > 1) gana++; }
  return [((s / n - 1) * 100).toFixed(2) + "%", (gana / n * 100).toFixed(0) + "%"]; };
const Y = 365 * 864e5, fin = D[D.length - 1][0];
const per = [["2018-22", Date.UTC(2018), Date.UTC(2023)], ["2023-hoy", Date.UTC(2023), fin], ["último año", fin - Y, fin]];
console.log(m, "promedio de BTC extra vs comprar ya | % de veces que ganó");
for (const X of [0.02, 0.03, 0.05]) for (const N of [3, 7, 14]) console.log(`baja ${X * 100}% espera ${N}d`.padEnd(20), per.map(([k, a, b]) => `${k}: ${res(X, N, a, b).join(" ")}`.padEnd(28)).join(""));
