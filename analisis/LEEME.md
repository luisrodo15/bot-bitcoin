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
