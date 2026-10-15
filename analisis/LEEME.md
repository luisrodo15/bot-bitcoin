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

## chatgptspot.js (2026-10-13)
Estrategia de ChatGPT: 4h EMA50>EMA200, 1h precio>EMA200, rebote en EMA20 de 1h, TP +1.5% / SL -0.8%, una operación a la vez.
BTC último año (precio -26.5%): USDT -30.1%, cantidad de BTC -4.8%, 107 ops (29 ganadas, 78 perdidas), 58% de semanas con menos BTC.
Variantes (TP 1.2-2%, SL 0.8-1.5%) entre -6% y +1.3% de BTC. Muy por debajo de la del bot (+67% BTC). No se usa.

## semsl.js y stop8.js solo BTC (2026-10-13): "stop loss siempre" (idea de Grok)
Stop fijo desde la compra sobre el modo semanal actual (+1.2/stop 0.3/-2/+2.4), BTC último año, cantidad de BTC:
sin stop +66.9% | 1% +25.6% | 2% +52.9% | 3% +60.7% | 5% +62.6% | 8% +69.2% (solo 1 stop, suerte).
stop8.js (stop móvil sobre la regla diaria desde 2018, BTC): sin stop 2018-22 +777%, 2023-hoy +196%; con cualquier stop 5-25% peor en ambos periodos.
"Riesgo 1% por operación" con ~7 USDT = menos de 5 USDT por orden: Binance no lo permite. No se cambia: la salida por EMA20<EMA50 o miedo<=25 ya es el stop.

## sem4h.js (2026-10-13): tendencia en velas de 4 horas en vez de diaria
Mismo modo semanal, BTC último año, cantidad de BTC: diaria EMA20/50 (actual) +66.9% | 4h EMA20/50 +41.4% (2a mitad -9.3%) | 4h EMA50/200 +56.0% | 4h EMA30/90 +34.2% (2a mitad -11.2%) | 4h EMA120/300 (= diaria) +66.9%.
4h da señales falsas que voltean seguido. Se queda la diaria.

## semdia.js (2026-10-13): "mínimo una operación por día"
Movimientos muy chicos (+0.3 a +0.8%, stop 0.1-0.2%, recompra -0.3 a -1%), BTC último año: el mejor +50.0% BTC con 71 ops/año (2a mitad -6.7%); actual +66.9% con 51.
Ni con +0.3% se llega a 365 ops/año porque la regla de tendencia deja al bot fuera muchos días. Más operaciones = menos BTC. No se cambia.

## sem3.js (2026-10-13): "al menos 3 por semana" (~150 ops/año)
Solo 3 combinaciones llegan a 140+ ops/año, todas +0.3% con seguimiento 0.2%: BTC +39.5% a +39.9% (2a mitad -9% a -10%), USDT +2.7%; 47-51% de semanas con menos BTC.
Su venta mínima (+0.1%) queda por debajo de las comisiones (0.15% ida y vuelta). Actual: +66.9%. No se cambia sin que el usuario lo pida.

## Ojo: "ops/año" cuenta compras Y ventas (2026-10-13)
Actual 51 ops/año ≈ 25 ventas con ganancia al año ≈ 1 cada 2 semanas. Lo más seguido (+0.3%, 149-162 ops) ≈ 75-80 ventas ≈ 1.5 por semana, con BTC +40%.
2 ganancias por semana (~100 ventas) no se alcanza con ninguna combinación probada. Sin el filtro de tendencia el bot se queda atorado en bajadas: menos ops y BTC -4% a +2%.

## ideas.js + tiempo.js (2026-10-13): semanas con al menos una venta ganadora
- tiempo.js: el último año la regla de tendencia solo estuvo "dentro" 62 de 376 días (16%): 3-13 oct 2025 y desde 21 ago 2026. Fuera, el bot está en USDT y no vende; por eso solo 15% de semanas del año tuvieron venta.
- Desde 21-ago-2026 (tendencia buena): actual +1.2% -> 22 ventas, todas ganadoras, venta en 6 de 7 semanas. +0.6% -> 4 de 7. +0.3% -> 57 de 66 ganadoras, 4 de 7.
- Dividir en lotes (20-50% con meta chica +0.3/0.5/0.6, resto actual): BTC +50% a +63% (peor que +66.9%) y no sube las semanas con venta (15-17%).
Conclusión: con tendencia buena la configuración actual ya da venta casi cada semana; en tendencia mala, operar pierde. No se cambia.

