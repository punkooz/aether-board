# AetherBoard Backend MVP

Node.js + TypeScript + Fastify backend with local JSON file persistence.

## Features

- Tasks CRUD + status transitions
- Task comments
- Agents registry/profile
- Rooms + messages (`common` + pod rooms)
- Milestones feed
- Public read endpoints + admin-token protected write endpoints

## Quick start

```bash
cd projects/aetherboard/backend
npm install
npm run dev
```

Server defaults to `http://localhost:3000`.

## Auth model (security patch)

- **Read endpoints** are public (`GET` routes).
- **Write endpoints** require an admin bearer token.

Set env var:

- `ADMIN_TOKEN` (required for write operations)

For write requests send:

- `Authorization: Bearer <ADMIN_TOKEN>`
- optional actor attribution headers:
  - `x-role`: `CEO` or `Governor`
  - `x-user-id`: user id for audit attribution

## Scripts

- `npm run dev` – development server (watch mode)
- `npm run build` – compile TS to `dist`
- `npm start` – run compiled server
- `npm test` – run tests

## API summary

### Health
- `GET /health`

### Tasks
- `GET /tasks`
- `POST /tasks`
- `GET /tasks/:id`
- `PATCH /tasks/:id`
- `DELETE /tasks/:id`
- `POST /tasks/:id/transition`
- `GET /tasks/:id/comments`
- `POST /tasks/:id/comments`

Task statuses: `todo | in-progress | blocked | review | done`

### Agents
- `GET /agents`
- `POST /agents`
- `GET /agents/:id`
- `PATCH /agents/:id`

### Rooms / Messages
- `GET /rooms`
- `POST /rooms`
- `GET /rooms/:id/messages`
- `POST /rooms/:id/messages`

Built-in room: `common`.

### Milestones
- `GET /milestones`
- `POST /milestones`

## Persistence

Data is stored in local JSON files in `./data`.

- `tasks.json`
- `comments.json`
- `agents.json`
- `rooms.json`
- `messages.json`
- `milestones.json`
