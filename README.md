# Seshat (QuillApp)

Seshat is a manuscript annotation and analysis platform. It combines:
- a Vue frontend for image/PDF upload, IIIF viewing, annotation, export, and scribe-analysis workflows,
- a Python Flask backend for image preparation + scribe detection,
- an optional Node/Express + WebSocket collaboration server with PostgreSQL.

## Repository Structure

- `src/` — Vue frontend
- `python-backend/` — Flask ML/OCR backend (`/health`, `/prepare`, `/analyze`, ...)
- `server/` — collaboration API + WebSocket backend (`/api/sessions`, `/ws`)
- `ops/gwdg_deploy.sh` — Ubuntu deployment script (frontend + both backends + nginx)
- `DEPLOYING_TO_HF.md` — Hugging Face Spaces (Docker) backend deployment guide

## Prerequisites

- Node.js 18+
- npm
- Python 3.10+ (3.11 recommended)
- (Optional for collaboration server) Docker + Docker Compose

## Local Development

### 1) Install frontend dependencies

```bash
npm install
```

### 2) Create and install Python backend environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r python-backend/requirements.txt
```

### 3) Run the Python backend (terminal A)

```bash
cd python-backend
../.venv/bin/python app.py
```

Default backend URL: `http://localhost:5001`

### 4) Run the frontend (terminal B)

```bash
npm run serve
```

Default frontend URL: `http://localhost:8081`

The frontend proxies ML calls from `/ml/*` to `http://localhost:5001` via `vue.config.js`.

### 5) (Optional) Run collaboration server (terminal C)

```bash
cd server
npm install
npm run setup
npm run dev
```

Default collaboration URL: `http://localhost:3001`

## Environment Variables

The frontend reads these values when present:

- `VUE_APP_API_URL` — collaboration API base URL (e.g. `http://localhost:3001`)
- `VUE_APP_WS_URL` — collaboration WebSocket URL base (e.g. `ws://localhost:3001`)
- `VUE_APP_PHAROSIGHT_API_BASE` — ML backend base URL (e.g. `http://localhost:5001` or `/ml`)
- `VITE_PHAROSIGHT_API_BASE` — same purpose as above, used in some runtime contexts
- `window.__PHAROSIGHT_API_BASE__` — runtime override injected into built frontend

## Build for Production

```bash
npm run build
```

Output is generated in `dist/`.

## Health Checks

- ML backend: `GET /health` (example: `http://localhost:5001/health`)
- Collaboration backend: `GET /health` (example: `http://localhost:3001/health`)

## Troubleshooting

### Upload fails with `Unexpected token 'P', "Proxy erro"...`

This means the frontend got plain-text proxy output (usually backend unreachable) instead of JSON.

Checklist:
1. Ensure frontend is running (`npm run serve`).
2. Ensure Python backend is running on port `5001`.
3. Test proxy path: `http://localhost:8081/ml/health` should return `{"status":"ok"}`.

## Deployment (Server)

This section is for operators deploying Seshat to a VM or server.

### Option A: One-command Ubuntu deployment (recommended)

Use `ops/gwdg_deploy.sh` on Ubuntu 22.04:

```bash
sudo APP_HOST=your.server.domain bash ops/gwdg_deploy.sh
```

What it configures:
- Node.js + npm
- Python venv + ML dependencies
- PostgreSQL database
- collaboration server systemd service
- ML backend systemd service
- nginx reverse proxy serving built frontend + API proxying

Important environment knobs:
- `APP_HOST` (required)
- `APP_NAME`, `APP_ROOT`, `REPO_URL`, `BRANCH`
- `NODE_PORT` (default `3001`), `PY_PORT` (default `5001`)
- `DB_NAME`, `DB_USER`, `DB_PASS`

After deployment, verify:
- frontend over `http://<APP_HOST>/`
- collaboration health at `http://<APP_HOST>/health`
- ML health at `http://<APP_HOST>/ml/health`

### Option B: Manual deployment (frontend + both backends)

1. Build frontend:
   - `npm ci`
   - `npm run build`
2. Serve `dist/` with nginx.
3. Run collaboration backend (`server/`) with Node (systemd/pm2/container).
4. Run Python backend (`python-backend/app.py`) with a process manager.
5. Configure reverse proxy:
   - `/` → static frontend (`dist/`)
   - `/api` and `/ws` → collaboration backend
   - `/ml` → Python backend

### Option C: Deploy ML backend to Hugging Face Spaces (Docker)

If you only want hosted ML inference while keeping your own frontend/server:
- follow `DEPLOYING_TO_HF.md`,
- set frontend ML base to your HF URL via `VITE_PHAROSIGHT_API_BASE` / `VUE_APP_PHAROSIGHT_API_BASE`.

## Related Docs

- `DEPLOYING_TO_HF.md` — Hugging Face deployment
- `server/README.md` and `server/SETUP.md` — collaboration server setup
- `JSON_UPLOAD_FEATURE.md` — JSON upload flow details

## License

No license file is currently included in this repository.
