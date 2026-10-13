// Modo DINERO REAL: compra y vende de verdad en Binance Spot con la llave guardada en llave.json.
// Reglas de seguridad:
// - Solo funciona si la llave NO permite retiros (lo revisa al arrancar y cada 6 horas).
// - Solo opera el par MONEDA/USDT, solo con órdenes de mercado del monto configurado.
// - Solo vende lo que el propio bot compró (cada lote por separado), nunca otras monedas tuyas.
// - Antes de comprar revisa que haya USDT libre suficiente en Spot.
const fs = require("fs"), path = require("path"), crypto = require("crypto");

const F_LLAVE = path.join(__dirname, "llave.json");
function leerLlave() {
  try { const k = JSON.parse(fs.readFileSync(F_LLAVE, "utf8")); return k.apiKey && k.secret ? k : null; } catch { return null; }
}

function crearCliente(API, llave) {
  let desfase = 0;
  async function llamar(metodo, ruta, params = {}, firmada = true) {
    const q = new URLSearchParams(params);
    if (firmada) {
      q.set("recvWindow", "10000"); q.set("timestamp", String(Date.now() + desfase));
      q.set("signature", crypto.createHmac("sha256", llave.secret).update(q.toString()).digest("hex"));
    }
    const r = await fetch(`${API}${ruta}?${q}`, { method: metodo, headers: firmada ? { "X-MBX-APIKEY": llave.apiKey } : {}, signal: AbortSignal.timeout(15000) });
    const txt = await r.text(); let d; try { d = JSON.parse(txt); } catch { d = { msg: txt.slice(0, 200) }; }
    if (!r.ok) { const e = new Error(`Binance: ${d.msg || r.status}`); e.status = r.status; e.code = d.code; throw e; }
    return d;
  }
  return {
    llamar,
    async sincronizar() { const d = await llamar("GET", "/api/v3/time", {}, false); desfase = d.serverTime - Date.now(); },
    restricciones: () => llamar("GET", "/sapi/v1/account/apiRestrictions"),
    cuenta: () => llamar("GET", "/api/v3/account", { omitZeroBalances: "true" }),
    precio: async s => +(await llamar("GET", "/api/v3/ticker/price", { symbol: s }, false)).price,
    async reglas(s) {
      const d = await llamar("GET", "/api/v3/exchangeInfo", { symbol: s }, false), sym = d.symbols && d.symbols[0];
      if (!sym || sym.status !== "TRADING") throw new Error(`${s} no está disponible para operar`);
      const f = t => sym.filters.find(x => x.filterType === t) || {};
      return { base: sym.baseAsset, paso: f("LOT_SIZE").stepSize, minQty: +f("LOT_SIZE").minQty || 0, minNotional: +(f("NOTIONAL").minNotional || f("MIN_NOTIONAL").minNotional || 5) };
    },
    // Convertir (como "Convertir"/"Comprar Cripto" de la app): acepta montos muy chicos (desde ~1 peso). Pide cotización,
    // la acepta y espera a que Binance diga que terminó. Devuelve cuánto se recibió.
    async convertir(de, a, monto) {
      const q = await llamar("POST", "/sapi/v1/convert/getQuote", { fromAsset: de, toAsset: a, fromAmount: String(monto), walletType: "SPOT" });
      if (!q.quoteId) throw new Error(q.msg || "Binance no dio cotización para convertir");
      const r = await llamar("POST", "/sapi/v1/convert/acceptQuote", { quoteId: q.quoteId });
      for (let i = 0; i < 10; i++) {
        const s = await llamar("GET", "/sapi/v1/convert/orderStatus", { orderId: r.orderId });
        if (s.orderStatus === "SUCCESS") return { recibido: +s.toAmount, pagado: +s.fromAmount };
        if (s.orderStatus === "FAIL") throw new Error("Binance no completó la conversión");
        await new Promise(ok => setTimeout(ok, 1500));
      }
      throw new Error("No sé si la conversión se hizo (sigue en proceso)");
    },
    // Orden de mercado. Si la red falla a la mitad, pregunta a Binance si la orden sí se hizo.
    async orden(params) {
      const id = "bot" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
      try { return await llamar("POST", "/api/v3/order", { ...params, type: "MARKET", newClientOrderId: id, newOrderRespType: "FULL" }); }
      catch (e) {
        if (e.status && e.status < 500) throw e;           // Binance la rechazó: no se hizo.
        await new Promise(ok => setTimeout(ok, 3000));
        let o; try { o = await llamar("GET", "/api/v3/order", { symbol: params.symbol, origClientOrderId: id }); } catch (e2) { if (e2.code === -2013) throw e; throw new Error("No sé si la orden se hizo: " + e.message); }
        if (o.status !== "FILLED") throw new Error(`La orden quedó en estado ${o.status}`);
        return o;
      }
    }
  };
}

// Redondea hacia abajo al paso que pide Binance (por ejemplo 0.0001 ETH).
function aPaso(q, paso) {
  const dec = (paso.split(".")[1] || "").replace(/0+$/, "").length, p = +paso;
  return (Math.floor(q / p + 1e-9) * p).toFixed(dec);
}

// Revisa la llave: debe poder operar Spot y NO debe poder retirar.
async function revisarLlave(cli) {
  const r = await cli.restricciones();
  if (r.enableWithdrawals) return "Tu llave de Binance permite RETIROS. Por seguridad no opero con ella: crea una llave sin retiros.";
  if (!r.enableSpotAndMarginTrading) return "Tu llave de Binance no tiene activado el trading Spot.";
  return null;
}

module.exports = { leerLlave, crearCliente, aPaso, revisarLlave, F_LLAVE };
