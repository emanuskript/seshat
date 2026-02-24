echo "If HTTPS fails, check:"
#!/usr/bin/env bash
set -euo pipefail

# ----------------------------
# Config (override via env)
# ----------------------------
APP_NAME="${APP_NAME:-quillapp}"
RUN_USER="${RUN_USER:-quillapp}"
APP_ROOT="${APP_ROOT:-/opt/${APP_NAME}}"
WEB_ROOT="${WEB_ROOT:-/var/www/${APP_NAME}}"
REPO_URL="${REPO_URL:-https://github.com/emanuskript/QuillApp.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"

# Hostname to print at the end (your public DNS)
APP_HOST="${APP_HOST:-v021067.vm.gwdguser.de}"

NODE_PORT="${NODE_PORT:-3001}"
PY_PORT="${PY_PORT:-5001}"

# Python backend runtime data directory (avoid writing into the git repo)
PHAROSIGHT_DATA_DIR="${PHAROSIGHT_DATA_DIR:-${APP_ROOT}/data}"

log() { echo -e "\n==> $*"; }

need_root() {
  if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: run as root (use sudo)." >&2
    exit 1
  fi
}

detect_public_ip() {
  # best-effort
  curl -fsSL https://api.ipify.org 2>/dev/null || true
}

# ----------------------------
# Main
# ----------------------------
need_root

log "Install base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y \
  ca-certificates curl git nginx \
  python3 python3-venv python3-pip \
  build-essential openssl

log "Install Node.js (NodeSource 20.x) if needed"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

log "Create service user and directories"
if ! id -u "${RUN_USER}" >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash "${RUN_USER}"
fi
mkdir -p "${APP_ROOT}" "${WEB_ROOT}" "${PHAROSIGHT_DATA_DIR}"
chown -R "${RUN_USER}:${RUN_USER}" "${APP_ROOT}" "${WEB_ROOT}" "${PHAROSIGHT_DATA_DIR}"

# If previous failed clone exists, remove it to recover automatically
if [ -d "${APP_ROOT}/app" ]; then
  rm -rf "${APP_ROOT}/app"
fi

log "Clone repo with sparse checkout (exclude python-backend/static/** to avoid huge committed artifacts)"
sudo -u "${RUN_USER}" bash -lc "
  set -e
  cd '${APP_ROOT}'
  git clone --depth 1 --filter=blob:none --no-checkout '${REPO_URL}' app
  cd app
  git sparse-checkout init --no-cone
  cat > .git/info/sparse-checkout <<'EOF'
