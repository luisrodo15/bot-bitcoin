// Simulador rápido de la estrategia de lotes (igual a Bot.revisar) con opciones extra.
// precios: Float64Array de cierres por minuto; ts: Float64Array de tiempos.
// opts: monto, lotes, bajada, subida, tope (Infinity = sin tope), comision (%), capital,
//       tendencia: minutos de media móvil (0 = sin filtro): solo compra si precio > media.
function simular(o, ts, P, desde = 0, hasta = P.length, ma = null) {
  const com = o.comision / 100, cap = o.capital;
  let usdt = cap, ref = null, ganado = 0, ventas = 0, gan = 0, perd = 0;
  const lotes = []; // [precio, cant, costo]
  let maxEq = cap, maxDD = 0, pausado = false;
  const diaria = new Map();
  for (let i = desde; i < hasta; i++) {
    const p = P[i];
    if (pausado) continue;
    // ventas
    let vendio = false;
    for (let j = lotes.length - 1; j >= 0; j--) {
      const L = lotes[j];
      if (p < L[0] * (1 + o.subida / 100) && p > L[0] * (1 - o.tope / 100)) continue;
      const neto = L[1] * p * (1 - com), g = neto - L[2];
      usdt += neto; ganado += g; ventas++; if (g > 0) gan++; else perd++;
      const d = Math.floor(ts[i] / 864e5); diaria.set(d, (diaria.get(d) || 0) + g);
      lotes.splice(j, 1); vendio = true;
      if (o.perdidaMax && ganado <= -o.perdidaMax) pausado = true;
    }
    if (!lotes.length && vendio) ref = p;
    // compra
    let nivel;
    if (!lotes.length) { ref = ref == null ? p : Math.max(ref, p); nivel = ref * (1 - o.bajada / 100); }
    else { let mn = Infinity; for (const L of lotes) if (L[0] < mn) mn = L[0]; nivel = mn * (1 - o.bajada / 100); }
    if (p <= nivel && lotes.length < o.lotes && (!ma || p > ma[i])) {
      const m = Math.min(o.monto, usdt);
      if (m >= Math.min(o.monto, 5)) { usdt -= m; lotes.push([p, m * (1 - com) / p, m]); }
    }
    // ref tras vender todo: Bot pone ref = precio cuando se vació en este tick
    if (i % 60 === 0) { let eq = usdt; for (const L of lotes) eq += L[1] * p; if (eq > maxEq) maxEq = eq; if (maxEq - eq > maxDD) maxDD = maxEq - eq; }
  }
  const pf = P[hasta - 1]; let eq = usdt; for (const L of lotes) eq += L[1] * pf;
  return { final: eq - cap, ganado, ventas, gan, perd, abiertos: lotes.length, maxDD, diaria, pausado };
}
function mediaMovil(P, n) { const m = new Float64Array(P.length); let s = 0; for (let i = 0; i < P.length; i++) { s += P[i]; if (i >= n) s -= P[i - n]; m[i] = i >= n - 1 ? s / Math.min(n, i + 1) : 0; } return m; }
module.exports = { simular, mediaMovil };
