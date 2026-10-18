#!/usr/bin/env bash
# ==============================================================================
# ChatFlow Universal Cloud VPS One-Click Setup Script
# Works on: Ubuntu 22.04 LTS / Ubuntu 24.04 LTS
# Compatible with: DigitalOcean, Hetzner, Linode, AWS EC2, GCP, Oracle Cloud, etc.
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}        ChatFlow Backend & Coturn Universal Cloud Setup         ${NC}"
echo -e "${CYAN}================================================================${NC}"

# Check for root / sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run this script as root or with sudo:${NC}"
  echo "  sudo bash $0"
  exit 1
fi

# Detect Current User
ACTUAL_USER="${SUDO_USER:-$(whoami)}"
if [ "$ACTUAL_USER" = "root" ]; then
  # Fallback to creating or using a dedicated app user if desired
  ACTUAL_USER="ubuntu"
  if ! id -u "$ACTUAL_USER" >/dev/null 2>&1; then
    useradd -m -s /bin/bash "$ACTUAL_USER"
  fi
fi

# Gather Configuration Variables interactively if not set in environment
DOMAIN="${CHATFLOW_DOMAIN:-}"
if [ -z "$DOMAIN" ]; then
  read -rp "Enter your DuckDNS or Custom Domain (e.g. chatflow-arjun.duckdns.org): " DOMAIN
fi

DUCKDNS_TOKEN="${DUCKDNS_TOKEN:-}"
if [ -z "$DUCKDNS_TOKEN" ]; then
  read -rp "Enter DuckDNS Token (leave blank if using custom domain): " DUCKDNS_TOKEN
fi

TURN_SECRET="${CHATFLOW_TURN_SECRET:-}"
if [ -z "$TURN_SECRET" ]; then
  DEFAULT_SECRET="$(openssl rand -hex 16)"
  read -rp "Enter Coturn TURN Shared Secret [Default: $DEFAULT_SECRET]: " INPUT_SECRET
  TURN_SECRET="${INPUT_SECRET:-$DEFAULT_SECRET}"
fi

echo -e "\n${YELLOW}Detecting Server Public and Private IPs...${NC}"
PUBLIC_IP="$(curl -s --max-time 5 https://api.ipify.org || curl -s --max-time 5 https://ifconfig.me || echo '')"
PRIVATE_IP="$(hostname -I | awk '{print $1}')"

if [ -z "$PUBLIC_IP" ]; then
  read -rp "Could not detect Public IP. Enter server Public IPv4: " PUBLIC_IP
fi

echo -e "  Public IP:  ${GREEN}${PUBLIC_IP}${NC}"
echo -e "  Private IP: ${GREEN}${PRIVATE_IP}${NC}"
echo -e "  Domain:     ${GREEN}${DOMAIN}${NC}"

echo -e "\n${YELLOW}[Step 1/8] Updating package repository and installing dependencies...${NC}"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  curl \
  wget \
  git \
  coturn \
  debian-keyring \
  debian-archive-keyring \
  apt-transport-https \
  ufw \
  jq \
  unzip \
  build-essential

echo -e "\n${YELLOW}[Step 2/8] Installing Node.js 20 LTS and pnpm...${NC}"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

corepack enable || true
npm install -g pnpm@9

echo -e "  Node version: $(node -v)"
echo -e "  pnpm version: $(pnpm -v)"

echo -e "\n${YELLOW}[Step 3/8] Configuring UFW Firewall Ports...${NC}"
ufw allow 22/tcp comment 'SSH Administration' || true
ufw allow 80/tcp comment 'HTTP SSL Challenge' || true
ufw allow 443/tcp comment 'HTTPS API & WebSockets' || true
ufw allow 3478/tcp comment 'Coturn STUN/TURN TCP' || true
ufw allow 3478/udp comment 'Coturn STUN/TURN UDP' || true
ufw allow 49152:65535/udp comment 'Coturn Media Relay Range' || true
ufw --force enable || true

echo -e "\n${YELLOW}[Step 4/8] Installing Caddy Web Server (Automatic Free HTTPS)...${NC}"
if ! command -v caddy >/dev/null 2>&1; then
  curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
  curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
fi

cat <<CADDY > /etc/caddy/Caddyfile
${DOMAIN} {
    reverse_proxy 127.0.0.1:4000
}
CADDY

systemctl restart caddy

echo -e "\n${YELLOW}[Step 5/8] Configuring Coturn WebRTC Relay...${NC}"
mkdir -p /etc
cat <<COTURN > /etc/turnserver.conf
listening-port=3478
listening-ip=0.0.0.0
min-port=49152
max-port=65535
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=${TURN_SECRET}
realm=${DOMAIN}
external-ip=${PUBLIC_IP}/${PRIVATE_IP}
no-cli
no-tls
no-dtls
verbose
COTURN

chown root:turnserver /etc/turnserver.conf || true
chmod 640 /etc/turnserver.conf || true
systemctl restart coturn
systemctl enable coturn

echo -e "\n${YELLOW}[Step 6/8] Deploying ChatFlow Repository...${NC}"
INSTALL_DIR="/opt/chatflow"
if [ ! -d "$INSTALL_DIR/.git" ]; then
  git clone https://github.com/Arjunrayhod/ChatFlow-Messager.git "$INSTALL_DIR"
