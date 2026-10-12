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
