# Análisis de estrategias

Datos (ramas de este repo, las llenan los workflows de GitHub Actions):
- `datos`: velas de 1 minuto, 12 meses, 7 monedas + USDT/MXN, USDC/MXN (`.github/workflows/datos.yml`)
- `diarios`: velas diarias desde 2018 + índice de miedo y codicia (`diarios.yml`)
- `ballenas`: métricas de futuros BTC (traders grandes, interés abierto) y financiación (`ballenas.yml`)

Uso: clonar la rama en una carpeta con su nombre junto a estos scripts, por ejemplo
`git clone -b diarios --depth 1 <repo> diarios`, y luego `node tecnico.js`, `node extras.js`.
