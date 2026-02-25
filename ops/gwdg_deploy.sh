#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-quillapp}"
APP_ROOT="${APP_ROOT:-/opt/${APP_NAME}}"
REPO_URL="${REPO_URL:-https://github.com/emanuskript/QuillApp.git}"
BRANCH="${BRANCH:-main}"

# IMPORTANT: set this when you run the script:
# APP_HOST=v021067.vm.gwdguser.de
APP_HOST="${APP_HOST:-}"
if [[ -z "${APP_HOST}" ]]; then
  echo "ERROR: APP_HOST is required (e.g. APP_HOST=v021067.vm.gwdguser.de)"
  exit 1
fi

NODE_PORT="${NODE_PORT:-3001}"
PY_PORT="${PY_PORT:-5001}"

REPO_DIR="${APP_ROOT}/app"
FRONTEND_DIR="${REPO_DIR}"
NODE_DIR="${REPO_DIR}/server"
PY_DIR="${REPO_DIR}/python-backend"

echo "==> Installing OS deps"
sudo apt-get update -y
sudo apt-get install -y git nginx python3-venv python3-pip nodejs npm

echo "==> Clone/update repo"
sudo mkdir -p "${APP_ROOT}"
if [[ ! -d "${REPO_DIR}/.git" ]]; then
  sudo rm -rf "${REPO_DIR}"
  sudo git clone --branch "${BRANCH}" "${REPO_URL}" "${REPO_DIR}"
else
  sudo git -C "${REPO_DIR}" fetch --prune origin
  sudo git -C "${REPO_DIR}" reset --hard "origin/${BRANCH}"
fi
sudo git -C "${REPO_DIR}" submodule update --init --recursive || true

echo "==> Frontend build env"
sudo tee "${FRONTEND_DIR}/.env.production.local" >/dev/null <<EOF
VUE_APP_API_URL=http://${APP_HOST}
VUE_APP_WS_URL=ws://${APP_HOST}
VUE_APP_ML_URL=http://${APP_HOST}/ml
EOF

echo "==> Build frontend"
cd "${FRONTEND_DIR}"
sudo npm ci
sudo npm run build

echo "==> Setup Node backend (systemd)"
cd "${NODE_DIR}"
sudo npm ci

sudo tee "/etc/systemd/system/${APP_NAME}-node.service" >/dev/null <<EOF
[Unit]
Description=${APP_NAME} Node API
After=network.target

[Service]
Type=simple
WorkingDirectory=${NODE_DIR}
Environment=PORT=${NODE_PORT}
Environment=CORS_ORIGIN=http://${APP_HOST}
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

echo "==> Setup Python backend (systemd)"
sudo python3 -m venv "${APP_ROOT}/venv"
sudo "${APP_ROOT}/venv/bin/pip" install --upgrade pip

cd "${PY_DIR}"
sudo "${APP_ROOT}/venv/bin/pip" install -r requirements.txt

sudo tee "/etc/systemd/system/${APP_NAME}-ml.service" >/dev/null <<EOF
[Unit]
Description=${APP_NAME} Python ML (Flask)
After=network.target

[Service]
Type=simple
WorkingDirectory=${PY_DIR}
Environment=PORT=${PY_PORT}
ExecStart=${APP_ROOT}/venv/bin/python app.py
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

echo "==> Nginx: serve frontend + proxy /api /ws /ml"
sudo rm -f /etc/nginx/sites-enabled/default

sudo tee "/etc/nginx/sites-available/${APP_NAME}.conf" >/dev/null <<'NGINXEOF'
server {
  listen 80;
  server_name %%APP_HOST%% _;

  # Fix 413 for /ml uploads (Flask allows 60MB; nginx must allow >= that)
  client_max_body_size 75m;

  root %%FRONTEND_DIR%%/dist;
  index index.html;

  # Avoid stale frontend JS after redeploy
  location = /index.html {
    add_header Cache-Control "no-store";
    try_files $uri =404;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }

  # Node health (native)
  location = /health {
    proxy_pass http://127.0.0.1:%%NODE_PORT%%/health;
  }

  # Optional convenience: /api/health -> /health
  location = /api/health {
    proxy_pass http://127.0.0.1:%%NODE_PORT%%/health;
  }

  # Node REST API (keeps /api prefix; your server mounts routes under /api)
  location /api/ {
    proxy_pass http://127.0.0.1:%%NODE_PORT%%;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # WebSocket (Node ws server listens on /ws)
  location /ws {
    proxy_pass http://127.0.0.1:%%NODE_PORT%%;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600;
    proxy_send_timeout 3600;
  }

  # Python ML backend at /ml/*
  location /ml/ {
    client_max_body_size 75m;
    proxy_pass http://127.0.0.1:%%PY_PORT%%/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    proxy_read_timeout 600;
    proxy_send_timeout 600;

    # safer for big uploads
    proxy_request_buffering off;
    proxy_buffering off;
  }
}
NGINXEOF

# Replace placeholders with actual values
sudo sed -i "s|%%APP_HOST%%|${APP_HOST}|g"         "/etc/nginx/sites-available/${APP_NAME}.conf"
sudo sed -i "s|%%FRONTEND_DIR%%|${FRONTEND_DIR}|g" "/etc/nginx/sites-available/${APP_NAME}.conf"
sudo sed -i "s|%%NODE_PORT%%|${NODE_PORT}|g"       "/etc/nginx/sites-available/${APP_NAME}.conf"
sudo sed -i "s|%%PY_PORT%%|${PY_PORT}|g"           "/etc/nginx/sites-available/${APP_NAME}.conf"

sudo ln -sf "/etc/nginx/sites-available/${APP_NAME}.conf" "/etc/nginx/sites-enabled/${APP_NAME}.conf"

sudo nginx -t
sudo systemctl daemon-reload

sudo systemctl enable "${APP_NAME}-node.service" "${APP_NAME}-ml.service" nginx
sudo systemctl restart "${APP_NAME}-node.service" "${APP_NAME}-ml.service" nginx

echo
echo "==> DONE"
echo "Frontend:   http://${APP_HOST}/"
echo "Node API:   http://${APP_HOST}/health"
echo "Node WS:    ws://${APP_HOST}/ws"
echo "Python ML:  http://${APP_HOST}/ml/analyze"
echo
echo "Logs:"
echo "  journalctl -u ${APP_NAME}-node.service -n 200 --no-pager"
echo "  journalctl -u ${APP_NAME}-ml.service   -n 200 --no-pager"
echo "  tail -n 200 /var/log/nginx/error.log"
