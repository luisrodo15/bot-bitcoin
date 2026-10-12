#!/bin/bash
# Guarda tu llave de Binance SOLO en este servidor (llave.json, nadie más puede leerla).
# Uso desde Oracle Cloud Shell:
#   ssh -t -i $(ls ~/*.key | head -1) ubuntu@IP-DEL-SERVIDOR bash bot-bitcoin/poner-llave.sh
set -e
cd "$(dirname "$0")"
echo
echo "Pega tu API Key de Binance y pulsa Enter (no se verá al pegarla):"
read -rs LLAVE_K; echo
echo "Pega tu Secret Key y pulsa Enter (no se verá al pegarla):"
read -rs LLAVE_S; echo
umask 077
LLAVE_K="$LLAVE_K" LLAVE_S="$LLAVE_S" node probar-llave.js
sudo systemctl restart bot-bitcoin
