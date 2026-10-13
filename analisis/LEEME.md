# Análisis de estrategias

Datos (ramas de este repo, las llenan los workflows de GitHub Actions):
- `datos`: velas de 1 minuto, 12 meses, 7 monedas + USDT/MXN, USDC/MXN (`.github/workflows/datos.yml`)
- `diarios`: velas diarias desde 2018 + índice de miedo y codicia (`diarios.yml`)
- `ballenas`: métricas de futuros BTC (traders grandes, interés abierto) y financiación (`ballenas.yml`)

Uso: clonar la rama en una carpeta con su nombre junto a estos scripts, por ejemplo
`git clone -b diarios --depth 1 <repo> diarios`, y luego `node tecnico.js`, `node extras.js`.

## 2026-10-12: más pruebas
- corto.js: estrategias de 1h/4h (EMAs, RSI, Bollinger, rupturas, caída/rebote), entrena 6 meses y prueba 6. Ninguna constante; más semanas perdedoras que ganadoras.
- confluencia.js: copia del estilo "Neural Confluence Engine" (8 señales, 4h). Pierde en los primeros 6 meses en las 7 monedas.
- combo.js: la combinación de ChatGPT (tendencia + caída + rebote + confirmación + objetivo que cubra costos), 15 min y 1h. SOL −25% a −41% en prueba; pierde en casi todas.
- bolsa.js: filtros de bolsa de EUA (S&P 500, Nasdaq, VIX; datos en rama diarios). En promedio no mejoran la estrategia actual.
- meses.js: meses ganadores/perdedores de la estrategia actual.
- sol.js / miedo25.js (2026-10-12): vender con miedo ≤ 25 en vez de ≤ 30 mejora 2023-hoy en 6 de 7 monedas y el último año en todas (SOL +167%/+6% vs +89%/−4%). Vecinos 50/25 y 60/25 también. Se cambió a 55/25 y la simulación pasó a SOL.
- minuto.js / stop8.js (2026-10-12): vigilar minuto a minuto con stop móvil (salir si cae X% desde el máximo). En 12 meses de velas de 1 minuto algunos parecían ayudar, pero desde 2018 (máximos/mínimos diarios) todos los stops de 5% a 25% empeoran mucho: 2018-2022 típico +3017% sin stop vs +135% a +1305% con stop; 2023-hoy +127% vs −69% a +64%. No se usa stop.
- futuros.js (2026-10-12): estrategia en futuros, largo y largo+corto, 1x-3x, comisión 0.05% y financiamiento de BTC. Largo+corto 1x solo ganó el último año (+22% típico vs −2%); 2023-hoy −20% vs +127% spot. Con 2x-3x hay liquidaciones y pérdidas casi totales. No se usa. (Ojo: con apalancamiento algunos números bajan de −100% por cómo se calcula el cierre diario; la conclusión no cambia.)
- ethfut.js (2026-10-12): 18 configuraciones de futuros en ETH (6 reglas de corto x 1x/1.5x/2x). Ninguna le gana a spot en 2020-2022 ni en 2023-hoy; la mejor (corto si EMA20<50 y F&G<45, 1x) da +490%/+85%/+6% vs spot +2201%/+145%/−10%.
- chatgptfut.js (2026-10-12): reglas de futuros de ChatGPT (EMA50/200 1h, retroceso 15m, stop ATR, objetivo 1.5R, pausa tras 2 pérdidas). 12 meses: ETH −62% a 1x y −95% a 3x; BTC, SOL, BNB igual. ~700 operaciones al año, gana 39%; las comisiones se comen todo.
- idea1.js (revisión 2026-10-12): fuerza de BNB contra BTC (20-90 días) y recompra rápida tras salir por EMA. Ninguna mejora de forma constante; no se cambió nada.
- reinv_vs_btc.js (2026-10-12): con 12 USDT desde 2023, reinvertir todo en BNB = 66 USDT; pasar ganancias a BTC = 42 USDT (29 en BTC + 13 en el bot). Reinvertir gana; se dejó reinvertir.

## swing.js (2026-10-12): más movimiento dentro de la tendencia
El usuario quiere que el bot compre y venda más seguido. Probé: mientras la regla dice tener BNB, vender una parte (30%, 50% o todo)
cuando sube X% (3/5/8/12) y recomprar al bajar Y% (3/5/8) o si sigue subiendo. Datos diarios desde 2018, comisión 0.075%.
- Da 10 a 70 operaciones al año (la regla actual 3-5), pero casi siempre gana menos: BNB 2018-22 regla actual +10363%, la mejor variante +8711%.
- 2023-hoy y último año: mezclado; +8/-8 con todo: 2023-hoy +531% (actual +451%) pero último año +11% (actual +30%) y 2018-22 +4375%.
- Con 8 USDT no se puede mover solo una parte (Binance pide 5 USDT por orden), así que solo serviría la variante de todo.
Conclusión: no lo pongo por mi cuenta; más operaciones = más comisiones y salir antes de las subidas grandes.
- 2026-10-12 19:25: el usuario pidió más operaciones ("pocas al año no me sirve"). Activado "movimiento": 3 (vende todo al +3% desde la compra
  mientras la tendencia es buena; recompra al -3% desde la venta o si sigue subiendo 3%). En swing.js (+3/-3 todo): BNB último año +36% (actual +30%),
  2023-hoy +410% (+451%), 2018-22 +1824% (+10363%). Probado contra el Binance falso. Se apaga quitando "movimiento" de ajustes.json.

