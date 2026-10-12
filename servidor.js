// Bot Cripto para servidor: revisa el precio (BTC, ETH, SOL o BNB contra USDT) cada minuto, 24/7.
// Dos modos:
// - SIMULACIÓN (normal): dinero ficticio, solo lee el precio público de Binance.
// - DINERO REAL: solo si ajustes.json dice "real": true Y en el servidor hay una llave (llave.json, se pone
//   con poner-llave.sh). La llave debe tener trading Spot y NO retiros. Ver real.js.
const fs = require("fs"), path = require("path"), http = require("http"), crypto = require("crypto");
require("./bot.js"); const Bot = globalThis.Bot;
const Real = require("./real.js");
require("./sentimiento.js"); const Sen = globalThis.Sentimiento;

const DIR = __dirname;
const F_CFG = path.join(DIR, "config.json"), F_AJ = path.join(DIR, "ajustes.json");
const API = process.env.API_BINANCE || "https://api.binance.com";
const urlPrecio = () => `${API}/api/v3/ticker/price?symbol=${cfg.moneda}USDT`;
const F_CAMBIOS = path.join(DIR, "cambios.log");

function leerJSON(f, def) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return def; } }
function guardarJSON(f, v) { fs.writeFileSync(f + ".tmp", JSON.stringify(v, null, 2)); fs.renameSync(f + ".tmp", f); }

// Reglas: config.json (se crea la primera vez con las reglas iniciales y una clave para ver el panel).
let cfg = leerJSON(F_CFG, null);
if (!cfg) { cfg = { ...Bot.CONFIG_INICIAL, autoajuste: true, ajusteHoras: 6, puerto: 8080, clavePanel: crypto.randomBytes(18).toString("base64url") }; guardarJSON(F_CFG, cfg); }
cfg = { ...Bot.CONFIG_INICIAL, autoajuste: true, ...cfg };
// ajustes.json viene de GitHub: así se cambia la moneda, el monto o el modo sin entrar al servidor.
const AJ = leerJSON(F_AJ, {});
for (const k of ["moneda", "real", "monto", "perdidaMax", "comision", "saldoInicial", "autoajuste", "ajusteHoras", "estrategia", "codicia", "miedo", "todoBTC", "reinvertir", "gananciasA", "movimiento", "movimientoBaja"]) if (AJ[k] !== undefined) cfg[k] = AJ[k];
// Estas opciones solo valen mientras estén en ajustes.json; si se quitan de ahí, se apagan (no se quedan guardadas en config.json).
for (const k of ["gananciasA", "todoBTC", "reinvertir", "movimiento", "movimientoBaja"]) if (AJ[k] === undefined) delete cfg[k];
if (!Bot.MONEDAS.includes(cfg.moneda)) cfg.moneda = Bot.CONFIG_INICIAL.moneda;
guardarJSON(F_CFG, cfg);

const llave = cfg.real ? Real.leerLlave() : null;
const REAL = !!llave;
const cli = REAL ? Real.crearCliente(API, llave) : null;
const F_EST = path.join(DIR, REAL ? "estado-real.json" : "estado.json"), F_CSV = path.join(DIR, REAL ? "registro-real.csv" : "registro.csv");
let st = leerJSON(F_EST, null) || Bot.estadoInicial(cfg);
if (REAL && !st.real) { st = Bot.estadoInicial(cfg); st.real = true; st.usdt = 0; st.base = 0; }
// Simulación: si cambió la moneda, empieza una simulación nueva. Real: cambia de moneda cuando no haya compras abiertas.
if (!REAL && ((st.moneda || "BTC") !== cfg.moneda || (st.estrategia || "lotes") !== (cfg.estrategia || "lotes"))) st = Bot.estadoInicial(cfg);
st.estrategia = cfg.estrategia || "lotes";
const SENT = st.estrategia === "sentimiento";
// todoBTC: el bot maneja TODOS los BTC (o la moneda elegida) que haya libres en Spot, no solo los que él compró.
// Los vende a USDT cuando la señal es de salida y recompra con ese mismo dinero cuando vuelve la señal.
const TODO = REAL && SENT && !!cfg.todoBTC;
st.compras = st.compras || []; st.ajustes = st.ajustes || [];
// Para quitar una pausa desde GitHub: subir el número "reanudar" en ajustes.json.
if (AJ.reanudar !== undefined && AJ.reanudar !== st.reanudado) { st.reanudado = AJ.reanudar; st.pausado = null; }

function anotar(h) {
  if (!fs.existsSync(F_CSV)) fs.writeFileSync(F_CSV, "﻿fecha,tipo,precio_usdt,cantidad,usdt,comision_usdt,ganancia_usdt,motivo\n");
  fs.appendFileSync(F_CSV, [new Date(h.t).toISOString(), h.tipo, h.precio, h.btc.toFixed(8), h.usdt, h.comision, h.ganancia ?? "", `"${h.motivo}"`].join(",") + "\n");
}