else
  git -C "$INSTALL_DIR" pull origin codex/apk-sdk-fix-main || git -C "$INSTALL_DIR" pull origin main || true
fi

chown -R "${ACTUAL_USER}:${ACTUAL_USER}" "$INSTALL_DIR"

# Build project as actual user
su - "$ACTUAL_USER" -c "cd $INSTALL_DIR && pnpm install --no-frozen-lockfile && pnpm --filter @chatflow/shared build && pnpm --filter @chatflow/server build"

echo -e "\n${YELLOW}[Step 7/8] Creating Production Environment Configuration...${NC}"
mkdir -p /etc/chatflow
ENV_FILE="/etc/chatflow/chatflow.env"

if [ ! -f "$ENV_FILE" ]; then
  cat <<ENV > "$ENV_FILE"
NODE_ENV=production
PORT=4000
CORS_ORIGIN=*
TURN_HOST=${DOMAIN}
TURN_SHARED_SECRET=${TURN_SECRET}
TURN_UDP_PORT=3478
TURN_TCP_PORT=3478
TURN_TTL_SECONDS=3600

# Firebase Admin SDK Configuration (Fill with your credentials)
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Supabase Configuration (Fill with your credentials)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ENV
fi

chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"

cat <<SERVICE > /etc/systemd/system/chatflow-api.service
[Unit]
Description=ChatFlow API and Socket.IO
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${ACTUAL_USER}
WorkingDirectory=${INSTALL_DIR}
EnvironmentFile=/etc/chatflow/chatflow.env
ExecStart=$(command -v node) ${INSTALL_DIR}/apps/server/dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable chatflow-api
systemctl restart chatflow-api || true

echo -e "\n${YELLOW}[Step 8/8] Setting up Automatic IP & DuckDNS Sync...${NC}"
cat <<'SCRIPT' > /usr/local/bin/update-ip.sh
#!/usr/bin/env bash
set -e

DOMAIN_FILE="/etc/chatflow/domain.info"
[ -f "$DOMAIN_FILE" ] && source "$DOMAIN_FILE"

if [ -z "${DOMAIN:-}" ]; then
  exit 0
fi

PUB_IP="$(curl -s --max-time 5 https://api.ipify.org || curl -s --max-time 5 https://ifconfig.me || echo '')"
[ -z "$PUB_IP" ] && exit 0
PRIV_IP="$(hostname -I | awk '{print $1}')"

# 1. Sync DuckDNS if token is configured
if [ -n "${DUCKDNS_TOKEN:-}" ]; then
  DUCK_SUBDOMAIN="$(echo "$DOMAIN" | cut -d'.' -f1)"
  curl -s --max-time 10 "https://www.duckdns.org/update?domains=${DUCK_SUBDOMAIN}&token=${DUCKDNS_TOKEN}&ip=" > /dev/null || true
fi

# 2. Update Coturn external-ip if changed
if [ -f /etc/turnserver.conf ]; then
  CURRENT_MAPPING="$(grep '^external-ip=' /etc/turnserver.conf | cut -d'=' -f2 || true)"
  DESIRED_MAPPING="${PUB_IP}/${PRIV_IP}"
  if [ "$CURRENT_MAPPING" != "$DESIRED_MAPPING" ]; then
    sed -i '/^external-ip=/d' /etc/turnserver.conf
    echo "external-ip=${DESIRED_MAPPING}" >> /etc/turnserver.conf
    systemctl restart coturn
    echo "[$(date)] Updated Coturn external-ip to ${DESIRED_MAPPING}"
  fi
fi
SCRIPT

mkdir -p /etc/chatflow
cat <<INFO > /etc/chatflow/domain.info
DOMAIN="${DOMAIN}"
DUCKDNS_TOKEN="${DUCKDNS_TOKEN}"
INFO

chmod +x /usr/local/bin/update-ip.sh
/usr/local/bin/update-ip.sh || true

cat <<'CRON' > /etc/cron.d/chatflow-ip-sync
*/5 * * * * root /usr/local/bin/update-ip.sh > /dev/null 2>&1
CRON
chmod 644 /etc/cron.d/chatflow-ip-sync

echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}       🎉 ChatFlow Cloud VPS Installation Complete!             ${NC}"
echo -e "${GREEN}================================================================${NC}"
echo -e "API Endpoint:       ${CYAN}https://${DOMAIN}/health${NC}"
echo -e "Coturn Server:      ${CYAN}${DOMAIN}:3478 (UDP/TCP)${NC}"
echo -e "TURN Secret:        ${CYAN}${TURN_SECRET}${NC}"
echo -e "Environment File:   ${CYAN}/etc/chatflow/chatflow.env${NC}"
echo -e ""
echo -e "${YELLOW}Important Next Steps:${NC}"
echo -e "1. Edit ${CYAN}/etc/chatflow/chatflow.env${NC} with your Firebase & Supabase keys:"
echo -e "   sudo nano /etc/chatflow/chatflow.env"
echo -e "2. Restart API after editing credentials:"
echo -e "   sudo systemctl restart chatflow-api"
echo -e "3. Verify status with:"
echo -e "   sudo systemctl status chatflow-api caddy coturn --no-pager"
