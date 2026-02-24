#!/usr/bin/env bash
set -euo pipefail

# QuillApp one-shot deploy for Ubuntu 22.04+
# Serves: Frontend on :80
# Proxies:
#   /api/*  -> Node backend (localhost:3001)
#   /ws     -> Node websocket
#   /ml/*   -> Python backend (localhost:5001)
#
# Run:
#   APP_HOST=v021067.vm.gwdguser.de sudo bash ops/gwdg_deploy.sh

APP_NAME="${APP_NAME:-quillapp}"
REPO_URL="${REPO_URL:-https://github.com/emanuskript/QuillApp.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"

APP_HOST="${APP_HOST:-}"
if [[ -z "$APP_HOST" ]]; then
  APP_HOST="$(hostname -f 2>/dev/null || true)"
fi
if [[ -z "$APP_HOST" || "$APP_HOST" != *.* ]]; then
  echo "ERROR: APP_HOST is not set (or not a FQDN)."
  echo "Run like: APP_HOST=v021067.vm.gwdguser.de sudo bash $0"
  exit 2
fi

APP_ROOT="${APP_ROOT:-/opt/${APP_NAME}}"
WEB_ROOT="${WEB_ROOT:-/var/www/${APP_NAME}}"

NODE_PORT="${NODE_PORT:-3001}"
PY_PORT="${PY_PORT:-5001}"

export DEBIAN_FRONTEND=noninteractive

log() { echo -e "\n==> $*"; }

need_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "ERROR: run as root (use sudo)."
    exit 1
  fi
}

install_apt() {
  log "APT: install base packages"
  apt-get update -y
  apt-get install -y --no-install-recommends \
    ca-certificates curl git gnupg lsb-release \
    nginx \
    python3 python3-venv python3-pip \
    build-essential \
    libgl1 libglib2.0-0 \
    postgresql postgresql-contrib \
    jq
}

install_node() {
  if command -v node >/dev/null 2>&1; then
    local major
    major="$(node -v | sed 's/^v//' | cut -d. -f1 || true)"
    if [[ "${major:-0}" -ge 18 ]]; then
      log "Node.js already present: $(node -v)"
      return 0
    fi
  fi

  log "Install Node.js 20.x (NodeSource)"
  curl -fsSL -o /tmp/nodesource_setup.sh https://deb.nodesource.com/setup_20.x
  bash /tmp/nodesource_setup.sh
  apt-get install -y nodejs
  log "Node.js installed: $(node -v), npm $(npm -v)"
}

ensure_dirs() {
  log "Create directories"
  mkdir -p "${APP_ROOT}" "${WEB_ROOT}"
}

clone_or_update_repo() {
  log "Clone or update repo"
  mkdir -p "${APP_ROOT}"

  # Make git treat this path as safe even when running under sudo/root
  git config --global --add safe.directory "${APP_ROOT}/app" || true

  if [[ -d "${APP_ROOT}/app/.git" ]]; then
    git -C "${APP_ROOT}/app" fetch --prune origin
    git -C "${APP_ROOT}/app" checkout "${REPO_BRANCH}"
    git -C "${APP_ROOT}/app" reset --hard "origin/${REPO_BRANCH}"
  else
    rm -rf "${APP_ROOT}/app"
    git clone --depth 1 --branch "${REPO_BRANCH}" "${REPO_URL}" "${APP_ROOT}/app"
  fi

  # Repo can contain huge committed artifacts under python-backend/static.
  # Safe to delete: backend recreates needed folders at runtime.
  if [[ -d "${APP_ROOT}/app/python-backend/static" ]]; then
    log "Prune python-backend/static (large committed artifacts)"
    rm -rf "${APP_ROOT}/app/python-backend/static"
  fi
  mkdir -p "${APP_ROOT}/app/python-backend/static" "${APP_ROOT}/app/python-backend/uploads"
}

ensure_postgres() {
  log "PostgreSQL: ensure service running"
  systemctl is-active --quiet postgresql || systemctl start postgresql

  log "PostgreSQL: ensure role + database (idempotent)"
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='quillapp'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE ROLE quillapp LOGIN PASSWORD 'quillapp';"
  else
    sudo -u postgres psql -c "ALTER ROLE quillapp WITH PASSWORD 'quillapp';"
  fi

  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='quillapp'" | grep -q 1; then
    sudo -u postgres createdb -O quillapp quillapp
  fi

  # Prisma wants schema=public, but psql/libpq does NOT understand ?schema=
  export DATABASE_URL="postgresql://quillapp:quillapp@127.0.0.1:5432/quillapp?schema=public"
  export DATABASE_URL_PSQL="postgresql://quillapp:quillapp@127.0.0.1:5432/quillapp?options=-csearch_path%3Dpublic"
  log "DATABASE_URL set"
}