## swingmin.js (2026-10-12): movimiento con datos de 1 minuto, último año (BNB guardar: -25%)
Usuario quiere ganancias semanales. 25 combinaciones +X/-Y (1 a 5%):
- Regla sin movimiento +30%; +3/-3 (la activada) +36% (1a mitad +12%, 2a +21%), ~32 operaciones al año. Se queda.
- Más chicos (+1%, +1.5%) ganan menos (+10% a +26%): más comisiones y recompra en bajadas. +2/-3 dio +48% pero sus vecinos +15%: suerte, no se usa.
- Semanas con ganancia: solo 9% a 19% en todas, porque el bot está en USDT la mayor parte de un año de bajada (eso lo protege).
  Ninguna regla da ganancia todas las semanas.
- swingbnb.js: lo mismo medido en cantidad de BNB (lo que el usuario quiere que crezca; meta: ganarle al 7% anual de Earn).
  +3/-3 último año: BNB +82% (sin movimiento +74%); semanas con más BNB 53%, con menos 45%. 2a mitad (BNB subiendo): -3.6% BNB.

## btcreglas.js (2026-10-12): el usuario cambia a Bitcoin; barrido de reglas para BTC
Miedo/codicia 45-65 / 20-35, EMAs 10/30, 20/50, 30/100, 50/200, movimiento 0/3/5/8%. Periodos 2018-22, 2023-24, 2025-hoy, último año.
- 55/25 EMA20/50 sigue entre las mejores. Con movimiento 3%: 2025-hoy +48% (sin movimiento +28%), último año +14% (+9%), guardar -27%;
  en la subida fuerte 2023-24 gana menos (+68% vs +134%, guardar +466%). Mejor de todas en el peor periodo junto con 65/25. Se queda igual.
- Medido en cantidad de BTC, último año +56%.

## Venta con seguimiento (movimientoStop) — 2026-10-12
`trailing.js`: en modo movimiento, al llegar a +3% ya no vende de inmediato; sigue al precio y vende cuando baja 1% desde el máximo.
Último año, datos de 1 minuto, resultado en cantidad de moneda:
- BTC: +43.5% sin seguimiento → +61.4% con seguimiento de 1% (2º semestre −11.6% → −0.6%). 0.5% da +56.8%, 2% da +47.7%.
- BNB: +82.0% → +93.2%. ETH: +55.5% → +60.1%. SOL: +102.6% → +96.8% (un poco peor).
Se activa con `"movimientoStop": 1` en ajustes.json.

## Idea de Grok: vender solo una parte / no recomprar más caro — 2026-10-12
`parcial.js` (base +3% con seguimiento 1%, recompra −3%). Último año, cantidad de moneda:
- BTC: vender 100% +61.4% · 75% +58.2% · 50% +55.0% · 30% +52.5%. Con "nunca recomprar arriba": 37–45%. Con recompra +6%: 40–46%.
- BNB y ETH: igual, vender todo con recompra −3/+3 gana (BNB 93.2%, ETH 60.1%).
Conclusión: se queda como está (vende todo, recompra −3% o +3%).

## Movimientos más chicos para operar más seguido — 2026-10-12
`diario.js`: movimiento +1/+1.5/+2% con seguimiento 0.3/0.5% y recompra −1/−1.5/−2%. Último año, cantidad de moneda:
- BTC: actual (+3 stop1 −3/+3) +61.4%; las 18 variantes chicas dan +38% a +53% y el 2º semestre entre −1.4% y −11%.
- BNB: actual +93.2% vs 53–70%. ETH: actual +60.1%, solo +1 stop0.3 −2/+1 da 68.8% (126 op/año), pero falla en BTC y BNB.
Las comisiones y el ruido se comen las ganancias. Se queda +3%.

## Reserva de USDT para comprar en bajadas — 2026-10-13
`reserva.js`: comprar ya vs. esperar a que baje 2/3/5% (máx. 3/7/14 días, si no, compra igual). BTC extra promedio:
2018-22 entre −0.3% y +0.1%; 2023-hoy entre −0.8% y −0.2%; último año +0.1% a +0.4%. Esperar gana 50–85% de las veces
pero pierde más cuando BTC sube sin parar. En promedio da lo mismo: no se agrega. Mejor que el usuario compre BTC directo.

## Operaciones semanales (petición del usuario) — 2026-10-13
`semanal.js` (400 combinaciones con ≥40 op/año) y `semchk.js` (candidatas en 4 monedas). Nuevo: `movimientoSube` = % para
recomprar si sigue subiendo (antes era igual a `movimiento`). Elegida: +1.2% con seguimiento 0.3%, recompra −2% o +2.4%.
- BTC último año: +66.9% BTC (51 op/año ≈ 1 por semana), mitades +66.9% / 0.0%. Antes (+3/stop1/−3/+3): +61.4%, 17 op, mitades +62.4% / −0.6%.
- ETH 63.9% (antes 60.1), SOL 92.6% (96.8), BNB 63.7% (93.2: en BNB el +3% es mejor).
- Ojo: los vecinos varían mucho (stop 0.5% da 55.9% en BTC; stop 0.7% da 69.1%), así que parte es suerte de este año. Revisar seguido.
