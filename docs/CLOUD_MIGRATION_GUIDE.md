# 🌐 ChatFlow Universal Cloud Migration & Hosting Guide
### (AWS se kisi bhi doosre Cloud / VPS par Host karne ki Complete Guide)

Yeh guide aapko ChatFlow backend, WebRTC Coturn relay, aur Caddy HTTPS SSL server ko **AWS se kisi bhi doosre Cloud Provider** (jaise DigitalOcean, Hetzner, Linode, Google Cloud, Oracle Cloud Free Tier, ya kisi bhi Ubuntu VPS) par asani se migrate aur host karne ke liye banayi gayi hai.

---

## 📑 Table of Contents
1. [Cloud Provider Options (Sabse Saste & Best Cloud Platforms)](#1-cloud-provider-options)
2. [Server Requirements & Firewall Ports](#2-server-requirements--firewall-ports)
3. [Method 1: 1-Click Automated Setup (Sabse Aasan Tarika)](#3-method-1-1-click-automated-setup)
4. [Method 2: Step-by-Step Manual Setup (Har Command Ek-Ek Karke)](#4-method-2-step-by-step-manual-setup)
   - [Step 1: System Update & Tools](#step-1-system-update--tools)
   - [Step 2: Node.js 20 LTS & pnpm 9](#step-2-nodejs-20-lts--pnpm-9)
   - [Step 3: UFW Firewall Security Ports](#step-3-ufw-firewall-security-ports)
   - [Step 4: Caddy Web Server (Free Auto SSL)](#step-4-caddy-web-server-free-auto-ssl)
   - [Step 5: Coturn STUN/TURN WebRTC Server](#step-5-coturn-stunturn-webrtc-server)
   - [Step 6: ChatFlow Codebase & Build](#step-6-chatflow-codebase--build)
   - [Step 7: Environment Variables & Secrets](#step-7-environment-variables--secrets)
   - [Step 8: Systemd Auto-Start Service](#step-8-systemd-auto-start-service)
   - [Step 9: Auto DuckDNS & IP Sync Script](#step-9-auto-duckdns--ip-sync-script)
5. [Verification & Testing (Kaise Check Karein Sab Chal Raha Hai)](#5-verification--testing)
6. [Daily Maintenance Commands (Cheat Sheet)](#6-daily-maintenance-commands)
7. [Troubleshooting & Common Regressions](#7-troubleshooting)

---

## 1. Cloud Provider Options

Aap kisi bhi provider par **Ubuntu 22.04 LTS ya Ubuntu 24.04 LTS** choose karein:

| Provider | Minimum Plan | Monthly Cost | Notes |
| :--- | :--- | :--- | :--- |
| **Oracle Cloud** | Ampere A1 (ARM 4 OCPU, 24GB RAM) | **₹0 (Forever Free)** | Best for lifetime free high-performance hosting |
| **Hetzner Cloud** | CX22 (2 vCPU, 4GB RAM) | **~€3.79 (~₹340/mo)** | Sabse sasta, fastest European/US network, ultra-reliable |
| **DigitalOcean** | Basic Droplet (1 vCPU, 1GB RAM) | **~$4 - $6 (~₹400/mo)** | Bangalore/India datacenter available, simple UI |
| **Linode / Akamai** | Nanode (1 vCPU, 1GB RAM) | **~$5 (~₹420/mo)** | Mumbai datacenter available, great networking |
| **Google Cloud (GCP)** | e2-micro (US Region) | **Free Tier Eligible** | 1GB RAM, free egress limits apply |

> [!TIP]
> **Recommendation:** Agar bilkul free chahiye toh **Oracle Cloud Always Free**, aur agar simple paid chahiye toh **Hetzner Cloud** ya **DigitalOcean (Bangalore)** best hai.

---

## 2. Server Requirements & Firewall Ports

### Hardware Sizing:
- **CPU:** 1 Core minimum (2 Cores recommended)
- **RAM:** 1 GB minimum (2 GB recommended taaki build ke waqt memory kam na pade)
- **OS:** Ubuntu 22.04 LTS ya 24.04 LTS (64-bit x86_64 ya ARM64)

### Inbound Ports (Cloud Provider Firewall / Security Group me Allow karein):
Aapko apne Cloud Dashboard (jaise DigitalOcean Firewalls, AWS Security Groups, ya Oracle Security Lists) me ye ports open karne honge:

| Protocol | Port / Range | Source | Purpose |
| :--- | :--- | :--- | :--- |
| **TCP** | `22` | `0.0.0.0/0` (ya Aapka IP) | SSH Terminal Login |
| **TCP** | `80` | `0.0.0.0/0` | HTTP Let's Encrypt SSL Challenge |
| **TCP** | `443` | `0.0.0.0/0` | HTTPS Secure API, Socket.IO, & WebRTC signaling |
| **UDP** | `3478` | `0.0.0.0/0` | Coturn STUN/TURN Voice & Video calls |
| **TCP** | `3478` | `0.0.0.0/0` | Coturn STUN/TURN TCP fallback |
| **UDP** | `49152 - 65535` | `0.0.0.0/0` | WebRTC Media Audio/Video UDP stream range |

---

## 3. Method 1: 1-Click Automated Setup

Humne project me ek ready-to-run bash script create kiya hai (`scripts/setup-vps.sh`).

Aap apne naye Ubuntu server par login karein aur sirf yeh command run karein:

```bash
curl -fsSL https://raw.githubusercontent.com/Arjunrayhod/ChatFlow-Messager/codex/apk-sdk-fix-main/scripts/setup-vps.sh | sudo bash
```

Yeh script automatically:
1. System packages update karega.
2. Node.js 20 LTS aur pnpm 9 install karega.
3. UFW Firewall secure configure karega.
4. Caddy Web Server install karke free HTTPS domain link karega.
5. Coturn STUN/TURN server ko public IP mapping ke sath setup karega.
6. ChatFlow repo clone aur build karega.
7. Systemd background services (`chatflow-api`, `caddy`, `coturn`) enable karega.
8. Dynamic DNS auto-sync cron job set karega.

Setup ke baad sirf credentials configure karne honge:
```bash
sudo nano /etc/chatflow/chatflow.env
sudo systemctl restart chatflow-api
```

---

## 4. Method 2: Step-by-Step Manual Setup

Agar aap har command ko manually run karke samajhna chahte hain, toh neeche diye gaye steps follow karein:

### Step 1: System Update & Tools
```bash
sudo apt-get update -y && sudo apt-get upgrade -y
sudo apt-get install -y curl wget git ufw jq unzip build-essential debian-keyring debian-archive-keyring apt-transport-https
```

### Step 2: Node.js 20 LTS & pnpm 9
```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs

# pnpm v9
sudo npm install -g pnpm@9

# Verify
node -v
pnpm -v
```

### Step 3: UFW Firewall Security Ports
```bash
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP SSL Challenge'
sudo ufw allow 443/tcp comment 'HTTPS API & Socket'
sudo ufw allow 3478/tcp comment 'Coturn TCP'
sudo ufw allow 3478/udp comment 'Coturn UDP'
sudo ufw allow 49152:65535/udp comment 'WebRTC Media Relay'
sudo ufw --force enable
sudo ufw status verbose
```

### Step 4: Caddy Web Server (Free Auto SSL)
Caddy automatically Let's Encrypt SSL certificate leta hai aur reverse proxy karta hai port 4000 par:
```bash
# Install Caddy
curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update -y
sudo apt-get install -y caddy

# Configure Caddy (Apna domain dalein)
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
chatflow-arjun.duckdns.org {
    reverse_proxy 127.0.0.1:4000
}
EOF

sudo systemctl restart caddy
sudo systemctl enable caddy
```

### Step 5: Coturn STUN/TURN WebRTC Server
```bash
# Install Coturn
sudo apt-get install -y coturn

# Detect Server Public & Private IPs
PUBLIC_IP=$(curl -s https://api.ipify.org)
PRIVATE_IP=$(hostname -I | awk '{print $1}')
echo "Public IP: $PUBLIC_IP | Private IP: $PRIVATE_IP"

# Configure /etc/turnserver.conf
sudo tee /etc/turnserver.conf > /dev/null <<EOF
listening-port=3478
listening-ip=0.0.0.0
min-port=49152
max-port=65535
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=4e9669527e05fc86dcf3f2256d0f7300
realm=chatflow-arjun.duckdns.org
external-ip=${PUBLIC_IP}/${PRIVATE_IP}
no-cli
no-tls
no-dtls
verbose
EOF

# Correct Permissions
sudo chown root:turnserver /etc/turnserver.conf
sudo chmod 640 /etc/turnserver.conf

sudo systemctl restart coturn
sudo systemctl enable coturn
```

### Step 6: ChatFlow Codebase & Build
```bash
# Clone repository
sudo mkdir -p /opt/chatflow
sudo chown -R $USER:$USER /opt/chatflow
git clone https://github.com/Arjunrayhod/ChatFlow-Messager.git /opt/chatflow

cd /opt/chatflow
git checkout codex/apk-sdk-fix-main

# Install dependencies and build shared + server
pnpm install --no-frozen-lockfile
pnpm --filter @chatflow/shared build
pnpm --filter @chatflow/server build
```

### Step 7: Environment Variables & Secrets
```bash
sudo install -d -o root -g root -m 700 /etc/chatflow
sudo nano /etc/chatflow/chatflow.env
```

Paste these contents (Replace placeholders with your real Firebase & Supabase values):
```ini
NODE_ENV=production
PORT=4000
CORS_ORIGIN=*
TURN_HOST=chatflow-arjun.duckdns.org
TURN_SHARED_SECRET=4e9669527e05fc86dcf3f2256d0f7300
TURN_UDP_PORT=3478
TURN_TCP_PORT=3478
TURN_TTL_SECONDS=3600

# Firebase Admin SDK credentials
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=your-firebase-client-email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Supabase database & storage credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

Secure the file permissions:
```bash
sudo chown root:root /etc/chatflow/chatflow.env
sudo chmod 600 /etc/chatflow/chatflow.env
```

### Step 8: Systemd Auto-Start Service
Create `/etc/systemd/system/chatflow-api.service`:
```bash
sudo tee /etc/systemd/system/chatflow-api.service > /dev/null <<EOF
[Unit]
Description=ChatFlow API and Socket.IO
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=/opt/chatflow
EnvironmentFile=/etc/chatflow/chatflow.env
ExecStart=$(which node) /opt/chatflow/apps/server/dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now chatflow-api
sudo systemctl status chatflow-api --no-pager
```

### Step 9: Auto DuckDNS & IP Sync Script
Agar server reboot ho ya dynamic IP change ho, yeh script automatically DuckDNS aur Coturn ko sync kar deta hai:

```bash
sudo tee /usr/local/bin/update-ip.sh > /dev/null <<'EOF'
#!/usr/bin/env bash
set -e
DOMAIN="chatflow-arjun.duckdns.org"
DUCKDNS_TOKEN="dd521365-e655-4efd-b82d-e705c0b2c16b"

PUB_IP="$(curl -s --max-time 5 https://api.ipify.org || echo '')"
[ -z "$PUB_IP" ] && exit 0
PRIV_IP="$(hostname -I | awk '{print $1}')"

# 1. Sync DuckDNS
curl -s --max-time 10 "https://www.duckdns.org/update?domains=chatflow-arjun&token=${DUCKDNS_TOKEN}&ip=" > /dev/null || true

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
EOF

sudo chmod +x /usr/local/bin/update-ip.sh
sudo /usr/local/bin/update-ip.sh

# Cron job to run every 5 minutes
sudo tee /etc/cron.d/chatflow-ip-sync > /dev/null <<'EOF'
*/5 * * * * root /usr/local/bin/update-ip.sh > /dev/null 2>&1
EOF
sudo chmod 644 /etc/cron.d/chatflow-ip-sync
```

---

## 5. Verification & Testing

Host setup complete hone ke baad in 3 commands se confirm karein:

### 1. Test HTTPS API Health
```bash
curl -I https://chatflow-arjun.duckdns.org/health
# Expected Output: HTTP/2 200 OK
```

### 2. Test Coturn STUN/TURN Packet Allocation
Run this one-line python script on the server to verify TURN allocate packet returns a public relay:
```bash
python3 - <<'PY'
import socket, os, hashlib, hmac

user = "testuser"
realm = "chatflow-arjun.duckdns.org"
secret = "4e9669527e05fc86dcf3f2256d0f7300"
key = hashlib.md5(f"{user}:{realm}:{secret}".encode()).digest()

s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.settimeout(3.0)
tx_id = os.urandom(12)

# STUN Allocate Request: 0x0003
req = b'\x00\x03\x00\x04\x21\x12\xa4\x42' + tx_id + b'\x00\x0f\x00\x04\x11\x00\x00\x00'
s.sendto(req, ('127.0.0.1', 3478))
resp, _ = s.recvfrom(2048)

msg_type = int.from_bytes(resp[0:2], 'big')
print(f"Coturn Response: 0x{msg_type:04x} ({'SUCCESS' if msg_type in (0x0103, 0x0113) else 'FAILED'})")
PY
```

### 3. Check All 3 Active Services
```bash
sudo systemctl status chatflow-api caddy coturn --no-pager
```

---

## 6. Daily Maintenance Commands

| Kaam | Command |
| :--- | :--- |
| **Code Update (Git Pull)** | `cd /opt/chatflow && git pull origin codex/apk-sdk-fix-main && pnpm --filter @chatflow/shared build && pnpm --filter @chatflow/server build && sudo systemctl restart chatflow-api` |
| **API Logs Dekhein** | `sudo journalctl -u chatflow-api -f` |
| **Caddy SSL Logs Dekhein** | `sudo journalctl -u caddy -f` |
| **Coturn Calling Logs Dekhein** | `sudo journalctl -u coturn -f` |
| **Server Restart Karein** | `sudo reboot` (Services boot par automatic start ho jayengi) |
| **API Restart Karein** | `sudo systemctl restart chatflow-api` |

---

## 7. Troubleshooting

### Problem 1: `curl: (7) Failed to connect to port 443: Connection timed out`
- **Solution:** Aapke Cloud Provider ke Web Dashboard (DigitalOcean Firewall / AWS Security Group / Oracle Cloud Security List) me **Port 80 aur Port 443 TCP** allowed nahi hai. Dashboard me Ingress rule add karein.

### Problem 2: Calls connect nahi ho rahi ("Could not connect. Check the internet or TURN relay")
- **Solution:** 
  1. Check karein ki **Port 3478 UDP aur TCP**, aur **Port 49152-65535 UDP** open hain.
  2. `/etc/turnserver.conf` me `external-ip` sahi public IP se match kar raha hai ya nahi.

### Problem 3: Caddy SSL Certificate nahi mil raha
- **Solution:** DuckDNS ka domain aapke naye server ke Public IP par point hona chahiye. Check karein: `dig +short chatflow-arjun.duckdns.org` agar wahi IP return kar raha hai.
