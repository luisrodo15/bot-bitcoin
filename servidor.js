// Bot Cripto para servidor: revisa el precio (BTC, ETH, SOL o BNB contra USDT) cada minuto, 24/7.
// MODO SIMULACIÓN: dinero ficticio, solo lee el precio público de Binance. No usa claves.
const fs = require("fs"), path = require("path"), http = require("http"), crypto = require("crypto");
require("./bot.js"); const Bot = globalThis.Bot;

const DIR = __dirname;
const F_CFG = path.join(DIR, "config.json"), F_EST = path.join(DIR, "estado.json"), F_CSV = path.join(DIR, "registro.csv");
const API = process.env.API_BINANCE || "https://api.binance.com";
const urlPrecio = () => `${API}/api/v3/ticker/price?symbol=${cfg.moneda}USDT`;
const F_CAMBIOS = path.join(DIR, "cambios.log");

function leerJSON(f, def) { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return def; } }
function guardarJSON(f, v) { fs.writeFileSync(f + ".tmp", JSON.stringify(v, null, 2)); fs.renameSync(f + ".tmp", f); }

// Reglas: config.json (se crea la primera vez con las reglas iniciales y una clave para ver el panel).
let cfg = leerJSON(F_CFG, null);
if (!cfg) { cfg = { ...Bot.CONFIG_INICIAL, autoajuste: true, ajusteHoras: 6, puerto: 8080, clavePanel: crypto.randomBytes(18).toString("base64url") }; guardarJSON(F_CFG, cfg); }
cfg = { ...Bot.CONFIG_INICIAL, autoajuste: true, ...cfg };
let st = leerJSON(F_EST, null) || Bot.estadoInicial(cfg);
// Si cambiaste la moneda en config.json, empieza una simulación nueva con esa moneda.
if ((st.moneda || "BTC") !== cfg.moneda) st = Bot.estadoInicial(cfg);
st.compras = st.compras || []; st.ajustes = st.ajustes || [];

function anotar(h) {
  if (!fs.existsSync(F_CSV)) fs.writeFileSync(F_CSV, "﻿fecha,tipo,precio_usdt,btc,usdt,comision_usdt,ganancia_usdt,motivo\n");
  fs.appendFileSync(F_CSV, [new Date(h.t).toISOString(), h.tipo, h.precio, h.btc.toFixed(8), h.usdt, h.comision, h.ganancia ?? "", `"${h.motivo}"`].join(",") + "\n");
}

async function revisar() {
  try {
    const r = await fetch(urlPrecio(), { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error("Binance respondió " + r.status);
    const precio = +(await r.json()).price;
    if (!(precio > 0)) throw new Error("precio inválido");
    st.error = null;
    for (const h of Bot.revisar(st, cfg, precio, Date.now())) { anotar(h); console.log(new Date().toISOString(), h.tipo, h.precio, h.motivo, h.ganancia ?? ""); }
    if (st.trades.length > 500) st.trades = st.trades.slice(-500);
    if (cfg.autoajuste && Date.now() - (st.ultimoAjuste || 0) > (cfg.ajusteHoras || 6) * 3600e3) ajustar();
  } catch (e) {
    st.error = "No pude leer el precio: " + e.message; st.ultimaRevision = Date.now();
    console.error(new Date().toISOString(), st.error);
  }
  guardarJSON(F_EST, st);
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
function pagina() {
  const p = st.ultimoPrecio || 0, total = st.usdt + st.btc * p, dif = total - st.base, n = Bot.niveles(st, cfg);
  const espera = st.pausado ? "En pausa: " + st.pausado
    : (st.compras.length ? `Vender ≥ ${usd(Math.min(...n.ventas), p >= 1000 ? 0 : 2)} (${st.compras.length} de ${cfg.lotes} compras abiertas)` : "")
      + (n.compra ? `${st.compras.length ? " · " : ""}Comprar ≤ ${usd(n.compra, p >= 1000 ? 0 : 2)}` : "") || "Arrancando";
  const filas = st.trades.slice(-50).reverse().map(t => `<tr><td>${cuando(t.t)}</td><td class="${t.tipo === "COMPRA" ? "up" : "down"}">${t.tipo}</td><td>${usd(t.precio)}</td><td class="${t.ganancia == null ? "" : t.ganancia >= 0 ? "up" : "down"}">${t.ganancia == null ? "" : signo(t.ganancia)}</td></tr>`).join("");
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
<div class="b"><b>MODO SIMULACIÓN.</b> Dinero ficticio con precios reales de Binance.</div>
${st.error ? `<div class="e">${st.error}</div>` : ""}
<div class="g"><div class="k"><div class="l">Precio ${cfg.moneda}</div><div class="v">${p ? usd(p) : "…"}</div><div class="n">USDT</div></div>
<div class="k"><div class="l">Saldo ficticio</div><div class="v">${usd(total)}</div><div class="n ${dif >= 0 ? "up" : "down"}">${signo(dif)} USDT desde ${usd(st.base)}</div></div>
<div class="k" style="grid-column:1/-1"><div class="l">Qué está esperando</div><div class="v gold" style="font-size:16px">${espera}</div><div class="n">Moneda: ${cfg.moneda} · Reglas: compra si baja ${cfg.bajada}%, vende si sube ${cfg.subida}%, ${cfg.monto} USDT por compra, hasta ${cfg.lotes} a la vez, tope ${cfg.tope}%</div></div></div>
<div class="k" style="margin-bottom:12px"><div class="l">Ajuste automático ${cfg.autoajuste ? `(cada ${cfg.ajusteHoras || 6} horas)` : "(apagado)"}</div>${st.ajustes.slice(-3).reverse().map(a => `<div class="n" style="margin-top:6px"><b style="color:#e7ecf7">${cuando(a.t)}</b> · ${a.msg}</div>`).join("") || `<div class="n">Todavía no hace su primera revisión.</div>`}</div>
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
}).listen(cfg.puerto, () => console.log(`Bot Cripto en simulación. Panel: http://IP-DEL-SERVIDOR:${cfg.puerto}/?clave=${cfg.clavePanel}`));

// ---------- Actualización automática ----------
// Si esta carpeta viene de GitHub, cada 30 minutos baja la versión más nueva. Si hubo cambios,
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
if (fs.existsSync(path.join(DIR, ".git"))) { const cada = +process.env.ACTUALIZAR_MS || 30 * 60000; setTimeout(actualizar, Math.min(cada, 5 * 60000)); setInterval(actualizar, cada); }

revisar(); setInterval(revisar, +process.env.INTERVALO_MS || 60000);
