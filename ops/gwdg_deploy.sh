#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-quillapp}"
APP_ROOT="/opt/${APP_NAME}"
WEB_ROOT="/var/www/${APP_NAME}"

# Prefer explicit APP_HOST; otherwise try reverse DNS of primary IPv4; otherwise fallback.
detect_host() {
  if [ -n "${APP_HOST:-}" ]; then echo "$APP_HOST"; return; fi
  local ip host
  ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '/src/ {print $7; exit}')"
  host="$(getent hosts "$ip" 2>/dev/null | awk '{print $2; exit}' || true)"
  if [ -n "$host" ]; then echo "$host"; return; fi
  echo "v021067.vm.gwdguser.de"
}
APP_HOST="$(detect_host)"

RUN_USER="${SUDO_USER:-$(id -un)}"

log(){ echo -e "\n==> $*\n"; }

need_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "Please run as root (use: sudo bash ...)" >&2
    exit 1
  fi
}
need_root

export DEBIAN_FRONTEND=noninteractive

log "Install base packages"
apt-get update -y
apt-get install -y \
  git curl ca-certificates gnupg rsync \
  ufw fail2ban \
  python3-venv python3-pip build-essential \
  openssl \
  postgresql postgresql-contrib

log "UFW (allow 80/443; keep 22 allowed locally)"
ufw default deny incoming || true
ufw default allow outgoing || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw allow 22/tcp || true
ufw --force enable || true

log "Install Caddy"
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -y
  apt-get install -y caddy
fi

log "Install Node.js 20"
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | tr -d 'v' | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

log "Prepare folders"
mkdir -p "$APP_ROOT" "$WEB_ROOT" "/etc/${APP_NAME}"
chown -R "${RUN_USER}:${RUN_USER}" "$APP_ROOT" "$WEB_ROOT"
chmod 755 "$WEB_ROOT"

log "Clone or update repo"
if [ -d "${APP_ROOT}/app/.git" ]; then
  sudo -u "${RUN_USER}" bash -lc "cd '${APP_ROOT}/app' && git fetch --all && git checkout main && git pull --ff-only"
else
  sudo -u "${RUN_USER}" bash -lc "cd '${APP_ROOT}' && git clone https://github.com/emanuskript/QuillApp.git app"
fi

log "Create persistent DB secrets (idempotent)"
DB_ENV="/etc/${APP_NAME}/db.env"
if [ ! -f "$DB_ENV" ]; then
  DB_USER="quillapp"
  DB_NAME="quillapp"
  DB_PASS="$(openssl rand -hex 16)"
  cat >"$DB_ENV" <<EOF
DB_USER=${DB_USER}
DB_NAME=${DB_NAME}
DB_PASS=${DB_PASS}
EOF
  chmod 600 "$DB_ENV"
fi
# shellcheck disable=SC1090
source "$DB_ENV"
DB_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"

log "Initialize Postgres user/db (idempotent)"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

log "Patch frontend: remove hardcoded HF backend (if present) + set production env"
# Make frontend prefer env VUE_APP_PHAROSIGHT_API_BASE, else same-origin /ml
sudo -u "${RUN_USER}" python3 - <<'PY'
from pathlib import Path
import re

p = Path("/opt/quillapp/app/src/main.js")
if not p.exists():
    print("WARN: src/main.js not found, skipping patch")
    raise SystemExit(0)

s = p.read_text(encoding="utf-8", errors="ignore")

# Replace any const HF_BACKEND = "https://..."; or 'https://...';
pattern = r'const\s+HF_BACKEND\s*=\s*["\'][^"\']+["\']\s*;'
replacement = r'const HF_BACKEND = (process.env.VUE_APP_PHAROSIGHT_API_BASE || `${window.location.origin}/ml`).replace(/\/+$/, "");'

if re.search(pattern, s):
    s = re.sub(pattern, replacement, s, count=1)

# Also ensure normalizeEndpoint replaces known legacy bases
s = s.replace('return value.replace("https://pharosight.onrender.com", HF_BACKEND)',
              'return value.replace("https://pharosight.onrender.com", HF_BACKEND).replace("https://basuony-pharosight.hf.space", HF_BACKEND)')

p.write_text(s, encoding="utf-8")
print("Patched:", p)
PY

sudo -u "${RUN_USER}" bash -lc "cat >'${APP_ROOT}/app/.env.production' <<EOF
VUE_APP_API_URL=https://${APP_HOST}
VUE_APP_WS_URL=wss://${APP_HOST}/ws
VUE_APP_PHAROSIGHT_API_BASE=https://${APP_HOST}/ml

