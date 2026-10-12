// Con 12 (o 100) USDT: ¿mejor reinvertir todo en BNB o pasar cada ganancia a Bitcoin?
const fs = require("fs"); const src = fs.readFileSync("holly.js", "utf8").split("const pc =")[0].replace('const fs = require("fs"), ', "const ");
eval(src + `
const I = preparar("BNB"), B = preparar("BTC"), bp = new Map(B.T.map((t, i) => [t, B.P[i]])), fee = 0.00075;
function corre(desde, monto, modo) { const a = I.T.findIndex(t => t >= Date.parse(desde)); let usdt = monto, bnb = 0, costo = 0, en = false, porPasar = 0, btc = 0, ganado = 0, pasado = 0;
  for (let i = a; i < I.P.length; i++) { const f = I.f[i]; if (f == null) continue; const s = I.e20[i] > I.e50[i]; const q = en ? (f > 25 && s) : (f >= 55 && s);
    if (q && !en) { const m = modo === "reinvertir" ? usdt : Math.min(monto + Math.min(0, ganado - pasado - porPasar), usdt); bnb = m * (1 - fee) / I.P[i]; costo = m; usdt -= m; en = true; }
    else if (!q && en) { const neto = bnb * I.P[i] * (1 - fee), g = neto - costo; usdt += neto; bnb = 0; en = false; ganado += g;
      if (modo === "btc" && g > 0) { porPasar += g; const deuda = Math.max(0, pasado + porPasar - Math.max(0, ganado)), x = porPasar - deuda;
        if (x >= 5.5) { btc += x * (1 - 0.001) / bp.get(I.T[i]); usdt -= x; pasado += x; porPasar -= x; } } } }
  const pb = I.P.at(-1), pbtc = B.P.at(-1); return { total: usdt + bnb * pb + btc * pbtc, btc, bnbVal: usdt + bnb * pb }; }
for (const d of ["2023-01-01", "2025-10-01"]) for (const m of [12, 100]) { const r = corre(d, m, "reinvertir"), g = corre(d, m, "btc");
  console.log(d, m, "reinvertir:", r.total.toFixed(2), "| ganancias a BTC:", g.total.toFixed(2), "(", g.btc.toFixed(6), "BTC =", (g.btc * B.P.at(-1)).toFixed(2), "+ bot", g.bnbVal.toFixed(2), ")"); }`);
