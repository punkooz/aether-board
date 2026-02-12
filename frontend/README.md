# AetherBoard Frontend MVP

Functional frontend MVP for AetherBoard under `projects/aetherboard/frontend`.

## Included views

- **Board by status** (`todo`, `in-progress`, `blocked`, `review`, `done`)
- **Task details + comments**
- **Agent profiles**
- **Room feeds**
- **Milestone updates**
- **CEO review queue**

## Quick start

```bash
cd projects/aetherboard/frontend
npm run start
```

Open: `http://localhost:5173`

By default, frontend server proxies `/api/*` to:

- `http://localhost:8080`

Set a custom backend:

```bash
BACKEND_URL="http://localhost:9000" npm run start
```

## Mock mode (for demo/dev without backend)

```bash
cd projects/aetherboard/frontend
npm run start:mock
```

This serves realistic mock data from the same API routes.

## Backend API shape expected

- `GET /api/tasks?status=<status>` → `[{ id, title, owner, status, priority, updatedAt }]`
- `GET /api/tasks/:id` → `{ id, title, description, owner, status, priority, updatedAt }`
- `GET /api/tasks/:id/comments` → `[{ author, body, createdAt }]`
- `GET /api/agents` → `[{ id, name, role, status, summary, room }]`
- `GET /api/rooms` → `[{ id, name }]`
- `GET /api/rooms/:id/feed` → `[{ author, message, createdAt }]`
- `GET /api/milestones` → `[{ id, title, state, dueAt, update }]`
- `GET /api/reviews?queue=ceo` → `[{ id, title, taskId, requestedBy, priority, createdAt, summary }]`

## Optional screenshots script

Script file: `scripts/capture-screenshots.mjs`

1. Start app first (`npm run start` or `npm run start:mock`)
2. Install Playwright if needed:

```bash
npm i -D playwright
npx playwright install chromium
```

3. Run capture:

```bash
npm run screenshots
```

Output PNGs are written to `projects/aetherboard/frontend/screenshots/`.