## grid.js (2026-10-13): combinación que da venta ganadora en MÁS semanas con tendencia buena
375 combinaciones (+0.6 a +1.5, stop 0.1-0.5, recompra -0.5 a -2.5, sube x0.5/1/2). Último año hubo 9 semanas con tendencia buena.
Ninguna da 9/9; el máximo es 8/9 y la actual (+1.2/0.3/-2/+2.4) ya lo logra con BTC +66.9%. +1.5/0.4/-2.5/+3 da 8/9 y +68.1% (diferencia de ruido). No se cambia.

## grid.js, recompra de arriba (2026-10-13)
Con -2% abajo y distintas recompras arriba, BTC último año: +2.4% (actual) +66.9%, 25 ventas | +3% +41.5% | +4% +57.5% | +5% +50.0% | sin recompra arriba +38.3%, 4 ventas. Se queda +2.4%.

## atr.js, meta según volatilidad (2026-10-13)
Meta, stop y recompra como fracción del ATR14 diario (ATR medio BTC 3.45%). 24 combinaciones.
La mejor (meta 0.5×ATR, stop 0.15×ATR, recompra -0.7×ATR) da +67.8% BTC pero 36 ops/año contra 51 de la actual (+66.9%), y sus vecinas caen a +55% o menos. No es robusta y da menos ventas. No se cambia.
Repetición semanal.js/semchk.js con datos al 13-oct: la actual sigue entre las mejores (+66.9%, 1a mitad +68.1%, 2a mitad -0.7%).

## soporte.js, video "Spot Trading sin riesgo" (2026-10-13)
Del video (gráficas y su hoja de operaciones): compra con orden límite en soporte, vende en resistencia +3% a +9%, sin stop, 1h/4h con EMAs, RSI y volumen. Clon: compra cuando la vela de 1h toca el mínimo de los últimos 3/7/14 días, vende a +2/3/5/8%, nunca en pérdida, con y sin filtro del bot. (Los datos de 1 minuto no traen volumen, así que la confirmación de volumen no hizo nada.)
Último año BTC: la mejor da +3% de BTC y -31% en USDT. Compró en el primer soporte y se quedó atorada hasta 368 días sin vender (0-1 ventas en la 1a mitad). En la 2a mitad (subida) hace 3-11 ventas pero queda entre -1% y +3% de BTC. El bot actual da +66.9% de BTC con ~25 ventas. No se adopta.

## soporte4h.js, video mejorado en 4h (2026-10-13, lo pidió el usuario)
Soporte = mínimo de las últimas 6/12/30/60 velas de 4h, compra límite ahí, vende +1.2/2/3/5%, stop 0/1/2/4% bajo el soporte, con y sin filtro del bot (128 combinaciones).
Mejor con filtro: +48.9% de BTC pero solo 3 ventas al año. Con 20 o más ventas al año el máximo es +15.8%: la mitad de las salidas son stops con pérdida, y la 2a mitad sale en -11%. Sin stop se queda atorada (0 ventas en la 1a mitad). Ninguna combinación gana en la 2a mitad, donde todas salen negativas salvo +5.5% con 15 ventas (esa misma pierde -7.6% en la 1a). Bot actual: +66.9%, 51 ops. No se adopta.

## soportemes.js, soporte/resistencia del último mes + entrada en 4h (2026-10-13)
Como en el video (Bybit 1 mes + TradingView 4h): soporte = mínimo de 15/30 días, vende en la resistencia (máximo del mes) o +3/5/8%, stops 0-4%, con y sin filtro.
Toca el soporte del mes muy pocas veces: 0-3 ventas al año. Mejor +48.9% de BTC (con filtro, 1 venta), y la 2a mitad negativa en todas (-7% a -16%). Con 20+ ventas: +11.7%, 44 stops. No se adopta.

## cuatroh.js, búsqueda amplia en velas de 4h (2026-10-13, lo pidió el usuario)
Dentro de la regla del bot, vender/recomprar con señales de 4h: RSI (alto 65/70/75, bajo 35-50), Bollinger (k 1.5/2, recompra en banda baja o media), cierre bajo/sobre EMA 9/20/50; ganancia mínima 0.5/1.2/2%, recompra arriba 0/3%. 159 combinaciones.
Mejor: Bollinger k2 recompra en la media, +62.7% de BTC con 5 ventas (2a mitad -3.5%). Ninguna llega a 20 ventas al año. Solo la regla sin 4h: +57.7%. Bot actual (minuto, +1.2%/0.3%/-2%/+2.4%): +66.9%, ~25 ventas. 4h decide muy lento para ventas cortas. No se adopta.

## hibrido4h.js, bot actual + RSI de 4h (2026-10-13)
Al bot actual se le suma: vende si RSI 4h >= A con ganancia >= m, y/o recompra antes si RSI 4h <= B bajo el precio de venta.
RSI 67-71 con m 0.3-0.5% da +74.4% de BTC (2a mitad +3.8%) contra +66.9%, con las mismas 51 ops: es UNA sola venta distinta que cambió el camino. RSI 65 o 72-75 caen a +56.9%, y m >= 0.8% queda igual que el actual. La recompra por RSI no ayuda (45 baja a +52.6%). Frágil, no se adopta; vigilar en la revisión diaria.

