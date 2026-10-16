// Prueba de funding (SIMULADA, sin dinero real). Solo se activa con "fundingPrueba": true en ajustes.json.
// Idea: comprar ETH en Spot y abrir un corto igual en Futuros. Si ETH sube o baja, una parte gana lo que la otra pierde;
// lo que queda es el funding que Binance paga cada 8 h (00, 08 y 16 UTC = 6 pm, 2 am y 10 am México) al corto cuando la tasa es positiva.
// Aquí no se hace ninguna orden: solo lee las tasas reales de Binance (públicas) y lleva la cuenta como si tuviera ~44 USDT.
// También lleva una segunda cuenta "rotando": la misma idea pero cambiándose a la moneda que esté pagando más funding.
const Real = require("./real.js");
const SIMBOLO = "ETHUSDT", ETH = 0.009, CAPITAL = 44, COM = 0.00075 + 0.0005; // comisión Spot (con BNB) + Futuros por lado
const MONEDAS = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "XRPUSDT", "SOLUSDT", "DOGEUSDT", "ADAUSDT"];
const CAMBIO = 0.0002; // solo se cambia de moneda si la otra paga 0.02% más por cobro (cambiar cuesta ~0.25%)
const cli = Real.crearCliente(process.env.API_FUTUROS || "https://fapi.binance.com", null);

async function cobros(sym, desde) {
  const d = await cli.llamar("GET", "/fapi/v1/fundingRate", { symbol: sym, startTime: desde + 1, limit: 100 }, false);
  return d.filter(x => x.fundingTime > desde).map(x => ({ t: x.fundingTime, tasa: +x.fundingRate, precio: +x.markPrice }));
}

async function revisar(st, ahora) {
  const f = st.fund;
  if (f && ahora - (f.revisado || 0) < 5 * 60e3) return; // cada 5 minutos basta
  const todos = await cli.llamar("GET", "/fapi/v1/premiumIndex", {}, false);
  const tasas = {}; for (const x of todos) if (MONEDAS.includes(x.symbol)) tasas[x.symbol] = { tasa: +x.lastFundingRate, precio: +x.markPrice, prox: +x.nextFundingTime };
  const e = tasas[SIMBOLO]; if (!e || !(e.precio > 0)) throw new Error("sin precio de ETH");
  const mejor = Object.entries(tasas).sort((a, b) => b[1].tasa - a[1].tasa)[0][0];
  if (!f) { // arranca la prueba: "compra" 0.009 ETH en Spot y "abre" el corto igual (paga comisión de entrada)
    const nocional = ETH * e.precio;
    st.fund = { inicio: ahora, revisado: ahora, entrada: e.precio, eth: ETH, nocional, comision: nocional * COM, cobros: [], hasta: ahora,
      rot: { sym: mejor, nocional, comision: nocional * COM, cobros: [], cambios: 0, hasta: ahora } };
    return revisar.ult = { tasas, mejor };
  }
  for (const c of await cobros(SIMBOLO, f.hasta)) { f.cobros.push({ ...c, usdt: f.eth * c.precio * c.tasa }); f.hasta = c.t; }
  const r = f.rot;
  for (const c of await cobros(r.sym, r.hasta)) { r.cobros.push({ ...c, sym: r.sym, usdt: r.nocional * c.tasa }); r.hasta = c.t; }
  // Rotación: si otra moneda paga claramente más, se cambia (sale de la actual y entra en la nueva: 4 comisiones).
  if (mejor !== r.sym && tasas[mejor].tasa - (tasas[r.sym] ? tasas[r.sym].tasa : 0) > CAMBIO) { r.comision += r.nocional * COM * 2; r.sym = mejor; r.cambios++; r.hasta = ahora; }
  f.cobros = f.cobros.slice(-400); r.cobros = r.cobros.slice(-400);
  f.tasas = tasas; f.mejor = mejor; f.precio = e.precio; f.prox = e.prox; f.revisado = ahora; f.error = null;
}

const resumen = (f, rot) => { const x = rot ? f.rot : f, g = x.cobros.reduce((a, c) => a + c.usdt, 0), dias = Math.max((Date.now() - f.inicio) / 864e5, 1 / 3);
  return { cobrado: g, comision: x.comision, neto: g - x.comision, valor: CAPITAL + g - x.comision, alDia: g / dias, anual: g / dias * 365 / CAPITAL * 100 }; };

module.exports = { revisar, resumen, CAPITAL, SIMBOLO };
