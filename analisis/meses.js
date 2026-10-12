const fs = require("fs"); const src = fs.readFileSync("holly.js", "utf8").split("const pc =")[0].replace('const fs = require("fs"), ', "const ");
eval(src + `
for (const m of ["BTC","ETH","BNB","SOL","XRP","DOGE","ADA"]) { const I = preparar(m), S = senales(I), s = S[N[0]], R = rendDiario(I, s), M = {}, H = {};
  const ini = I.T.findIndex(t => t >= Date.parse("2019-01-01"));
  for (let i = ini; i < I.P.length; i++) { const k = new Date(I.T[i]).toISOString().slice(0, 7); M[k] = (M[k] || 1) * (1 + R[i]); H[k] = (H[k] || 1) * I.P[i] / I.P[i - 1]; }
  const v = Object.values(M), h = Object.values(H);
  console.log(m, "meses", v.length, "| bot: gana", v.filter(x => x > 1.001).length, "pierde", v.filter(x => x < 0.999).length, "quieto", v.filter(x => x >= 0.999 && x <= 1.001).length, "| guardar: gana", h.filter(x => x > 1).length, "pierde", h.filter(x => x < 1).length); }`);
