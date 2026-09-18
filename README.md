# Uptime Monitoring Service

Monitors configured websites on a schedule and stores their status, response time, HTTP status code, and check history.

Includes a NestJS API and a read-only React dashboard.

## Live Site

**Dashboard:**  
https://uptime-monitor-dashboard.onrender.com

**API:**  
https://uptime-monitor-5018.onrender.com

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
- ESLint
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
npx prisma generate
npx prisma migrate deploy
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

Unit tests cover monitoring logic, scheduler behavior, network failures, and URL validation.

E2E tests use a separate PostgreSQL database and cover the API, validation, protected admin endpoints, check history, and cascade deletion.

Start the test database and apply migrations:

```bash
docker compose -f compose.test.yml up -d
npx dotenv -e .env.test -- npx prisma migrate deploy
```

Run the tests:

```bash
npm test -- --runInBand
npm run test:e2e
```

## Security

- Admin endpoints require an `x-admin-key` header.
- Only HTTP and HTTPS URLs are accepted.
- Local, private, loopback, and link-local addresses are blocked.
- Redirects are not automatically followed.
- The dashboard is read-only.

## CI

GitHub Actions runs linting, unit tests, E2E tests, and the production build on pushes and pull requests.

## Deployment

- **Frontend:** Render Static Site
- **Backend:** Render Web Service
- **Database:** Neon PostgreSQL

Render's free backend can sleep when inactive, so scheduled checks only run while the service is awake.
