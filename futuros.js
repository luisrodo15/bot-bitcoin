// Futuros ETH (USDⓈ-M) con el USDT que pongas en tu billetera de Futuros. Solo se activa con "futuros": true en ajustes.json.
// Estrategia (analisis/futeth.js, probada desde 2018): solo largos (apuesta a que sube, nunca en corto).
// - Entra cuando el último cierre diario de ETH queda arriba de su promedio de 45 días.
// - Sale cuando un cierre diario queda abajo del promedio.
// - Apalancamiento 2x en margen aislado: solo arriesga lo que hay en Futuros, nunca tu Spot.
// - Stop: si el precio baja 5% bajo la entrada, cierra. Después no vuelve a entrar hasta que ETH cierre un día abajo
//   del promedio y luego otra vez arriba (señal nueva).
// Seguridad: solo opera ETHUSDT, solo órdenes de mercado, las ventas son "reduceOnly" (solo cierran, nunca abren cortos).
const crypto = require("crypto"), { aPaso } = require("./real.js");
const SIMBOLO = "ETHUSDT", N = 45, L = 2, STOP = 0.05;
let revisadaEn = 0;

async function orden(cli, params) {
  const id = "fut" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
  try { return await cli.llamar("POST", "/fapi/v1/order", { symbol: SIMBOLO, type: "MARKET", ...params, newClientOrderId: id, newOrderRespType: "RESULT" }); }
  catch (e) {
    if (e.status && e.status < 500) throw e; // Binance la rechazó: no se hizo
    await new Promise(ok => setTimeout(ok, 3000));
    let o; try { o = await cli.llamar("GET", "/fapi/v1/order", { symbol: SIMBOLO, origClientOrderId: id }); } catch (e2) { if (e2.code === -2013) throw e; throw new Error("No sé si la orden se hizo: " + e.message); }
    if (o.status !== "FILLED") throw new Error(`La orden quedó en estado ${o.status}`);
    return o;
  }
}

