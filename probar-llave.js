// Revisa la llave que pegaste en poner-llave.sh y solo la guarda si es segura:
// debe poder operar Spot y NO debe poder retirar.
const fs = require("fs"), Real = require("./real.js");
const API = process.env.API_BINANCE || "https://api.binance.com";
const llave = { apiKey: (process.env.LLAVE_K || "").trim(), secret: (process.env.LLAVE_S || "").trim() };
(async () => {
  if (!llave.apiKey || !llave.secret) throw new Error("No pegaste la API Key o la Secret Key.");
  const cli = Real.crearCliente(API, llave);
  await cli.sincronizar();
  const r = await cli.restricciones();
  if (r.enableWithdrawals) throw new Error("Esta llave permite RETIROS. Bórrala en Binance y crea otra SIN retiros.");
  if (!r.enableSpotAndMarginTrading) throw new Error("Esta llave no tiene activado \"Habilitar trading Spot y Margen\".");
  const cta = await cli.cuenta(), bal = a => +((cta.balances || []).find(b => b.asset === a) || { free: 0 }).free;
  fs.writeFileSync(Real.F_LLAVE, JSON.stringify(llave), { mode: 0o600 }); fs.chmodSync(Real.F_LLAVE, 0o600);
  console.log("\n============================================================");
  console.log(" Llave guardada. Puede operar Spot y NO puede retirar.");
  if (!r.ipRestrict) console.log(" Consejo: en Binance restringe la llave a la IP de este servidor.");
  console.log(` USDT libre en Spot: ${bal("USDT").toFixed(2)}`);
  if (bal("BTC") > 0) console.log(` Ojo: tienes ${bal("BTC")} BTC en Spot. El bot no los vende, pero mejor pásalos a Fondos.`);
  console.log(" Ya puedes cerrar esta ventana.");
  console.log("============================================================");
})().catch(e => { console.error("\nNO se guardó la llave: " + e.message); process.exit(1); });
