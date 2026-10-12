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