build_frontend() {
  log "Frontend: configure + build"
  cd "${APP_ROOT}/app"

  local BASE_URL="http://${APP_HOST}"
  cat > .env.production.local <<EOF
VUE_APP_API_URL=${BASE_URL}/api
VUE_APP_WS_URL=ws://${APP_HOST}/ws
EOF

  # Replace the hardcoded HF Space backend URL with our local /ml proxy.
  if [[ -f "src/main.js" ]]; then
    sed -i "s|https://basuony-pharosight.hf.space|${BASE_URL}/ml|g" src/main.js || true
  fi

  # Patch any hardcoded localhost WS URLs if they exist.
  if command -v grep >/dev/null 2>&1; then
    while IFS= read -r -d '' f; do
      sed -i "s|ws://localhost:3001/ws|ws://${APP_HOST}/ws|g" "$f" || true
    done < <(grep -RIlZ "ws://localhost:3001/ws" src 2>/dev/null || true)
  fi

  npm ci
  npm run build

  rm -rf "${WEB_ROOT:?}/"* || true
  mkdir -p "${WEB_ROOT}"
  cp -a dist/. "${WEB_ROOT}/"
}

setup_node_backend() {
  log "Node backend: install deps + migrate + systemd"
  local NODE_DIR="${APP_ROOT}/app/server"
  cd "${NODE_DIR}" || { echo "ERROR: expected Node backend at ${NODE_DIR}"; exit 3; }

  mkdir -p "${APP_ROOT}/env"
  cat > "${APP_ROOT}/env/node.env" <<EOF
NODE_ENV=production
PORT=${NODE_PORT}
DATABASE_URL=${DATABASE_URL}
CORS_ORIGIN=http://${APP_HOST}
CORS_ORIGINS=http://${APP_HOST}
EOF

  npm ci

  log "Node backend: DB auth precheck (before Prisma)"
  # use libpq-compatible URL (no schema=)
  psql "${DATABASE_URL_PSQL}" -c "select 1" >/dev/null

  if [[ -d prisma/migrations ]] && ls -1 prisma/migrations/*/migration.sql >/dev/null 2>&1; then
    npx prisma migrate deploy
  fi
  npx prisma generate || true

  cat > "/etc/systemd/system/${APP_NAME}-node.service" <<EOF
[Unit]
Description=QuillApp Node collaboration backend
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
WorkingDirectory=${APP_ROOT}/app/server
EnvironmentFile=${APP_ROOT}/env/node.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${APP_NAME}-node.service"
}

setup_python_backend() {
  log "Python backend: venv + deps + systemd"
  local py_dir="${APP_ROOT}/app/python-backend"
  cd "${py_dir}" || { echo "ERROR: expected Python backend at ${py_dir}"; exit 4; }

  python3 -m venv "${APP_ROOT}/venv"
  "${APP_ROOT}/venv/bin/pip" install -U pip wheel
  "${APP_ROOT}/venv/bin/pip" install -r requirements.txt

  cat > "/etc/systemd/system/${APP_NAME}-ml.service" <<EOF
[Unit]
Description=QuillApp Python (scribe/ML) backend
After=network.target

[Service]
Type=simple
WorkingDirectory=${py_dir}
Environment=PYTHONUNBUFFERED=1
ExecStart=${APP_ROOT}/venv/bin/gunicorn --workers 2 --threads 2 --timeout 300 --bind 127.0.0.1:${PY_PORT} app:app
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable --now "${APP_NAME}-ml.service"
}

setup_nginx() {
  log "Nginx: serve frontend + proxy /api /ws /ml"
  rm -f /etc/nginx/sites-enabled/default || true

  cat > "/etc/nginx/sites-available/${APP_NAME}" <<EOF
server {
  listen 80;
  server_name ${APP_HOST} _;

  root ${WEB_ROOT};
  index index.html;

  location / {
    try_files \$uri \$uri/ /index.html;
  }

  # IMPORTANT: trailing slash strips /api/ prefix so Node sees /health not /api/health
  location /api/ {
    proxy_pass http://127.0.0.1:${NODE_PORT}/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  # convenience: direct health
  location = /health {
    proxy_pass http://127.0.0.1:${NODE_PORT}/health;
    proxy_set_header Host \$host;
  }

  # and also /api/health explicitly
  location = /api/health {
    proxy_pass http://127.0.0.1:${NODE_PORT}/health;
    proxy_set_header Host \$host;
  }

  location /ws {
    proxy_pass http://127.0.0.1:${NODE_PORT};
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }

  location /ml/ {
    proxy_pass http://127.0.0.1:${PY_PORT}/;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
  }
}
EOF

  ln -sf "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
  nginx -t
  systemctl enable --now nginx
  systemctl reload nginx
}

print_done() {
  log "DONE"
  echo "Frontend:   http://${APP_HOST}/"
  echo "Node API:   http://${APP_HOST}/health  (also http://${APP_HOST}/api/health)"
  echo "WebSocket:  ws://${APP_HOST}/ws"
  echo "Python API: http://${APP_HOST}/ml/  (proxied to localhost:${PY_PORT})"
  echo
  echo "If something fails, logs:"
  echo "  journalctl -u ${APP_NAME}-node.service -n 200 --no-pager"
  echo "  journalctl -u ${APP_NAME}-ml.service -n 200 --no-pager"
  echo "  tail -n 200 /var/log/nginx/error.log"
}

main() {
  need_root
  install_apt
  install_node
  ensure_dirs
  clone_or_update_repo
  ensure_postgres
  build_frontend
  setup_node_backend
  setup_python_backend
  setup_nginx
  print_done
}

main "$@"