// ---------- Señales para la estrategia "sentimiento" (se revisan cada minuto) ----------
const API_INDICE = process.env.API_INDICE || "https://api.alternative.me/fng/?limit=200";
let sen = null, graf = null;
// Datos para la gráfica del panel: precio diario, EMAs y dónde habría comprado/vendido la estrategia en esos días.
function armarGrafica(kv, fg) {
  const k = kv.map(v => +v[4]), serie = n => { const a = 2 / (n + 1), o = []; k.forEach((p, i) => o.push(i ? p * a + o[i - 1] * (1 - a) : p)); return o; };
  const e20 = serie(20), e50 = serie(50), cod = cfg.codicia ?? Sen.DEF.codicia, mie = cfg.miedo ?? Sen.DEF.miedo, desde = Math.max(0, kv.length - 120), marcas = [];
  let en = false;
  for (let i = 50; i < kv.length; i++) {
    const f = fg.get(Math.floor(kv[i][0] / 864e5)); if (f == null) continue;
    const sube = e20[i] > e50[i], q = en ? (f > mie && sube) : (f >= cod && sube);
    if (q !== en) { en = q; if (i >= desde) marcas.push({ t: kv[i][6], p: k[i], tipo: q ? "COMPRA" : "VENTA" }); }
  }
  return { dias: kv.slice(desde).map((v, j) => ({ t: v[6], c: k[desde + j], e20: e20[desde + j], e50: e50[desde + j] })), marcas };
}
async function leerSenales(moneda) {
  if (sen && sen.moneda === moneda && Date.now() - sen.t < 55000) return sen;
  const r1 = await fetch(API_INDICE, { signal: AbortSignal.timeout(15000) });
  if (!r1.ok) throw new Error("el índice de miedo y codicia respondió " + r1.status);
  const lista = (await r1.json()).data, d = lista[0], fg = new Map(lista.map(x => [Math.floor(+x.timestamp / 86400), +x.value]));
  const r2 = await fetch(`${API}/api/v3/klines?symbol=${moneda}USDT&interval=1d&limit=300`, { signal: AbortSignal.timeout(15000) });
  if (!r2.ok) throw new Error("Binance respondió " + r2.status);
  const kv = (await r2.json()).filter(v => v[6] < Date.now()), k = kv.map(v => +v[4]); // solo velas diarias ya cerradas
  if (k.length < 60) throw new Error("llegaron pocas velas diarias");
  sen = { moneda, t: Date.now(), indice: +d.value, nombre: Sen.nombre(+d.value), e20: Sen.ema(k, 20), e50: Sen.ema(k, 50) };
  try { graf = armarGrafica(kv, fg); } catch (e) { graf = null; }
  st.senales = sen; return sen;
}
// Alerta por noticias: {"motivo": "...", "hasta": "2026-10-13T15:00:00Z"} en ajustes.json. Mientras dure, vende y no compra.
const alerta = () => { const a = AJ.alerta; return a && a.motivo && Date.now() < Date.parse(a.hasta) ? a : null; };
const decidir = async (est, c, precio, ahora, moneda) => SENT ? Sen.revisar(est, c, precio, ahora, { ...await leerSenales(moneda), alerta: alerta() && alerta().motivo }) : Bot.revisar(est, c, precio, ahora);

