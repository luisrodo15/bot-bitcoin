// Estrategias que operan casi a diario con velas de 1 hora (futuros, 2x, comisión 0.05% por lado + 0.02% deslizamiento).
// Dirección según la tendencia diaria (cierre diario vs promedio de N días); entrada en retroceso de 1h (RSI14 1h);
// salida en +TP, -SL o tras H horas. Uso: node horas.js archivo.csv
const fs = require("fs");
const v = fs.readFileSync(process.argv[2] || "/tmp/claude-0/h/ETH.csv", "utf8").trim().split("\n").map(l => l.split(",").map(Number)).map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
const COM = 0.0007;
// diario
const dias = []; for (const x of v) { const d = Math.floor(x.t / 864e5); if (!dias.length || dias[dias.length - 1].d !== d) dias.push({ d, c: x.c }); else dias[dias.length - 1].c = x.c; }
const smaD = (n) => { const m = {}; let s = 0; dias.forEach((x, i) => { s += x.c; if (i >= n) s -= dias[i - n].c; if (i >= n - 1) m[x.d] = s / n; }); return m; };
const cierreD = {}; dias.forEach(x => cierreD[x.d] = x.c);
// RSI 1h
const rsi = new Array(v.length).fill(50); { let g = 0, p = 0; for (let i = 1; i < v.length; i++) { const d = v[i].c - v[i - 1].c; g = (g * 13 + Math.max(d, 0)) / 14; p = (p * 13 + Math.max(-d, 0)) / 14; rsi[i] = p ? 100 - 100 / (1 + g / p) : 100; } }
function sim({ N, R, TP, SL, H, corto, rompe }, desde, hasta) {
  const sm = smaD(N); let cap = 1, ops = 0, gan = 0, pos = null;
  for (let i = 30; i < v.length; i++) {
    const x = v[i]; if (x.t < desde || x.t >= hasta) continue;
    if (pos) {
      const sl = pos.lado > 0 ? x.l <= pos.p * (1 - SL) : x.h >= pos.p * (1 + SL), tp = pos.lado > 0 ? x.h >= pos.p * (1 + TP) : x.l <= pos.p * (1 - TP);
      let r = null; if (sl) r = -SL; else if (tp) r = TP; else if (i - pos.i >= H) r = pos.lado * (x.c / pos.p - 1);
      if (r !== null) { const res = 2 * (r - COM); cap *= 1 + res * 0.5; ops++; if (res > 0) gan++; pos = null; } // 2x sobre la mitad del capital (margen ~1 posición)
      continue;
    }
    const d = Math.floor(x.t / 864e5) - 1, s = sm[d], c = cierreD[d]; if (!s) continue; // tendencia con el cierre de AYER
    const lado = c > s ? 1 : corto ? -1 : 0; if (!lado) continue;
    if (rompe) { // rompimiento: cierre de 1h arriba del máximo (o abajo del mínimo) de las últimas R horas
      let mx = -1e18, mn = 1e18; for (let k = i - R; k < i; k++) { mx = Math.max(mx, v[k].h); mn = Math.min(mn, v[k].l); }
      if (lado > 0 && x.c > mx) pos = { lado, p: x.c, i }; if (lado < 0 && x.c < mn) pos = { lado, p: x.c, i }; continue;
    }
    if (lado > 0 && rsi[i] < R) pos = { lado, p: x.c, i };
    if (lado < 0 && rsi[i] > 100 - R) pos = { lado, p: x.c, i };
  }
  return { r: cap - 1, ops, gan };
}
const P = [["2020", 2020, 2021], ["2021", 2021, 2022], ["2022", 2022, 2023], ["2023", 2023, 2024], ["2024", 2024, 2025], ["2025-hoy", 2025, 2027]].map(([n, a, b]) => [n, Date.UTC(a, 0), Date.UTC(b, 0)]);
const res = [];
for (const rompe of [false, true]) for (const N of [30, 45, 60]) for (const R of (rompe ? [12, 24, 48, 72] : [25, 30, 35, 40])) for (const TP of [0.01, 0.015, 0.02, 0.03]) for (const SL of [0.01, 0.015, 0.02, 0.03]) for (const H of [12, 24, 48]) for (const corto of [false, true]) {
  const p = P.map(([n, a, b]) => sim({ N, R, TP, SL, H, corto, rompe }, a, b));
  res.push({ rompe, N, R, TP, SL, H, corto, p, min: Math.min(...p.map(x => x.r)), ops: p.reduce((a, x) => a + x.ops, 0) / P.length });
}
res.sort((a, b) => b.min - a.min);
const f = x => (x * 100).toFixed(0).padStart(4) + "%";
console.log("positivas en todos los años:", res.filter(x => x.min > 0).length, "de", res.length);
for (const x of res.slice(0, 12)) console.log(`${x.rompe ? 'rompe' + x.R + 'h' : 'RSI<' + x.R} N${x.N} TP${x.TP * 100}% SL${x.SL * 100}% H${x.H} ${x.corto ? "L+C" : "L"} ops/año ${x.ops.toFixed(0)} |`, x.p.map(y => f(y.r)).join(" "));
const op = res.filter(x => x.ops >= 150).sort((a, b) => b.min - a.min);
console.log("--- con >=150 ops/año:"); for (const x of op.slice(0, 6)) console.log(`${x.rompe ? 'rompe' + x.R + 'h' : 'RSI<' + x.R} N${x.N} TP${x.TP * 100}% SL${x.SL * 100}% H${x.H} ${x.corto ? "L+C" : "L"} ops/año ${x.ops.toFixed(0)} |`, x.p.map(y => f(y.r)).join(" "));
