# Real-Time Collaboration Server - Setup Guide

## Prerequisites

- **Node.js** (v18+)
- **Docker** (for PostgreSQL database)
- QuillApp frontend running (default: `http://localhost:8080`)

## Quick Start

```bash
cd server
npm install
docker compose up -d
sleep 3
npx prisma db push
node src/index.js
```

The server will start on `http://localhost:3001`.

## Step-by-Step Setup

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container on port 5432. Verify it's running:

```bash
docker ps
```

You should see `quillapp-postgres` with status `Up` and `healthy`.

### 3. Apply database schema

```bash
npx prisma db push
```

This creates the `sessions` and `versions` tables in the database.

### 4. Start the server

```bash
node src/index.js
```

Expected output:
```
[INFO] WebSocket server initialized
Database connected successfully
[INFO] Server running on 0.0.0.0:3001
[INFO] Environment: development
[INFO] CORS origin: http://localhost:8080
```

For auto-reload during development:
```bash
npm run dev
```

## Testing

### Health check

```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok","timestamp":"..."}`

### Create a session

```bash
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"iiifManifest":"https://example.com/manifest.json","documentName":"Test"}'
```

Expected: `{"id":"<uuid>","iiifManifest":"...","documentName":"Test","annotations":{},"createdAt":"..."}`

### Test from the frontend

1. Start the frontend: `npm run dev` (from project root)
2. Open a manuscript in the viewer
3. Click the **Share** button
4. Enter a display name and click **Create Session**
5. A shareable link should be generated

## Configuration

All settings are in `server/.env`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3001 | Server port |
| `DATABASE_URL` | (see .env) | PostgreSQL connection string |
| `CORS_ORIGIN` | http://localhost:8080 | Frontend URL (must match exactly) |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Max API requests per minute |

## Troubleshooting

### "Session creation is not working"

1. **Is PostgreSQL running?**
   ```bash
   docker ps | grep quillapp-postgres
   ```
   If not, run `docker compose up -d` from the `server/` directory.

2. **Is the database schema applied?**
   ```bash
   npx prisma db push
   ```

3. **Is the server running?**
   Check terminal for errors. Common issues:
   - Port 3001 already in use: `lsof -i :3001`
   - Port 5432 already in use: `lsof -i :5432`

4. **CORS error in browser console?**
   Make sure `CORS_ORIGIN` in `.env` matches your frontend URL exactly (including port).

5. **Connection refused?**
   The frontend expects the server at `http://localhost:3001`. If using a different port, set `VUE_APP_API_URL` when running the frontend.

### Reset everything

```bash
npm run docker:reset    # Wipes database and restarts PostgreSQL
sleep 3
npx prisma db push      # Re-apply schema
node src/index.js        # Restart server
```

### View database contents

```bash
npx prisma studio
```

Opens a browser UI at `http://localhost:5555` to inspect sessions and versions.

## NPM Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server with auto-reload |
| `npm start` | Start server |
| `npm run setup` | Full setup (docker + migrations) |
| `npm run docker:up` | Start PostgreSQL |
| `npm run docker:down` | Stop PostgreSQL |
| `npm run docker:reset` | Wipe database and restart |
| `npm run db:push` | Apply schema to database |
| `npm run db:studio` | Open database browser |
