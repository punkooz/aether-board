# AetherBoard Backend MVP

Node.js + TypeScript + Fastify backend with local JSON file persistence.

## Features

- Tasks CRUD + status transitions
- Task comments
- Agents registry/profile
- Rooms + messages (`common` + pod rooms)
- Milestones feed
- Simple role-based auth placeholder (`CEO`, `Governor`)

## Quick start

```bash
cd projects/aetherboard/backend
npm install
npm run dev
```

Server defaults to `http://localhost:3000`.

## Auth placeholder

Set headers on requests:

- `x-role`: `CEO` or `Governor`
- `x-user-id`: any non-empty user id

Policy:

- CEO: full access
- Governor: read access + create comments/messages + limited task updates

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

Task statuses: `backlog | in_progress | blocked | review | done`

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