# also provide Vite-style vars in case project uses Vite in some branches
VITE_API_URL=https://${APP_HOST}
VITE_WS_URL=wss://${APP_HOST}/ws
VITE_PHAROSIGHT_API_BASE=https://${APP_HOST}/ml
EOF"

log "Build frontend"
sudo -u "${RUN_USER}" bash -lc "
  set -e
  cd '${APP_ROOT}/app'
  if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi
  npm run build
"

OUT_DIR=""
for d in dist build; do
  if [ -d "${APP_ROOT}/app/${d}" ]; then OUT_DIR="${APP_ROOT}/app/${d}"; break; fi
done
if [ -z "$OUT_DIR" ]; then
  echo "ERROR: frontend build finished but no dist/ or build/ found at repo root." >&2
  ls -la "${APP_ROOT}/app"
  exit 1
fi
rsync -a --delete "${OUT_DIR}/" "${WEB_ROOT}/"

log "Setup Node collab service (server/) on 127.0.0.1:3001"
if [ -d "${APP_ROOT}/app/server" ] && [ -f "${APP_ROOT}/app/server/package.json" ]; then
  sudo -u "${RUN_USER}" bash -lc "
    set -e
    cd '${APP_ROOT}/app/server'
    if [ -f package-lock.json ]; then npm ci; else npm install --no-audit --no-fund; fi
    npx prisma generate || true
    npx prisma migrate deploy || npx prisma db push || true
    cat > .env <<EOF
PORT=3001
NODE_ENV=production
DATABASE_URL=${DB_URL}
CORS_ORIGIN=https://${APP_HOST}
EOF
  "

  cat >/etc/systemd/system/${APP_NAME}-node.service <<EOF
[Unit]
Description=${APP_NAME} Node collaboration service
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${APP_ROOT}/app/server
EnvironmentFile=${APP_ROOT}/app/server/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now ${APP_NAME}-node.service
else
  echo "WARN: server/ not found -> skipping Node service"
fi

log "Setup Python backend (python-backend/) on 127.0.0.1:5001"
PY_DIR="${APP_ROOT}/app/python-backend"
PY_TARGET=""
if [ -f "${PY_DIR}/simple_backend.py" ]; then
  PY_TARGET="simple_backend:app"
elif [ -f "${PY_DIR}/app.py" ]; then
  PY_TARGET="app:app"
fi

if [ -n "${PY_TARGET}" ]; then
  sudo -u "${RUN_USER}" bash -lc "
    set -e
    cd '${PY_DIR}'
    python3 -m venv venv
    ./venv/bin/pip install --upgrade pip wheel
    if [ -f requirements.txt ]; then ./venv/bin/pip install -r requirements.txt; fi
    ./venv/bin/pip install gunicorn
  "

  cat >/etc/systemd/system/${APP_NAME}-py.service <<EOF
[Unit]
Description=${APP_NAME} Python scribe backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${PY_DIR}
ExecStart=${PY_DIR}/venv/bin/gunicorn -w 2 -b 127.0.0.1:5001 ${PY_TARGET}
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now ${APP_NAME}-py.service
else
  echo "WARN: python-backend simple_backend.py/app.py not found -> skipping Python service"
fi

log "Configure Caddy: /api + /health + /ws -> Node; /ml/* -> Python; / -> frontend"
cat >/etc/caddy/Caddyfile <<EOF
${APP_HOST} {
  encode zstd gzip

  @node path /api/* /health
  reverse_proxy @node 127.0.0.1:3001

  @ws path /ws*
  reverse_proxy @ws 127.0.0.1:3001

  # strip /ml prefix before proxying to python (python expects /prepare, /analyze, /static/*, /health)
  handle_path /ml/* {
    reverse_proxy 127.0.0.1:5001
  }

  root * ${WEB_ROOT}
  try_files {path} /index.html
  file_server
}
EOF

systemctl reload caddy

log "Done. Public endpoints:"
echo "Frontend:  https://${APP_HOST}/"
echo "Node API:  https://${APP_HOST}/api/...  (and https://${APP_HOST}/health)"
echo "Node WS:   wss://${APP_HOST}/ws"
echo "Python:    https://${APP_HOST}/ml/...   (e.g. /ml/health, /ml/prepare, /ml/analyze, /ml/static/...)"

echo
echo "If HTTPS fails, check:"
echo "  sudo journalctl -u caddy -e --no-pager"