## Mismo modo semanal en otras monedas, en dólares (2026-10-13)
+1.2/0.3/-2/+2.4 con la regla del bot, último año, ganancia en USDT (año / 1a mitad / 2a mitad, ops):
BTC +19.8% / +0.7% / +18.9%, 51 ops · BNB +19.0% / +4.7% / +13.7%, 67 ops · XRP +3.7%, 42 ops · SOL -2.4%, 49 ops · ETH -3.3%, 47 ops.
Solo comprar y guardar: BTC -28%, BNB -27%, ETH -41%, SOL -49%, XRP -53%.
BTC sigue siendo el mejor. BNB gana casi igual en dólares con más operaciones (posible segunda moneda para tener más ventas). ETH, que es la moneda del video, sale peor.

## freno.js, no aguantar la caída después de recomprar (2026-10-13, lo pidió el usuario)
a) Recompra "con rebote": tras -2% no compra de inmediato, sigue el mínimo y compra al rebotar 0.2-1.5%. b) Stop 2/3/5% solo después de una recompra de abajo. c) Ambos.
BTC último año: actual +66.9% | rebote 0.3% +65.1% | rebote 0.5% +48.5% | rebote 1% +52.5% | stop 2% +51.0% | stop 3% +41.4% | stop 5% +64.3% | rebote 0.5% + stop 3% +59.3% (2a mitad -15%).
Todas pierden: las bajadas de -2% casi siempre rebotan, y el stop vende en el piso. No se cambia; la salida por tendencia/miedo sigue siendo el freno.

## brusco.js, movimientos bruscos de 1 hora (revisión diaria 2026-10-14)
Sobre el modo actual: recompra inmediata si cae 1-2.5% en 60 min (bajo la venta) y/o venta inmediata si sube 1-2% en 60 min con ganancia >= 0.5-0.8%.
BTC último año: actual +66.9% (1a mitad +59.7%, 2a mitad +4.5%) | caída 2% +58.5% | caída 1% +49.3% | pico 1.5% +53.0% | ambos +43.8%. Todas peor y con menos ventas. No se cambia.
Repetición: actual sigue entre las mejores; hibrido4h (RSI 4h 67-71) sigue dando +74.4%, pero sus vecinos dan +56.9% (frágil, no se activa).

## 2026-10-15: futuros (pedido del usuario)
- futuros.js re-corrido: corto 1x cuando la tendencia es de bajada solo gana en años de bajada (BTC último año +23% vs +8% spot; 2023-hoy +5% vs +194%; 2020-22 +73% vs +296%).
- Cobro de funding (BTC spot + corto 1x igual): último año +3.4% sobre lo cubierto (2024 12%, 2025 5%, 2026 2.2%), meses negativos feb-abr 2026; necesita el doble de capital y congela el BTC. No conviene.
- cortoespera.js: el bot actual + corto 1x en futuros SOLO mientras espera recomprar (abre al vender, cierra al recomprar a −2% o +2.4%, o si sale la tendencia). Comisión futuros 0.05%/lado, sin funding. En BTC: +87.7% vs +66.9% (mitades +69.0/+11.1 vs +59.7/+4.5). Mejora en 9 de 9 configuraciones vecinas. Solo 1 año de datos de minuto. Bloqueos: mínimo de orden en futuros (~100 USDT en BTC, por confirmar), llave solo spot.
- Revisión diaria 2026-10-15: datos nuevos, semchk BTC actual +66.9% (mitades +60.3/+4.1), cortoespera +87.7% (+69.6/+10.7). Sin cambios. Mínimo futuros BTCUSDT: 0.001 BTC (~82 USDT) y nocional ~50 USDT según finantres.mx; falta confirmarlo en Binance. Noticias: inflación de EUA alta, posibilidad de que la Fed suba tasas, BTC bajo 81k; nada grave para alerta.
- espejo.js (2026-10-15, pedido: mejor estrategia de BTC en futuros). En cantidad de BTC, año / 1a / 2a mitad: bot actual +66.9/+60.3/+4.1; + corto esperando +87.7/+69.6/+10.7 (la mejor y constante); bot al revés (corto) en tendencia de bajada +24.0/+55.3/−17.6 y vecinos mezclados (pierde en 2a mitad); largo 2x +103/+61.8/+25.6 pero en datos diarios 2018-hoy 2x-3x trae liquidaciones y caídas de 66-86% (futuros.js). Candidata: solo corto 1x mientras espera recomprar.
