# QuillApp Collaboration Server

Backend server for session sharing and version history features.

## Quick Start

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start PostgreSQL (via Docker) and run migrations
npm run setup

# 3. Start the development server
npm run dev
```

The server will run on `http://localhost:3001`.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start server with hot reload |
| `npm run start` | Start server (production) |
| `npm run setup` | Start Docker + run migrations |
| `npm run docker:up` | Start PostgreSQL container |
| `npm run docker:down` | Stop PostgreSQL container |
| `npm run docker:logs` | View PostgreSQL logs |
| `npm run docker:reset` | Reset database (deletes all data) |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:studio` | Open Prisma Studio (DB GUI) |

## Database Management

### Using Docker (Recommended)

```bash
# Start PostgreSQL
npm run docker:up

# View logs
npm run docker:logs

# Stop
npm run docker:down

# Reset (deletes all data)
npm run docker:reset
```

### Optional: pgAdmin

```bash
# Start with pgAdmin UI
docker compose --profile tools up -d

# Access at http://localhost:5050
# Email: admin@quillapp.local
# Password: admin
```

### Without Docker

Install PostgreSQL locally and update `DATABASE_URL` in `.env`.

## API Endpoints

### Sessions

- `POST /api/sessions` - Create session
- `GET /api/sessions/:id` - Get session
- `PUT /api/sessions/:id/annotations` - Update annotations
- `GET /api/sessions/device/:deviceId` - Get user's projects
- `DELETE /api/sessions/:id` - Delete session

### Versions

- `POST /api/sessions/:id/versions` - Create checkpoint
- `GET /api/sessions/:id/versions` - List versions
- `GET /api/sessions/:id/versions/:versionId` - Get version
- `POST /api/sessions/:id/versions/:versionId/restore` - Restore version

### WebSocket

Connect to `ws://localhost:3001/ws` for real-time collaboration.

## Environment Variables

See `.env.example` for all available options.
