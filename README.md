# Bot Cripto (simulación)

Bot que compra cuando el precio baja y vende cuando sube, 24/7, con dinero ficticio y precios reales de Binance.
Se ajusta solo cada 6 horas y se actualiza solo desde este repositorio.

Instalar en el servidor (una sola vez):

    curl -fsSL https://raw.githubusercontent.com/luisrodo15/bot-bitcoin/main/instalar.sh | bash

## Dinero real (apagado por defecto)

Se activa solo si se cumplen las dos cosas:
1. `ajustes.json` dice `"real": true` (se cambia en GitHub).
2. En el servidor hay una llave de Binance guardada con `poner-llave.sh` (solo trading Spot, **sin retiros**; si permite retiros el bot no la acepta).

    ssh -t -i LLAVE.key ubuntu@IP-DEL-SERVIDOR bash bot-bitcoin/poner-llave.sh

El bot solo opera MONEDA/USDT en Spot, revisa que haya USDT libre antes de comprar y solo vende lo que él compró.

## Estrategia "sentimiento" (la que usa ahora)

Compra cuando el índice de miedo y codicia (noticias y redes sociales) está en codicia (≥ 55) y la EMA de 20 días
está arriba de la de 50 días. Vende cuando el índice cae a miedo (≤ 30) o la EMA20 baja de la EMA50.
Pocas operaciones al año. Probado con precios diarios 2018-2026: en años de bajada pierde mucho menos que solo
guardar; en años de subida gana menos que solo guardar. Puede perder. Se elige con `"estrategia"` en `ajustes.json`
(`"lotes"` es la estrategia anterior de comprar en bajadas cortas).