// cli: cliente de fapi.binance.com; spot: cliente de Spot (para revisar los permisos de la llave).
async function revisar(cli, spot, st, ahora, nota) {
  const f = st.fut || (st.fut = { ops: [], puesto: 0, bloq: false });
  f.error = null; f.aviso = null;
  if (!revisadaEn || ahora - revisadaEn > 6 * 3600e3) { // en memoria: al reiniciar el servidor vuelve a sincronizar la hora
    await cli.sincronizar("/fapi/v1/time");
    const r = await spot.restricciones();
    if (r.enableWithdrawals) throw new Error("Tu llave permite RETIROS: no opero futuros con ella.");
    if (!r.enableFutures) throw new Error("Tu llave no tiene activado Futuros.");
    const info = await cli.llamar("GET", "/fapi/v1/exchangeInfo", {}, false), s = (info.symbols || []).find(x => x.symbol === SIMBOLO);
    if (!s || s.status !== "TRADING") throw new Error(`${SIMBOLO} no está disponible en Futuros`);
    const fl = t => s.filters.find(x => x.filterType === t) || {};
    f.reglas = { paso: fl("MARKET_LOT_SIZE").stepSize || fl("LOT_SIZE").stepSize, minQty: +(fl("MARKET_LOT_SIZE").minQty || fl("LOT_SIZE").minQty), minNotional: +(fl("MIN_NOTIONAL").notional || 20) };
    revisadaEn = ahora;
  }
  // Señal con velas diarias cerradas
  const k = (await cli.llamar("GET", "/fapi/v1/klines", { symbol: SIMBOLO, interval: "1d", limit: N + 3 }, false)).filter(x => x[6] < ahora);
  if (k.length < N) throw new Error("No hay suficientes velas diarias de ETH");
  const cierres = k.slice(-N).map(x => +x[4]);
  f.cierre = cierres[N - 1]; f.promedio = cierres.reduce((a, b) => a + b, 0) / N; f.diaCierre = k[k.length - 1][0];
  const arriba = f.cierre > f.promedio;
  if (!arriba) f.bloq = false; // la señal se reinició: ya puede volver a entrar cuando cierre arriba

  const bal = (await cli.llamar("GET", "/fapi/v2/balance")).find(b => b.asset === "USDT") || { balance: 0, availableBalance: 0 };
  const pos = (await cli.llamar("GET", "/fapi/v2/positionRisk", { symbol: SIMBOLO }))[0] || {};
  // Sin posición, Binance manda markPrice 0: el precio se toma de premiumIndex.
  const amt = +pos.positionAmt || 0, saldo = +bal.balance || 0;
  const mark = +pos.markPrice || +(await cli.llamar("GET", "/fapi/v1/premiumIndex", { symbol: SIMBOLO }, false)).markPrice;
  if (!(mark > 0)) throw new Error("No pude leer el precio de ETH");
  let hubo = false;
  // Lo que entra o sale de tu billetera de Futuros sin que el bot opere = lo que pusiste o sacaste.
  if (f.ultSaldo != null && Math.abs(saldo - f.ultSaldo) >= 0.05) { // el funding de una posición chica es de centavos
    const d = saldo - f.ultSaldo; f.puesto = +(f.puesto + d).toFixed(4);
    nota(d > 0 ? `Llegaron ${d.toFixed(2)} USDT a tu billetera de Futuros: los uso para ETH.` : `Sacaste ${(-d).toFixed(2)} USDT de Futuros.`);
  } else if (f.ultSaldo == null && saldo > 0) f.puesto = saldo;
  if (!f.ops.length && amt === 0) f.puesto = saldo; // sin operar todavía, todo lo que hay es lo que pusiste
  f.precio = mark; f.saldo = saldo; f.disp = +bal.availableBalance || 0;

  const cerrar = async (motivo, stop) => {
    const o = await orden(cli, { side: "SELL", quantity: String(amt), reduceOnly: "true" });
    const pr = +o.avgPrice, q = +o.executedQty, ent = +pos.entryPrice, gan = (pr - ent) * q - (pr + ent) * q * 0.0005;
    f.ops.push({ t: ahora, tipo: "CIERRE", precio: pr, eth: q, ganancia: +gan.toFixed(4), motivo }); hubo = true;
    if (stop) f.bloq = true;
    nota(`Futuros: cerré ${q} ETH a ${pr.toFixed(2)} (${motivo}). ${gan >= 0 ? "Ganancia" : "Pérdida"} aprox. ${Math.abs(gan).toFixed(2)} USDT.`);
  };
  if (amt > 0) {
    const ent = +pos.entryPrice;
    f.pos = { eth: amt, entrada: ent, pnl: +pos.unRealizedProfit || 0, liq: +pos.liquidationPrice || 0, stop: ent * (1 - STOP) };
    if (mark <= ent * (1 - STOP)) await cerrar(`stop: bajó ${STOP * 100}% desde la entrada`, true);
    else if (!arriba) await cerrar("ETH cerró el día abajo de su promedio de 45 días");
  } else if (amt < 0) {
    f.pos = null; f.aviso = `Hay una posición en corto de ETH que no abrió el bot (${amt}). No la toco: ciérrala tú si quieres.`;
  } else {
    f.pos = null;
    if (arriba && !f.bloq) {
      // No mete todo el USDT (lo pidió el usuario): abre la posición más chica que Binance acepta (mínimo 20 USDT de ETH, ~10 USDT de margen a 2x).
      const min = Math.max(f.reglas.minNotional, f.reglas.minQty * mark), paso = +f.reglas.paso;
      const qty = aPaso(Math.min(Math.ceil(min * 1.03 / mark / paso) * paso, f.disp * L * 0.97 / mark), f.reglas.paso);
      if (+qty * mark < min || +qty < f.reglas.minQty) {
        if (f.disp > 0.5 || saldo > 0.5) f.aviso = `Para abrir ETH se necesitan unos ${(min / L / 0.97 + 0.2).toFixed(2)} USDT en Futuros y tienes ${f.disp.toFixed(2)}.`;
      } else {
        try { await cli.llamar("POST", "/fapi/v1/marginType", { symbol: SIMBOLO, marginType: "ISOLATED" }); } catch (e) { if (e.code !== -4046) throw e; }
        await cli.llamar("POST", "/fapi/v1/leverage", { symbol: SIMBOLO, leverage: L });
        const o = await orden(cli, { side: "BUY", quantity: qty });
        const pr = +o.avgPrice, q = +o.executedQty;
        f.ops.push({ t: ahora, tipo: "ENTRADA", precio: pr, eth: q, motivo: `ETH cerró arriba de su promedio (${f.cierre.toFixed(2)} > ${f.promedio.toFixed(2)})` }); hubo = true;
        nota(`Futuros: abrí ${q} ETH a ${pr.toFixed(2)} con 2x. Stop si baja a ${(pr * (1 - STOP)).toFixed(2)}.`);
      }
    }
  }
  // Aviso previo: qué orden va a poner al cierre del día (6 pm de México = 00:00 UTC) si el precio sigue así.
  const cierreEn = 864e5 - ahora % 864e5, hrs = Math.floor(cierreEn / 36e5), min = Math.floor(cierreEn % 36e5 / 6e4), falta = `${hrs ? hrs + " h " : ""}${min} min`;
  f.previo = null;
  if (f.pos && mark <= f.pos.stop * 1.01) f.previo = `¡Cuidado! ETH (${mark.toFixed(2)}) está a menos de 1% del stop (${f.pos.stop.toFixed(2)}): si lo toca, el bot cierra la posición.`;
  else if (f.pos && mark < f.promedio) f.previo = `El bot va a CERRAR la posición al cierre del día (en ${falta}) si ETH sigue abajo de ${f.promedio.toFixed(2)}. Ahora está en ${mark.toFixed(2)}.`;
  else if (!f.pos && !f.bloq && mark > f.promedio) f.previo = `El bot va a COMPRAR ETH al cierre del día (en ${falta}) si ETH sigue arriba de ${f.promedio.toFixed(2)}. Ahora está en ${mark.toFixed(2)}.`;
  const hoy = Math.floor(ahora / 864e5);
  if (f.previo && cierreEn < 3 * 36e5 && f.previoDia !== hoy && !/Cuidado/.test(f.previo)) { f.previoDia = hoy; nota("Atención: " + f.previo); }
  if (f.ops.length > 200) f.ops = f.ops.slice(-200);
  // Después de operar, el saldo cambia por la ganancia o pérdida: eso no es depósito.
  f.ultSaldo = hubo ? +((await cli.llamar("GET", "/fapi/v2/balance")).find(b => b.asset === "USDT") || { balance: saldo }).balance : saldo;
  f.revisado = ahora;
}

module.exports = { revisar, SIMBOLO, N, L, STOP };