let revisando = false;
async function revisar() {
  if (revisando) return; revisando = true;
  try {
    if (REAL) await revisarReal(); else {
      const r = await fetch(urlPrecio(), { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error("Binance respondió " + r.status);
      const precio = +(await r.json()).price;
      if (!(precio > 0)) throw new Error("precio inválido");
      st.error = null;
      const hechas = await decidir(st, cfg, precio, Date.now(), cfg.moneda);
      for (const h of hechas) { anotar(h); console.log(new Date().toISOString(), h.tipo, h.precio, h.motivo, h.ganancia ?? ""); }
      await pasarGanancias(hechas);
    }
    if (st.trades.length > 500) st.trades = st.trades.slice(-500);
    if (!SENT && cfg.autoajuste && Date.now() - (st.ultimoAjuste || 0) > (cfg.ajusteHoras || 6) * 3600e3) ajustar();
  } catch (e) {
    st.error = (REAL ? "" : "No pude leer el precio: ") + e.message; st.ultimaRevision = Date.now();
    console.error(new Date().toISOString(), st.error);
  }
  guardarJSON(F_EST, st); revisando = false;
}

// ---------- Dinero real ----------
let par = null, llaveRevisada = 0, llaveMal = null; // se revisa al arrancar y cada 6 horas
const sumaComision = (fills, activo) => (fills || []).filter(f => f.commissionAsset === activo).reduce((a, f) => a + +f.commission, 0);
async function comisionUSDT(o, base, precio) {
  let x = sumaComision(o.fills, "USDT") + sumaComision(o.fills, base) * precio;
  const bnb = base === "BNB" ? 0 : sumaComision(o.fills, "BNB");
  if (bnb) x += bnb * await cli.precio("BNBUSDT");
  return x;
}
async function revisarReal() {
  const mon = st.compras.length ? st.moneda : cfg.moneda;
  if (st.moneda !== mon) { st.moneda = mon; st.ref = null; }
  const simbolo = mon + "USDT";
  if (Date.now() - llaveRevisada > 6 * 3600e3) { await cli.sincronizar(); llaveMal = await Real.revisarLlave(cli); llaveRevisada = Date.now(); }
  if (llaveMal) throw new Error(llaveMal);
  if (!par || par.simbolo !== simbolo) par = { simbolo, ...await cli.reglas(simbolo) };
  const precio = await cli.precio(simbolo), ahora = Date.now();
  const cta = await cli.cuenta(), libre = a => +((cta.balances || []).find(b => b.asset === a) || { free: 0 }).free;
  st.usdtLibre = libre("USDT"); st.baseLibre = libre(par.base);
  st.error = null; st.aviso = null;
  if (TODO) adoptar(precio, ahora);
  // Decide con la misma lógica de la simulación (sobre una copia) y luego lo hace de verdad.
  const copia = JSON.parse(JSON.stringify(st)); copia.usdt = 1e9; copia.trades = [];
  const decisiones = await decidir(copia, cfg, precio, ahora, mon);
  st.ultimoPrecio = precio; st.ultimaRevision = ahora; st.ref = copia.ref; st.movVenta = copia.movVenta;
  const vendidas = [];
  for (const h of decisiones) {
    try { if (h.tipo === "COMPRA") await comprarReal(h, precio, ahora); else vendidas.push(await venderReal(h, precio, ahora)); }
    catch (e) {
      if (/No sé si|quedó en estado/.test(e.message)) st.pausado = `Pausado por seguridad: ${e.message}. Revisa tus órdenes en Binance.`;
      else st.error = `No se pudo ${h.tipo === "COMPRA" ? "comprar" : "vender"}: ${e.message}`;
      console.error(new Date().toISOString(), e.message); break;
    }
  }
  try { await pasarGanancias(vendidas.filter(Boolean)); } catch (e) { st.error = "No se pudo pasar la ganancia a Bitcoin: " + e.message; }
  if (!TODO && st.ganado <= -Math.abs(cfg.perdidaMax) && !st.pausado) st.pausado = `Pausado: la pérdida total llegó a ${st.ganado.toFixed(2)} USDT (tu tope es ${cfg.perdidaMax}).`;
}
// Toma como "compra abierta" todo lo que haya en Spot de la moneda. Si depositas o retiras, se ajusta solo.
function adoptar(precio, ahora) {
  const valor = st.baseLibre * precio; let c = st.compras[0];
  st.polvo = 0; st.polvoCosto = 0;
  if (valor >= par.minNotional) {
    if (!c) { st.compras = [{ precio, btc: st.baseLibre, costo: valor, t: ahora, adoptado: true }]; anotarAjuste(`Tomé ${st.baseLibre} ${par.base} de tu Spot para manejarlos (valen ${valor.toFixed(2)} USDT).`); }
    else if (Math.abs(c.btc - st.baseLibre) > 1e-8) { c.costo = st.baseLibre > c.btc ? c.costo + (st.baseLibre - c.btc) * precio : c.costo * st.baseLibre / c.btc; c.btc = st.baseLibre; }
  } else {
    st.compras = [];
    if (valor > 1) st.aviso = `Tus ${st.baseLibre} ${par.base} en Spot valen ${valor.toFixed(2)} USDT; Binance pide al menos ${par.minNotional} USDT para venderlos.`;
  }
}
async function comprarReal(h, precio, ahora) {
  // Sentimiento: usa todo el monto, o lo que haya libre si es menos.
  // con todoBTC recompra con lo que sacó al vender; con reinvertir usa el monto más lo que ya ganó (o menos lo que perdió)
  const tope = TODO && st.usdtBot > 0 ? st.usdtBot : cfg.gananciasA === "BTC" ? Math.max(0, Math.floor((+cfg.monto + Math.min(0, (st.ganado || 0) - (st.usdtPasado || 0) - (st.porPasar || 0))) * 100) / 100)
    : cfg.reinvertir ? Math.max(0, Math.floor((+cfg.monto + (st.ganado || 0)) * 100) / 100) : +cfg.monto;
  const monto = SENT ? Math.min(tope, Math.floor(st.usdtLibre * 0.998 * 100) / 100) : +cfg.monto;
  if (monto < par.minNotional * 1.15) { st.aviso = `El monto por compra (${monto} USDT) es muy chico: Binance pide más de ${par.minNotional} USDT y debe alcanzar para vender aunque baje.`; return; }
  if (st.usdtLibre < monto || monto <= 0) { st.aviso = `Quería comprar pero solo hay ${st.usdtLibre.toFixed(2)} USDT libres en Spot (necesita ${monto}).`; return; }
  const o = await cli.orden({ symbol: par.simbolo, side: "BUY", quoteOrderQty: String(monto) });
  const qty = +o.executedQty, quote = +o.cummulativeQuoteQty, prom = quote / qty;
  const fee = await comisionUSDT(o, par.base, prom);
  // Binance solo deja vender en pasos (ej. 0.0001 ETH). Lo que sobra ("polvo") se guarda con su costo
  // y se vende junto con una venta futura cuando junta un paso completo.
  const recibido = qty - sumaComision(o.fills, par.base), lote = +Real.aPaso(recibido, par.paso);
  const pagado = quote + fee - sumaComision(o.fills, par.base) * prom; // USDT + comisión cobrada en BNB
  st.polvo = +((st.polvo || 0) + recibido - lote).toFixed(10); st.polvoCosto = +((st.polvoCosto || 0) + pagado * (1 - lote / recibido)).toFixed(10);
  const c = { precio: prom, btc: lote, costo: +(pagado * lote / recibido).toFixed(8), t: ahora, orden: o.orderId };
  st.compras.push(c); st.usdtLibre -= quote; if (TODO) st.usdtBot = Math.max(0, (st.usdtBot || 0) - quote);
  const t = { t: ahora, tipo: "COMPRA", real: true, precio: prom, btc: lote, usdt: quote, comision: +fee.toFixed(8), motivo: h.motivo, orden: o.orderId };
  st.trades.push(t); anotar(t); console.log(new Date().toISOString(), "COMPRA REAL", par.simbolo, lote, "a", prom);
}
async function venderReal(h, precio, ahora) {
  const c = st.compras.find(x => x.t === h.compra); if (!c) return;
  const cant = Real.aPaso(c.btc + (st.polvo || 0), par.paso), extra = Math.max(0, +cant - c.btc);
  const costoExtra = extra && st.polvo ? st.polvoCosto * Math.min(1, extra / st.polvo) : 0;
  if (st.baseLibre + 1e-12 < +cant) throw new Error(`no encuentro los ${cant} ${par.base} del bot en Spot (hay ${st.baseLibre})`);
  const o = await cli.orden({ symbol: par.simbolo, side: "SELL", quantity: cant });
  const qty = +o.executedQty, quote = +o.cummulativeQuoteQty, prom = quote / qty;
  // Si Binance solo deja vender menos que la compra (por el paso mínimo), lo que sobra queda como "polvo" con su parte del costo.
  const resto = Math.max(0, c.btc - qty), costoResto = resto > 1e-12 ? c.costo * resto / c.btc : 0;
  const fee = await comisionUSDT(o, par.base, prom), neto = quote - fee, ganancia = +(neto - (c.costo - costoResto) - costoExtra).toFixed(8);
  st.polvo = +Math.max(0, (st.polvo || 0) - extra + (costoResto ? resto : 0)).toFixed(10); st.polvoCosto = +Math.max(0, (st.polvoCosto || 0) - costoExtra + costoResto).toFixed(10);
  st.compras.splice(st.compras.indexOf(c), 1); st.ganado = +(st.ganado + ganancia).toFixed(8);
  if (TODO) st.usdtBot = +((st.usdtBot || 0) + neto).toFixed(8);
  if (!st.compras.length) st.ref = prom;
  const t = { t: ahora, tipo: h.tipo, real: true, precio: prom, btc: qty, usdt: +neto.toFixed(8), comision: +fee.toFixed(8), ganancia, motivo: h.motivo, orden: o.orderId };
  st.trades.push(t); anotar(t); console.log(new Date().toISOString(), t.tipo, "REAL", par.simbolo, qty, "a", prom, "ganancia", ganancia);
  return t;
}

// ---------- Ganancias a Bitcoin (gananciasA: "BTC") ----------
// Cada venta con ganancia aparta esa ganancia; cuando junta 5.5 USDT (mínimo de Binance) compra Bitcoin con ella.
// Ese Bitcoin nunca se vende: es para juntar. Si hubo pérdidas, primero se repone el monto.
async function pasarGanancias(ventas) {
  if (cfg.gananciasA !== "BTC") return;
  for (const v of ventas) if (v.tipo === "VENTA" && v.ganancia > 0) st.porPasar = +((st.porPasar || 0) + v.ganancia).toFixed(8);
  const deuda = Math.max(0, (st.usdtPasado || 0) + (st.porPasar || 0) - Math.max(0, st.ganado)); // no pasar más de lo ganado en total
  const monto = Math.floor(Math.max(0, (st.porPasar || 0) - deuda) * 100) / 100;
  if (monto < 5.5) return;
  const ahora = Date.now(); let btc, precio, fee;
  if (REAL) {
    if (st.usdtLibre < monto) return;
    const o = await cli.orden({ symbol: "BTCUSDT", side: "BUY", quoteOrderQty: String(monto) });
    const qty = +o.executedQty, quote = +o.cummulativeQuoteQty; precio = quote / qty;
    btc = qty - sumaComision(o.fills, "BTC"); fee = await comisionUSDT(o, "BTC", precio); st.usdtLibre -= quote;
  } else {
    const r = await fetch(`${API}/api/v3/ticker/price?symbol=BTCUSDT`, { signal: AbortSignal.timeout(15000) });
    precio = +(await r.json()).price; if (!(precio > 0)) return;
    fee = monto * cfg.comision / 100; btc = (monto - fee) / precio; st.usdt -= monto;
  }
  st.porPasar = +Math.max(0, st.porPasar - monto).toFixed(8); st.usdtPasado = +((st.usdtPasado || 0) + monto).toFixed(8);
  st.btcJuntado = +((st.btcJuntado || 0) + btc).toFixed(8);
  const t = { t: ahora, tipo: "A BITCOIN", real: REAL || undefined, precio, btc, usdt: monto, comision: +fee.toFixed(8), motivo: "ganancia pasada a Bitcoin" };
  st.trades.push(t); anotar(t); console.log(new Date().toISOString(), "A BITCOIN", monto, "USDT ->", btc, "BTC a", precio);
}

// ---------- Ajuste automático (cada 6 horas; se cambia con ajusteHoras en config.json) ----------
// Baja los últimos 30 días de precio real, prueba 294 combinaciones de reglas (elige con 20 días y
// revisa con los otros 10) y cambia a las nuevas solo si en esos 10 días ganaron y les fue mejor
// que a las reglas actuales. Cada decisión queda en cambios.log y en el panel.
const DIA = 864e5;
async function velas30() {
  const fin = Date.now(), precios = [];
  for (let desde = fin - 30 * DIA; desde < fin;) {
    const r = await fetch(`${API}/api/v3/klines?symbol=${cfg.moneda}USDT&interval=1m&limit=1000&startTime=${desde}`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error("Binance respondió " + r.status);
    const k = await r.json(); if (!k.length) break;
    for (const v of k) precios.push({ t: v[0], p: +v[4] });
    desde = k[k.length - 1][0] + 60000;
  }
  if (precios.length < 20000) throw new Error("llegaron pocos precios (" + precios.length + ")");
  return precios;
}
const texto = g => `compra si baja ${g.bajada}%, vende si sube ${g.subida}%, ${g.lotes} a la vez, tope ${g.tope}%`;
function anotarAjuste(msg) {
  st.ajustes.push({ t: Date.now(), msg }); st.ajustes = st.ajustes.slice(-10);
  fs.appendFileSync(F_CAMBIOS, new Date().toISOString() + "  " + msg + "\n"); console.log("AJUSTE", msg);
}
let ajustando = false;
async function ajustar() {
  if (ajustando) return; ajustando = true;
  try {
    const precios = await velas30();
    const corte = precios[0].t + 20 * DIA, pru = precios.filter(x => x.t >= corte);
    const actual = Bot.probar(cfg, pru);
    const buenas = Bot.buscarMejores(cfg, precios, 3).filter(r => r.pru.final > 0 && r.pru.positivos >= r.pru.negativos);
    buenas.sort((a, b) => b.pru.final - a.pru.final);
    const mejor = buenas[0];
    if (mejor && mejor.pru.final > actual.final + 0.01 && texto(mejor.reglas) !== texto(cfg)) {
      const antes = texto(cfg);
      for (const k of ["bajada", "subida", "lotes", "tope"]) cfg[k] = mejor.reglas[k];
      guardarJSON(F_CFG, cfg);
      anotarAjuste(`Cambié las reglas: ahora ${texto(cfg)} (antes ${antes}). En los últimos 10 días las nuevas habrían hecho ${signo(mejor.pru.final)} USDT con ${mejor.pru.positivos} días a favor; las anteriores ${signo(actual.final)} USDT.`);
    } else {
      anotarAjuste(`Revisé 30 días y dejé las reglas igual (${texto(cfg)}): en los últimos 10 días habrían hecho ${signo(actual.final)} USDT${mejor ? "" : " y ninguna otra combinación salió claramente mejor"}.`);
    }
  } catch (e) {
    anotarAjuste("No pude hacer el ajuste de hoy: " + e.message + ". Lo intento otra vez en una hora.");
    st.ultimoAjuste = Date.now() - ((cfg.ajusteHoras || 6) - 1) * 3600e3; ajustando = false; return;
  }
  st.ultimoAjuste = Date.now(); guardarJSON(F_EST, st); ajustando = false;
}

// Panel para ver desde el celular: http://IP-DEL-SERVIDOR:8080/?clave=...
const usd = (x, d = 2) => Number(x).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const signo = x => (x >= 0 ? "+" : "−") + usd(Math.abs(x));
const cuando = t => new Date(t).toLocaleString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
// Gráfica de líneas (SVG, sin librerías): precio diario de los últimos 120 días, EMA20/EMA50,
// círculos donde la estrategia habría comprado/vendido y triángulos donde el bot compró/vendió de verdad.
function grafica() {
  if (!graf || !graf.dias.length) return "";
  const W = 680, H = 300, L = 6, R = 58, T = 12, B = 24, ahora = Date.now(), p = st.ultimoPrecio;
  const puntos = graf.dias.map(d => [d.t, d.c]).concat(p ? [[ahora, p]] : []);
  const t0 = graf.dias[0].t, t1 = ahora, mias = st.trades.filter(t => t.t >= t0 && (t.tipo === "COMPRA" || t.tipo === "VENTA"));
  const vals = graf.dias.flatMap(d => [d.c, d.e20, d.e50]).concat(p ? [p] : [], mias.map(t => t.precio));
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = (hi - lo) * 0.08 || hi * 0.02; lo -= pad; hi += pad;
  const x = t => (L + (t - t0) / (t1 - t0) * (W - L - R)).toFixed(1), y = v => (T + (hi - v) / (hi - lo) * (H - T - B)).toFixed(1);
  const linea = (pts, color, ancho, extra = "") => `<polyline fill="none" stroke="${color}" stroke-width="${ancho}" stroke-linejoin="round" stroke-linecap="round" ${extra} points="${pts.map(([t, v]) => x(t) + "," + y(v)).join(" ")}"/>`;
  const dec = hi >= 1000 ? 0 : 2, rejilla = [0, 1, 2, 3].map(j => { const v = lo + (hi - lo) * (0.1 + 0.8 * j / 3); return `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="#1d2c52"/><text x="${W - R + 6}" y="${+y(v) + 4}" fill="#8c9abb" font-size="11">${usd(v, dec)}</text>`; }).join("");
  const meses = []; for (let d = new Date(t0); d <= new Date(t1); d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDate() === 1) meses.push(new Date(d));
  const etiquetas = meses.map(d => `<line x1="${x(+d)}" x2="${x(+d)}" y1="${T}" y2="${H - B}" stroke="#14213f"/><text x="${x(+d)}" y="${H - 7}" fill="#8c9abb" font-size="11" text-anchor="middle">${d.toLocaleString("es-MX", { month: "short", timeZone: "UTC" })}</text>`).join("");
  const habria = graf.marcas.map(m => `<circle cx="${x(m.t)}" cy="${y(m.p)}" r="5" fill="#070d1c" stroke="${m.tipo === "COMPRA" ? "#2fd08a" : "#ff5d6c"}" stroke-width="2"/>`).join("");
  const reales = mias.map(t => { const cx = +x(t.t), cy = +y(t.precio), c = t.tipo === "COMPRA"; return `<path d="${c ? `M${cx} ${cy + 3}l-7 12h14z` : `M${cx} ${cy - 3}l-7 -12h14z`}" fill="${c ? "#2fd08a" : "#ff5d6c"}" stroke="#070d1c" stroke-width="1.5"/>`; }).join("");
  const ult = p ? `<circle cx="${x(ahora)}" cy="${y(p)}" r="4" fill="#f2b632"/><rect x="${W - R + 2}" y="${+y(p) - 9}" width="${R - 4}" height="18" rx="5" fill="#f2b632"/><text x="${W - R + 6}" y="${+y(p) + 4}" fill="#070d1c" font-size="11" font-weight="700">${usd(p, dec)}</text>` : "";
  return `<div class="k" style="margin-bottom:12px"><div class="l">${st.moneda || cfg.moneda} · últimos 120 días</div>
<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;margin-top:6px" role="img" aria-label="Precio con compras y ventas">${rejilla}${etiquetas}
${linea(graf.dias.map(d => [d.t, d.e50]), "#8c9abb", 1.2, 'stroke-dasharray="4 4"')}${linea(graf.dias.map(d => [d.t, d.e20]), "#5aa9ff", 1.4)}${linea(puntos, "#f2b632", 2.2)}${habria}${ult}${reales}</svg>
<div class="n" style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:4px"><span><b style="color:#f2b632">━</b> precio</span><span><b style="color:#5aa9ff">━</b> EMA20</span><span><b style="color:#8c9abb">┅</b> EMA50</span><span><b class="up">▲</b>/<b class="down">▼</b> compra/venta del bot</span><span><b class="up">○</b>/<b class="down">○</b> dónde la estrategia habría comprado/vendido</span></div></div>`;
}
function pagina() {
  const p = st.ultimoPrecio || 0, total = st.usdt + st.btc * p + (st.usdtPasado || 0), dif = total - st.base, n = Bot.niveles(st, cfg);
  const abierto = st.compras.reduce((a, c) => a + c.btc * p, 0);
  const espera = st.pausado ? "En pausa: " + st.pausado
    : (st.compras.length ? `Vender ≥ ${usd(Math.min(...n.ventas), p >= 1000 ? 0 : 2)} (${st.compras.length} de ${cfg.lotes} compras abiertas)` : "")
      + (n.compra ? `${st.compras.length ? " · " : ""}Comprar ≤ ${usd(n.compra, p >= 1000 ? 0 : 2)}` : "") || "Arrancando";
  const MOV = +cfg.movimiento || 0, MOVB = +(cfg.movimientoBaja ?? cfg.movimiento) || 0;
  const sg = st.senales, cod = cfg.codicia ?? Sen.DEF.codicia, mie = cfg.miedo ?? Sen.DEF.miedo;
  const esperaSent = st.pausado ? "En pausa: " + st.pausado : !sg ? "Leyendo señales…"
    : st.compras.length ? `Tiene ${st.moneda} comprado.${MOV ? ` Vende con ganancia a ${usd(Math.max(...st.compras.map(c => c.precio)) * (1 + MOV / 100), 2)} (+${MOV}%).` : ""} Vende todo si el índice baja a ${mie} o la EMA20 cae abajo de la EMA50.`
    : st.movVenta ? `En USDT tras vender con ganancia. Recompra a ${usd(st.movVenta * (1 - MOVB / 100), 2)} (-${MOVB}%) o a ${usd(st.movVenta * (1 + MOV / 100), 2)} si sigue subiendo.`
    : `En USDT. Compra cuando el índice llegue a ${cod} y la EMA20 esté arriba de la EMA50.`;
  const filas = st.trades.slice(-50).reverse().map(t => `<tr><td>${cuando(t.t)}</td><td class="${t.tipo === "COMPRA" ? "up" : t.tipo === "VENTA" ? "down" : "gold"}">${t.tipo}</td><td>${usd(t.precio)}</td><td class="${t.ganancia == null ? "" : t.ganancia >= 0 ? "up" : "down"}">${t.ganancia == null ? "" : signo(t.ganancia)}</td></tr>`).join("");
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="60"><title>Bot Cripto</title><style>
body{margin:0;background:#070d1c;color:#e7ecf7;font:14px/1.5 system-ui,sans-serif}.w{max-width:720px;margin:0 auto;padding:18px 16px}
h1{font-size:20px;margin:0 0 4px}h1 span{color:#f2b632}.sub{color:#8c9abb;font-size:12.5px;margin:0 0 14px}
.b{border:1px dashed #f2b632;background:rgba(242,182,50,.14);border-radius:12px;padding:9px 12px;font-size:13px;margin-bottom:12px}.b b{color:#f2b632}
.e{border:1px solid #ff5d6c;background:rgba(255,93,108,.1);border-radius:12px;padding:9px 12px;font-size:13px;margin-bottom:12px}
.g{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.k{background:#0d1730;border:1px solid #1d2c52;border-radius:14px;padding:12px}
.l{color:#8c9abb;font-size:11px;text-transform:uppercase;letter-spacing:.07em}.v{font-size:19px;font-weight:600;margin-top:2px}.n{color:#8c9abb;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:13px;background:#0d1730;border:1px solid #1d2c52;border-radius:14px}th,td{padding:7px 8px;border-bottom:1px solid #1d2c52;text-align:right}th:first-child,td:first-child,th:nth-child(2),td:nth-child(2){text-align:left}th{color:#8c9abb;font-weight:500;font-size:11px}
.up{color:#2fd08a}.down{color:#ff5d6c}.gold{color:#f2b632}</style></head><body><div class="w">
<h1>Bot <span>Cripto</span></h1><p class="sub">Funcionando 24/7 en el servidor · revisado ${st.ultimaRevision ? cuando(st.ultimaRevision) : "…"} · se actualiza cada minuto</p>
${REAL ? `<div class="e"><b>DINERO REAL.</b> ${TODO ? `Maneja todos tus ${st.moneda} de Spot: los pasa a USDT con miedo o tendencia de bajada y los recompra con codicia y tendencia de subida.` : `Compra y vende ${st.moneda} de verdad en tu Binance Spot, solo con USDT y solo vende lo que él compró.`}</div>`
  : `<div class="b"><b>MODO SIMULACIÓN.</b> Dinero ficticio con precios reales de Binance.${cfg.real ? " Para pasar a dinero real falta poner la llave en el servidor." : ""}</div>`}
${alerta() ? `<div class="e"><b>ALERTA POR NOTICIAS.</b> ${alerta().motivo}. El bot vendió y no compra hasta el ${cuando(Date.parse(alerta().hasta))}</div>` : ""}${st.error ? `<div class="e">${st.error}</div>` : ""}${st.aviso ? `<div class="b">${st.aviso}</div>` : ""}
<div class="g"><div class="k"><div class="l">Precio ${st.moneda || cfg.moneda}</div><div class="v">${p ? usd(p) : "…"}</div><div class="n">USDT</div></div>
${REAL ? `<div class="k"><div class="l">USDT libre en Spot</div><div class="v">${usd(st.usdtLibre || 0)}</div><div class="n">En compras abiertas: ${usd(abierto)} USDT</div></div>`
  : `<div class="k"><div class="l">Saldo ficticio</div><div class="v">${usd(total)}</div><div class="n ${dif >= 0 ? "up" : "down"}">${signo(dif)} USDT desde ${usd(st.base)}</div></div>`}
<div class="k" style="grid-column:1/-1"><div class="l">Qué está esperando</div>${SENT ? `<div class="v gold" style="font-size:16px">${esperaSent}</div><div class="n">Moneda: ${cfg.moneda} · Estrategia: noticias y redes (índice de miedo y codicia) + tendencia EMA 20/50 · ${TODO ? `todo tu ${cfg.moneda} de Spot` : `${cfg.monto} USDT`}${cfg.gananciasA === "BTC" ? " · las ganancias se pasan a Bitcoin" : cfg.reinvertir ? " + ganancias (reinvierte)" : ""}</div></div></div>
<div class="g"><div class="k"><div class="l">Miedo y codicia hoy</div><div class="v ${sg && sg.indice >= cod ? "up" : sg && sg.indice <= mie ? "down" : ""}">${sg ? sg.indice : "…"}</div><div class="n">${sg ? sg.nombre : ""} · compra ≥ ${cod}, vende ≤ ${mie}</div></div>
<div class="k"><div class="l">Tendencia (EMA 20 / 50)</div><div class="v ${sg && sg.e20 > sg.e50 ? "up" : "down"}">${sg ? (sg.e20 > sg.e50 ? "Subiendo" : "Bajando") : "…"}</div><div class="n">${sg ? `EMA20 ${usd(sg.e20, 0)} · EMA50 ${usd(sg.e50, 0)}` : ""}</div></div></div>`
  : `<div class="v gold" style="font-size:16px">${espera}</div><div class="n">Moneda: ${cfg.moneda} · Reglas: compra si baja ${cfg.bajada}%, vende si sube ${cfg.subida}%, ${cfg.monto} USDT por compra, hasta ${cfg.lotes} a la vez, tope ${cfg.tope}%</div></div></div>
<div class="k" style="margin-bottom:12px"><div class="l">Ajuste automático ${cfg.autoajuste ? `(cada ${cfg.ajusteHoras || 6} horas)` : "(apagado)"}</div>${st.ajustes.slice(-3).reverse().map(a => `<div class="n" style="margin-top:6px"><b style="color:#e7ecf7">${cuando(a.t)}</b> · ${a.msg}</div>`).join("") || `<div class="n">Todavía no hace su primera revisión.</div>`}</div>`}
${cfg.gananciasA === "BTC" ? `<div class="k" style="margin-bottom:12px"><div class="l">Bitcoin juntado con las ganancias</div><div class="v gold">${(st.btcJuntado || 0).toFixed(8)} BTC</div><div class="n">Se compró con ${usd(st.usdtPasado || 0)} USDT de ganancias${(st.porPasar || 0) >= 0.01 ? ` · apartado para la próxima compra: ${usd(st.porPasar)} USDT (Binance pide 5.5 mínimo)` : ""}. Este Bitcoin no se vende.</div></div>` : ""}
${SENT ? grafica() : ""}
<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Precio</th><th>Ganancia</th></tr></thead><tbody>${filas || `<tr><td colspan="4" style="text-align:center;color:#8c9abb">Todavía no hay operaciones</td></tr>`}</tbody></table>
<p class="n">Ganancia hecha: <span class="${st.ganado >= 0 ? "up" : "down"}">${signo(st.ganado)} USDT</span> en ${st.trades.filter(t => t.ganancia != null).length} ventas.</p>
</div></body></html>`;
}
http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  // Panel de solo lectura: sin la clave no muestra nada. No acepta acciones ni claves de Binance.
  const dada = Buffer.from(u.searchParams.get("clave") || ""), buena = Buffer.from(String(cfg.clavePanel));
  if (req.method !== "GET" || dada.length !== buena.length || !crypto.timingSafeEqual(dada, buena)) { res.writeHead(403, { "content-type": "text/plain; charset=utf-8" }); return res.end("Falta la clave: abre la dirección con ?clave=TU_CLAVE"); }
  if (u.pathname === "/registro.csv") { res.writeHead(200, { "content-type": "text/csv; charset=utf-8" }); return res.end(fs.existsSync(F_CSV) ? fs.readFileSync(F_CSV) : ""); }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(pagina());
}).listen(cfg.puerto, () => console.log(`Bot Cripto en ${REAL ? "DINERO REAL" : "simulación"}. Panel: http://IP-DEL-SERVIDOR:${cfg.puerto}/?clave=${cfg.clavePanel}`));

// ---------- Actualización automática ----------
// Si esta carpeta viene de GitHub, cada 2 minutos baja la versión más nueva. Si hubo cambios,
// el programa se cierra y el servicio lo vuelve a abrir ya actualizado (tus datos no se tocan).
const { execFile } = require("child_process");
const git = (...a) => new Promise((ok, mal) => execFile("git", a, { cwd: DIR, timeout: 60000 }, (e, out) => e ? mal(e) : ok(out.trim())));
let actualizando = false;
async function actualizar() {
  if (actualizando) return; actualizando = true;
  try {
    const antes = await git("rev-parse", "HEAD");
    await git("pull", "--ff-only", "--quiet");
    const despues = await git("rev-parse", "HEAD");
    if (antes !== despues) {
      anotarAjuste(`Me actualicé a una versión nueva (${despues.slice(0, 7)}). Reinicio en un momento.`);
      guardarJSON(F_EST, st); setTimeout(() => process.exit(0), 500);
    }
  } catch (e) { console.error(new Date().toISOString(), "No pude buscar actualizaciones:", e.message.split("\n")[0]); }
  actualizando = false;
}
if (fs.existsSync(path.join(DIR, ".git"))) { const cada = +process.env.ACTUALIZAR_MS || 2 * 60000; setTimeout(actualizar, Math.min(cada, 5 * 60000)); setInterval(actualizar, cada); }

revisar(); setInterval(revisar, +process.env.INTERVALO_MS || 60000);
