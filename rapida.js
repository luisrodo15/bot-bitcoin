// Prueba "rápida" SIMULADA (sin dinero real, sin órdenes). Solo se activa con "rapidaPrueba": true en ajustes.json.
// Estrategia (analisis/horas.js, velas de 1 h de ETH desde 2020; ~160 operaciones al año, 5 de 6 años positivos):
// - Dirección según el día: si ETH cerró ayer arriba de su promedio de 45 días solo busca LARGOS; si cerró abajo, solo CORTOS.
// - Entrada: cuando una vela de 1 hora cierra arriba del máximo de las 48 horas anteriores (largo) o abajo del mínimo (corto).
// - Salida: +3% de ganancia, −1% de pérdida, o a las 48 horas lo que haya.
// Como si tuviera 15 USDT y abriera la posición mínima (0.009 ETH, 2x); comisión 0.05% por lado.
const Real = require("./real.js");
const SIMBOLO = "ETHUSDT", ETH = 0.009, CAPITAL = 15, COM = 0.0005, N = 45, HORAS = 48, TP = 0.03, SL = 0.01, MAXH = 48;
const cli = Real.crearCliente(process.env.API_FUTUROS || "https://fapi.binance.com", null);
const velas = (iv, n) => cli.llamar("GET", "/fapi/v1/klines", { symbol: SIMBOLO, interval: iv, limit: n }, false)
  .then(d => d.map(x => ({ t: +x[0], h: +x[2], l: +x[3], c: +x[4], fin: +x[6] })));

async function revisar(st, ahora) {
  const r = st.rapida || (st.rapida = { inicio: ahora, saldo: CAPITAL, ops: [], pos: null, vela: 0 });
  if (ahora - (r.revisado || 0) < 30e3) return;
  const precio = +(await cli.llamar("GET", "/fapi/v1/ticker/price", { symbol: SIMBOLO }, false)).price;
  if (!(precio > 0)) throw new Error("sin precio de ETH");
  r.precio = precio; r.revisado = ahora;
  if (r.pos) { // ¿toca salir?
    const p = r.pos, mov = p.lado * (precio / p.p - 1);
    let motivo = mov >= TP ? "meta +3%" : mov <= -SL ? "stop −1%" : ahora - p.t >= MAXH * 3600e3 ? "48 horas" : null;
    if (motivo) {
      const g = p.lado * (precio - p.p) * ETH - (p.p + precio) * ETH * COM;
      r.saldo += g; r.ops.push({ t: ahora, tipo: "CIERRE", lado: p.lado, precio, ganancia: g, motivo }); r.pos = null;
    }
  }
  r.ops = r.ops.slice(-200);
  if (r.pos) return;
  // Señal: solo con velas de 1 h ya cerradas, y una vez por vela.
  const h = (await velas("1h", HORAS + 2)).filter(x => x.fin < ahora); const u = h[h.length - 1];
  if (!u || u.t <= r.vela) return;
  r.vela = u.t;
  const d = (await velas("1d", N + 2)).filter(x => x.fin < ahora).slice(-N);
  if (d.length < N) return;
  const prom = d.reduce((a, x) => a + x.c, 0) / N, ayer = d[d.length - 1].c, lado = ayer > prom ? 1 : -1;
  const prev = h.slice(-HORAS - 1, -1), mx = Math.max(...prev.map(x => x.h)), mn = Math.min(...prev.map(x => x.l));
  r.lado = lado; r.mx = mx; r.mn = mn; r.prom = prom;
  if ((lado > 0 && u.c > mx) || (lado < 0 && u.c < mn)) {
    r.pos = { lado, p: precio, t: ahora }; r.ops.push({ t: ahora, tipo: "ENTRADA", lado, precio });
  }
}
module.exports = { revisar, CAPITAL, TP, SL, MAXH };
