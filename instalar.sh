#!/bin/bash
# Instala Bot Cripto (simulación) como servicio 24/7 que se actualiza solo desde GitHub.
# Uso en el servidor (una sola vez):  curl -fsSL https://raw.githubusercontent.com/luisrodo15/bot-bitcoin/main/instalar.sh | bash
set -e
REPO="${REPO:-https://github.com/luisrodo15/bot-bitcoin.git}"
DIR="$HOME/bot-bitcoin"

# Servidores de 1 GB (Siempre gratis): agregar 1 GB de memoria de intercambio para instalar sin problemas.
if [ "$(awk '/MemTotal/{print $2}' /proc/meminfo)" -lt 1500000 ] && ! swapon --show | grep -q .; then
  sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null && sudo swapon /swapfile
  echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab >/dev/null
fi
sudo apt-get update -qq && sudo apt-get install -y -qq git curl >/dev/null
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  echo "Instalando Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
  sudo apt-get install -y -qq nodejs >/dev/null
fi
if [ -d "$DIR/.git" ]; then git -C "$DIR" pull --ff-only --quiet; else git clone --quiet "$REPO" "$DIR"; fi

sudo tee /etc/systemd/system/bot-bitcoin.service >/dev/null <<UNIT
[Unit]
Description=Bot Cripto (simulacion)
After=network-online.target
Wants=network-online.target

[Service]
WorkingDirectory=$DIR
ExecStart=$(command -v node) $DIR/servidor.js
Restart=always
RestartSec=5
User=$(whoami)

[Install]
WantedBy=multi-user.target
UNIT

# Abrir el puerto del panel en el firewall del servidor (Oracle usa iptables).
if command -v iptables >/dev/null && ! sudo iptables -C INPUT -p tcp --dport 8080 -j ACCEPT 2>/dev/null; then
  sudo iptables -I INPUT 1 -p tcp --dport 8080 -j ACCEPT
  command -v netfilter-persistent >/dev/null && sudo netfilter-persistent save >/dev/null 2>&1 || true
fi

sudo systemctl daemon-reload
sudo systemctl enable --now bot-bitcoin >/dev/null 2>&1
sudo systemctl restart bot-bitcoin
sleep 3
CLAVE=$(cd "$DIR" && node -p 'require("./config.json").clavePanel')
IP=$(curl -s --max-time 5 https://ifconfig.me || echo IP-DEL-SERVIDOR)
echo
echo "============================================================"
echo " Listo. Bot Cripto funcionando 24/7 en modo simulación."
echo " Se actualiza solo. Abre esto en tu celular y guárdalo:"
echo "   http://$IP:8080/?clave=$CLAVE"
echo "============================================================"
