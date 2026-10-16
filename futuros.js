// Futuros ETH (USDⓈ-M) con el USDT que pongas en tu billetera de Futuros. Solo se activa con "futuros": true en ajustes.json.
// Estrategia (analisis/futeth.js y analisis/profundo.js, probada desde 2018):
// - Largo (gana si sube): cuando el último cierre diario de ETH queda arriba de su promedio de 45 días; sale cuando cierra abajo.
// - Corto (gana si baja): solo en bajada fuerte: cierre abajo del promedio de 20 días, ese promedio bajando (vs 5 días antes)
//   y cierre abajo del promedio de 200 días. Sale cuando deja de cumplirse. En lo demás espera en USDT.
// - Apalancamiento 2x en margen aislado: solo arriesga lo que hay en Futuros, nunca tu Spot.
// - Stop: si el precio va 5% en contra desde la entrada, cierra. Después no vuelve a entrar de ese lado hasta que la señal cambie.
// Seguridad: solo opera ETHUSDT, solo órdenes de mercado, los cierres son "reduceOnly", posición mínima de Binance.
const crypto = require("crypto"), { aPaso } = require("./real.js");
const SIMBOLO = "ETHUSDT", N = 45, NC = 20, L = 2, STOP = 0.05, PERDIDA_MAX = 1; // USDT máximo a perder por entrada (lo pidió el usuario)
// Stop: 5% en contra, o menos si hace falta para que la pérdida (con comisiones) no pase de PERDIDA_MAX.
const stopPct = (q, p) => Math.min(STOP, (PERDIDA_MAX * 0.95 - q * p * 0.001) / (q * p));
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
  const f = st.fut || (st.fut = { ops: [], puesto: 0, bloq: 0 });
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
  // Señales con velas diarias cerradas
  const k = (await cli.llamar("GET", "/fapi/v1/klines", { symbol: SIMBOLO, interval: "1d", limit: 215 }, false)).filter(x => x[6] < ahora);
  if (k.length < 206) throw new Error("No hay suficientes velas diarias de ETH");
  const cl = k.map(x => +x[4]), prom = (n, atras = 0) => cl.slice(cl.length - n - atras, cl.length - atras).reduce((a, b) => a + b, 0) / n;
  f.cierre = cl[cl.length - 1]; f.promedio = prom(N); f.prom20 = prom(NC); f.prom20antes = prom(NC, 5); f.prom200 = prom(200); f.diaCierre = k[k.length - 1][0];
  // Largo: cierre arriba del promedio de 45 días. Corto: solo en bajada fuerte (cierre abajo del de 20 días, el de 20 bajando
  // y cierre abajo del de 200 días). Si no, espera en USDT.
  const arriba = f.cierre > f.promedio, corto = !arriba && f.cierre < f.prom20 && f.prom20 < f.prom20antes && f.cierre < f.prom200;
  const senal = arriba ? 1 : corto ? -1 : 0;
  if (f.bloq === true) f.bloq = 1; // versión anterior
  if (f.bloq && senal !== f.bloq) f.bloq = 0; // la señal cambió: ya puede volver a entrar en ese lado

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

  const lado = amt > 0 ? 1 : amt < 0 ? -1 : 0, nombre = x => x > 0 ? "largo (a la subida)" : "corto (a la baja)";
  const cerrar = async (motivo, stop) => {
    const o = await orden(cli, { side: lado > 0 ? "SELL" : "BUY", quantity: String(Math.abs(amt)), reduceOnly: "true" });
    const pr = +o.avgPrice, q = +o.executedQty, ent = +pos.entryPrice, gan = lado * (pr - ent) * q - (pr + ent) * q * 0.0005;
    f.ops.push({ t: ahora, tipo: "CIERRE", lado, precio: pr, eth: q, ganancia: +gan.toFixed(4), motivo }); hubo = true;
    if (stop) f.bloq = lado;
    nota(`Futuros: cerré ${q} ETH en ${nombre(lado)} a ${pr.toFixed(2)} (${motivo}). ${gan >= 0 ? "Ganancia" : "Pérdida"} aprox. ${Math.abs(gan).toFixed(2)} USDT.`);
  };
  if (lado) {
    const ent = +pos.entryPrice, sp = stopPct(Math.abs(amt), ent), stopP = ent * (1 - lado * sp);
    f.pos = { lado, stopPct: sp, eth: Math.abs(amt), entrada: ent, pnl: +pos.unRealizedProfit || 0, liq: +pos.liquidationPrice || 0, stop: stopP };
    if (lado > 0 ? mark <= stopP : mark >= stopP) await cerrar(`stop: ${lado > 0 ? "bajó" : "subió"} ${(sp * 100).toFixed(1)}% desde la entrada`, true);
    else if (senal !== lado) await cerrar(lado > 0 ? "ETH cerró el día abajo de su promedio de 45 días" : "terminó la bajada fuerte de ETH");
    if (hubo) f.pos = null;
  } else {
    f.pos = null;
    if (senal && f.bloq !== senal) {
      // No mete todo el USDT (lo pidió el usuario): abre la posición más chica que Binance acepta (mínimo 20 USDT de ETH, ~10 USDT de margen a 2x).
      const min = Math.max(f.reglas.minNotional, f.reglas.minQty * mark), paso = +f.reglas.paso;
      const qty = aPaso(Math.min(Math.ceil(min * 1.03 / mark / paso) * paso, f.disp * L * 0.97 / mark), f.reglas.paso);
      if (+qty * mark < min || +qty < f.reglas.minQty) {
        if (f.disp > 0.5 || saldo > 0.5) f.aviso = `Para abrir ETH se necesitan unos ${(min / L / 0.97 + 0.2).toFixed(2)} USDT en Futuros y tienes ${f.disp.toFixed(2)}.`;
      } else {
        try { await cli.llamar("POST", "/fapi/v1/marginType", { symbol: SIMBOLO, marginType: "ISOLATED" }); } catch (e) { if (e.code !== -4046) throw e; }
        await cli.llamar("POST", "/fapi/v1/leverage", { symbol: SIMBOLO, leverage: L });
        const o = await orden(cli, { side: senal > 0 ? "BUY" : "SELL", quantity: qty });
        const pr = +o.avgPrice, q = +o.executedQty;
        f.ops.push({ t: ahora, tipo: "ENTRADA", lado: senal, precio: pr, eth: q, motivo: senal > 0 ? `ETH cerró arriba de su promedio de 45 días (${f.cierre.toFixed(2)} > ${f.promedio.toFixed(2)})` : `bajada fuerte: ETH abajo de sus promedios de 20 y 200 días (${f.cierre.toFixed(2)})` }); hubo = true;
        nota(`Futuros: abrí ${q} ETH en ${nombre(senal)} a ${pr.toFixed(2)} con 2x. Stop si ${senal > 0 ? "baja" : "sube"} a ${(pr * (1 - senal * stopPct(q, pr))).toFixed(2)} (pérdida máx. ~${PERDIDA_MAX} USDT).`);
      }
    }
  }
  // Aviso previo: qué orden va a poner al cierre del día (6 pm de México = 00:00 UTC) si el precio sigue así.
  const cierreEn = 864e5 - ahora % 864e5, hrs = Math.floor(cierreEn / 36e5), mins = Math.floor(cierreEn % 36e5 / 6e4), falta = `${hrs ? hrs + " h " : ""}${mins} min`;
  const arribaYa = mark > f.promedio, cortoYa = !arribaYa && mark < f.prom20 && f.prom20 < f.prom20antes && mark < f.prom200, senalYa = arribaYa ? 1 : cortoYa ? -1 : 0;
  f.previo = null; f.senal = senal;
  if (f.pos && Math.abs(mark / f.pos.stop - 1) < 0.01) f.previo = `¡Cuidado! ETH (${mark.toFixed(2)}) está a menos de 1% del stop (${f.pos.stop.toFixed(2)}): si lo toca, el bot cierra la posición.`;
  else if (f.pos && senalYa !== f.pos.lado) f.previo = `El bot va a CERRAR el ${nombre(f.pos.lado)} al cierre del día (en ${falta}) si ETH sigue en ${mark.toFixed(2)}.`;
  else if (!f.pos && senalYa && f.bloq !== senalYa) f.previo = senalYa > 0 ? `El bot va a COMPRAR ETH (largo) al cierre del día (en ${falta}) si ETH sigue arriba de ${f.promedio.toFixed(2)}. Ahora está en ${mark.toFixed(2)}.`
    : `El bot va a abrir un CORTO (gana si ETH baja) al cierre del día (en ${falta}) si ETH sigue abajo de ${Math.min(f.prom20, f.prom200).toFixed(2)}. Ahora está en ${mark.toFixed(2)}.`;
  const hoy = Math.floor(ahora / 864e5);
  if (f.previo && cierreEn < 3 * 36e5 && f.previoDia !== hoy && !/Cuidado/.test(f.previo)) { f.previoDia = hoy; nota("Atención: " + f.previo); }
  if (f.ops.length > 200) f.ops = f.ops.slice(-200);
  // Después de operar, el saldo cambia por la ganancia o pérdida: eso no es depósito.
  f.ultSaldo = hubo ? +((await cli.llamar("GET", "/fapi/v2/balance")).find(b => b.asset === "USDT") || { balance: saldo }).balance : saldo;
  // Rendimiento diario: valor de la cuenta (saldo + ganancia abierta) al empezar cada día y lo que pusiste ese día.
  const valor = f.ultSaldo + (f.pos ? f.pos.pnl : 0), dia = Math.floor(ahora / 864e5) * 864e5, d = f.dias || (f.dias = []);
  if (!d.length || d[d.length - 1].t !== dia) { d.push({ t: dia, ini: +valor.toFixed(4), puesto: f.puesto }); if (d.length > 400) d.splice(0, d.length - 400); }
  d[d.length - 1].fin = +valor.toFixed(4); d[d.length - 1].puestoFin = f.puesto;
  f.revisado = ahora;
}

module.exports = { revisar, SIMBOLO, N, NC, L, STOP };
