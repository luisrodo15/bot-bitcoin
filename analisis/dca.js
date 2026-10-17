// DCA: aportar lo mismo cada semana (10 USDT) y ver cuánto vale al final. Normal vs "inteligente".
// Inteligente: la misma aportación semanal, pero se guarda en USDT y se compra más cuando está barato (miedo o abajo de su SMA200).
const fs = require("fs"), FEE = 0.001, AP = 10;
const fg = new Map(JSON.parse(fs.readFileSync(__dirname + "/diarios/miedo-codicia.json")).data.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
const per = [[2018,2,2027,1],[2018,2,2021,1],[2021,1,2023,1],[2023,1,2025,1],[2025,1,2027,1]].map(([x,a,y,b])=>[Date.UTC(x,a-1,1),Date.UTC(y,b-1,1)]);
const sma = (a, n) => { const o = []; let s = 0; a.forEach((c, j) => { s += c; if (j >= n) s -= a[j - n]; o.push(j >= n - 1 ? s / n : null); }); return o; };
function corre(C, modo, a, b) { const cl = C.map(c => c[4]), m200 = sma(cl, 200); let coin = 0, caja = 0, puesto = 0, ult = 0;
  for (let i = 201; i < C.length; i++) { const [t, , , , c] = C[i]; if (t < a || t >= b) continue; ult = c; if (new Date(t).getUTCDay() !== 1) continue;
    puesto += AP; caja += AP; const f = fg.get(Math.floor(t / 864e5)) ?? 50, barato = c < m200[i - 1], miedo = f <= 25;
    let gasta = modo === "normal" ? caja : modo === "sma200" ? (barato ? caja : AP * 0.5) : modo === "miedo" ? (miedo ? caja : AP * 0.5) : (barato || miedo ? caja : AP * 0.5);
    gasta = Math.min(gasta, caja); coin += gasta * (1 - FEE) / c; caja -= gasta; }
  const valor = coin * ult + caja; return { puesto, valor, g: (valor / puesto - 1) * 100 }; }
for (const m of ["BTC", "ETH"]) { const C = fs.readFileSync(__dirname + `/diarios/${m}USDT-1d.csv`, "utf8").trim().split("\n").map(l => l.split(",").slice(0, 5).map(Number));
  console.log(`\n${m}: ganancia % sobre lo aportado. 2018-hoy | 2018-20 | 2021-22 | 2023-24 | 2025-hoy`);
  for (const modo of ["normal", "sma200", "miedo", "ambos"]) console.log(`  ${modo}`.padEnd(10), per.map(([a, b]) => corre(C, modo, a, b)).map(r => `${r.g.toFixed(0)}%`.padStart(7)).join(""), `  (2018-hoy: puso ${corre(C, modo, ...per[0]).puesto}, vale ${corre(C, modo, ...per[0]).valor.toFixed(0)})`); }