/*
!/python-backend/static/
!/python-backend/static/**
EOF
  git checkout '${REPO_BRANCH}'
  mkdir -p python-backend/static
"

REPO_DIR="${APP_ROOT}/app"

log "Prepare frontend env for same-origin deployment"
sudo -u "${RUN_USER}" bash -lc "
  set -e
  cd '${REPO_DIR}'
  cat > .env.production <<'EOF'
VUE_APP_API_URL=/api
VUE_APP_WS_URL=/ws
VUE_APP_PHAROSIGHT_API_BASE=/ml
VITE_API_URL=/api
VITE_WS_URL=/ws
VITE_PHAROSIGHT_API_BASE=/ml
EOF
"

log "Build frontend"
sudo -u "${RUN_USER}" bash -lc "
  set -e
  cd '${REPO_DIR}'
  if [ -f package-lock.json ]; then npm ci; else npm install; fi
  npm run build
"

# Vue/Vite both typically output dist/
if [ ! -d "${REPO_DIR}/dist" ]; then
  echo "ERROR: frontend build did not produce ${REPO_DIR}/dist" >&2
  exit 1
fi

rm -rf "${WEB_ROOT:?}/"*
cp -a "${REPO_DIR}/dist/." "${WEB_ROOT}/"
chown -R "${RUN_USER}:${RUN_USER}" "${WEB_ROOT}"

log "Locate Node collaboration backend directory (auto-detect)"
NODE_BACKEND_DIR="$(sudo -u "${RUN_USER}" bash -lc "
  set -e
  cd '${REPO_DIR}'
  # Prefer directories that contain sessions.js/versions.js
  f=\$(find . -maxdepth 6 -type f -name sessions.js -o -name versions.js | head -n 1 || true)
  if [ -n \"\$f\" ]; then
    d=\$(dirname \"\$f\")
    # climb to a folder that has a package.json
    while [ \"\$d\" != \".\" ] && [ ! -f \"\$d/package.json\" ]; do d=\$(dirname \"\$d\"); done
    if [ -f \"\$d/package.json\" ]; then echo \"\$d\"; exit 0; fi
  fi

  # Fallback: first non-root package.json that isn't the frontend root
  p=\$(find . -mindepth 2 -maxdepth 4 -type f -name package.json | head -n 1 || true)
  if [ -n \"\$p\" ]; then echo \$(dirname \"\$p\"); exit 0; fi

  echo ''
")"

if [ -z "${NODE_BACKEND_DIR}" ]; then
  echo "ERROR: could not auto-detect Node backend directory (sessions.js/versions.js not found)." >&2
  exit 1
fi
NODE_BACKEND_DIR="${REPO_DIR}/${NODE_BACKEND_DIR#./}"

log "Install Node backend deps"
sudo -u "${RUN_USER}" bash -lc "
  set -e
  cd '${NODE_BACKEND_DIR}'
  if [ -f package-lock.json ]; then npm ci; else npm install; fi
"

# Optional Postgres/Prisma bootstrapping if schema exists
if [ -f "${NODE_BACKEND_DIR}/prisma/schema.prisma" ]; then
  log "Detected Prisma schema -> install PostgreSQL and run migrations"
  apt-get install -y postgresql postgresql-contrib

  DB_USER="${APP_NAME}"
  DB_NAME="${APP_NAME}"
  DB_PASS_FILE="${APP_ROOT}/.db_pass"
  if [ ! -f "${DB_PASS_FILE}" ]; then
    umask 077
    openssl rand -hex 18 > "${DB_PASS_FILE}"
    chown "${RUN_USER}:${RUN_USER}" "${DB_PASS_FILE}"
  fi
  DB_PASS="$(cat "${DB_PASS_FILE}")"

  sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 \
    || sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
    || sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"

  NODE_ENV_FILE="${APP_ROOT}/.env.node"
  cat > "${NODE_ENV_FILE}" <<EOF
NODE_ENV=production
PORT=${NODE_PORT}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}?schema=public
CORS_ORIGIN=https://${APP_HOST} http://${APP_HOST}
EOF
  chown "${RUN_USER}:${RUN_USER}" "${NODE_ENV_FILE}"

  sudo -u "${RUN_USER}" bash -lc "
    set -e
    set -a
    source '${NODE_ENV_FILE}'
    set +a
    cd '${NODE_BACKEND_DIR}'
    npx prisma generate
    npx prisma migrate deploy || npx prisma db push
  "
else
  NODE_ENV_FILE="${APP_ROOT}/.env.node"
  cat > "${NODE_ENV_FILE}" <<EOF
NODE_ENV=production
PORT=${NODE_PORT}
CORS_ORIGIN=https://${APP_HOST} http://${APP_HOST}
EOF
  chown "${RUN_USER}:${RUN_USER}" "${NODE_ENV_FILE}"
fi

log "Set up Python backend venv + deps"
PY_DIR="${REPO_DIR}/python-backend"
if [ ! -f "${PY_DIR}/requirements.txt" ]; then
  echo "ERROR: python-backend/requirements.txt not found." >&2
  exit 1
fi

sudo -u "${RUN_USER}" bash -lc "
  set -e
  python3 -m venv '${APP_ROOT}/venv'
  source '${APP_ROOT}/venv/bin/activate'
  pip install -U pip wheel
  pip install -r '${PY_DIR}/requirements.txt'
"

PY_ENV_FILE="${APP_ROOT}/.env.python"
cat > "${PY_ENV_FILE}" <<EOF
PHAROSIGHT_DATA_DIR=${PHAROSIGHT_DATA_DIR}
PORT=${PY_PORT}
EOF
chown "${RUN_USER}:${RUN_USER}" "${PY_ENV_FILE}"

log "Create systemd services"
cat > "/etc/systemd/system/${APP_NAME}-node.service" <<EOF
[Unit]
Description=${APP_NAME} Node collaboration backend
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${NODE_BACKEND_DIR}
EnvironmentFile=${NODE_ENV_FILE}
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

# Use Flask app from simple_backend.py by default
PY_APP_MODULE="simple_backend:app"
if [ -f "${PY_DIR}/app.py" ]; then
  # If app.py defines `app = Flask(...)`, you can switch to app:app later.
  # Keep default as simple_backend unless you explicitly want app.py.
  true
fi

cat > "/etc/systemd/system/${APP_NAME}-python.service" <<EOF
[Unit]
Description=${APP_NAME} Python backend
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${PY_DIR}
EnvironmentFile=${PY_ENV_FILE}
ExecStart=${APP_ROOT}/venv/bin/gunicorn -b 127.0.0.1:${PY_PORT} ${PY_APP_MODULE}
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now "${APP_NAME}-python.service"
systemctl enable --now "${APP_NAME}-node.service"

log "Configure Nginx (SPA + /api + /ws + /ml reverse proxy)"
cat > "/etc/nginx/sites-available/${APP_NAME}" <<EOF
server {
  listen 80;
  server_name ${APP_HOST};

  root ${WEB_ROOT};
  index index.html;

  client_max_body_size 50m;

  # Node HTTP API (strip /api prefix)
  location /api/ {
    proxy_pass http://127.0.0.1:${NODE_PORT}/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  }

  # Node WebSocket
  location /ws {
    proxy_pass http://127.0.0.1:${NODE_PORT}/ws;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
  }

  # Python backend (strip /ml prefix)
  location /ml/ {
    proxy_pass http://127.0.0.1:${PY_PORT}/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  }

  # Helpful: expose Node /health at the edge too
  location = /health {
    proxy_pass http://127.0.0.1:${NODE_PORT}/health;
    proxy_set_header Host \$host;
  }

  # SPA fallback
  location / {
    try_files \$uri \$uri/ /index.html;
  }
}
EOF

ln -sf "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
rm -f /etc/nginx/sites-enabled/default || true
nginx -t
systemctl restart nginx

PUBLIC_IP="$(detect_public_ip)"
log "DONE"
echo "Frontend:    http://${APP_HOST}/"
echo "Node health: http://${APP_HOST}/health"
echo "API base:    http://${APP_HOST}/api/"
echo "WS:          ws://${APP_HOST}/ws"
echo "ML base:     http://${APP_HOST}/ml/"
if [ -n "${PUBLIC_IP}" ]; then
  echo "Public IP:   http://${PUBLIC_IP}/"
fi
echo ""
echo "Logs:"
echo "  journalctl -u ${APP_NAME}-node -f"
echo "  journalctl -u ${APP_NAME}-python -f"
echo "  tail -f /var/log/nginx/access.log /var/log/nginx/error.log"
