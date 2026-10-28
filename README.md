# Uptime Monitoring Service

Monitors configured websites on a schedule and stores their status, response time, HTTP status code, and check history.

Includes a NestJS API and a read-only React dashboard.

## Live Site

**Dashboard:**  
https://uptime-monitor-dashboard.onrender.com

**API:**  
https://uptime-monitor-50l8.onrender.com

## Features

- Scheduled website checks with configurable intervals
- UP/DOWN status and response-time tracking
- HTTP status codes and error details
- Persistent check history
- Automatic dashboard refresh
- Manual checks through the API
- Protected create, update, delete, and manual-check endpoints
- URL safety checks for monitored destinations
- Responsive dashboard with recent check history

## Tech Stack

### Backend

- TypeScript
- Node.js
- NestJS
- PostgreSQL
- Prisma

### Frontend

- React
- TypeScript
- Vite
- CSS

### Testing

- Jest
- Supertest

### Tooling

- Docker
- GitHub Actions
- oxlint
- Prettier

## API

### Public

```text
GET /monitors
GET /monitors/:id
GET /monitors/:id/checks
```

### Admin

Requires an `x-admin-key` header.

```text
POST   /monitors
PATCH  /monitors/:id
DELETE /monitors/:id
POST   /monitors/:id/check
```

Example:

```bash
curl -X POST http://localhost:3000/monitors \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: YOUR_ADMIN_KEY" \
  -d '{"name":"GitHub","url":"https://github.com","intervalMinutes":5}'
```

## Monitoring

A cron job runs every minute and checks active monitors whose configured interval has elapsed.

Each result stores:

- UP/DOWN state
- HTTP status code
- response time
- error message
- timestamp

## Local Setup

### Backend

Install dependencies:

```bash
npm install
```

Start PostgreSQL:

```bash
docker compose up -d
```

Create `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/uptime_monitor"
DIRECT_URL="postgresql://postgres:postgres@localhost:5433/uptime_monitor"
ADMIN_KEY="your-local-admin-key"
FRONTEND_URL="http://localhost:5173"
```

Generate the Prisma client and apply migrations:

```bash
npx prisma generate --config prisma7.config.ts
npx prisma migrate deploy --config prisma7.config.ts
```

Start the API:

```bash
npm run start:dev
```

The backend runs at `http://localhost:3000`.

### Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:3000
```

Start the frontend:

```bash
npm run dev
```

The dashboard runs at `http://localhost:5173`.

## Testing

Unit tests cover monitoring, overlapping checks, timeouts, network and database failures, and URL validation:

```bash
npm test -- --runInBand
```

For API tests, start the disposable test database and run these commands in a separate PowerShell terminal:

```powershell
docker compose -f compose.test.yml up -d
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5434/uptime_monitor_test"
$env:DIRECT_URL = $env:TEST_DATABASE_URL
$env:DOTENV_CONFIG_PATH = "__unused_for_tests__"
npx prisma migrate deploy --config prisma7.config.ts
npm run test:e2e
```

API tests clear test data between cases. They require `TEST_DATABASE_URL`, ignore local dotenv files, and check the connected database name before deletion. Use a dedicated `uptime_monitor_test` database and run tests serially.

From `frontend`, run `npm test`, `npm run lint`, and `npm run build`. Frontend tests cover status calculation and failed API responses using mocked requests.

## Monitoring behavior

- Manual checks return 409 if that monitor is already being checked. Scheduled checks skip monitors already running, and scheduler batches cannot overlap within one backend process.
- DNS validation and the HTTP request share a five-second deadline. Database failures are reported separately from website failures.
- Redirects are not followed. HTTP 3xx results appear as REDIRECT rather than DOWN.
- History defaults to the latest 100 results; `?limit=1` through `?limit=100` selects fewer. The dashboard requests five.
- Inactive monitors appear as PAUSED. Results older than the monitor interval plus two minutes appear as STALE. Failed refreshes show an error and retain previously loaded results.

## Security

- Admin endpoints require an `x-admin-key` header.
- Only HTTP and HTTPS URLs are accepted.
- Local, private, loopback, and link-local addresses are blocked.
- Redirects are not automatically followed.
- The dashboard is read-only.

## CI

GitHub Actions runs backend lint, unit tests, API tests, and build, plus frontend tests, lint, and build, on pushes and pull requests.

## Deployment

- **Frontend:** Render Static Site
- **Backend:** Render Web Service
- **Database:** Neon PostgreSQL

Render's free backend can sleep when inactive, so scheduled checks only run while the service is awake.
