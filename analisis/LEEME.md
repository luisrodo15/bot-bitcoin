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
