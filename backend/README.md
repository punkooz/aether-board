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

## Auth model (F-001 remediation)

- **Read endpoints** are public (`GET` routes), except `/audits`.
- Protected endpoints require a scoped bearer token: `Authorization: Bearer <tokenId>.<secret>`.
- Secret verification uses `sha256` hash comparison (constant-time).
- Each token has `expiresAt`, `scopes`, and `roleScopes`.
- Revoked tokens are persisted in `data/revoked-tokens.json` and blocked on every request.

Set env vars:

- `ADMIN_TOKENS` (required JSON array of token configs)
- `TRUSTED_PROXIES` (optional, comma-separated trusted proxy CIDRs/IPs or proxy-addr aliases like `loopback`)
  - default: **not set** → `trustProxy=false` (safe fallback)
  - example: `TRUSTED_PROXIES=127.0.0.1,10.0.0.0/8`

Token config example:

```json
[
  {
    "id": "core-write",
    "secretHash": "<sha256(secret)>",
    "expiresAt": "2099-01-01T00:00:00.000Z",
    "scopes": ["write:*"],
    "roleScopes": ["CEO", "Governor"]
  }
]
```

Optional actor attribution headers:

- `x-role`: `CEO` or `Governor`
- `x-user-id`: user id for audit attribution

Token revocation endpoint:

- `POST /auth/tokens/:id/revoke` (requires `auth:manage` scope)

### Proxy/IP trust and rate-limit attribution

- Backend no longer trusts all proxy headers by default.
- `request.ip` and write rate-limits are attributed to the socket peer unless `TRUSTED_PROXIES` is explicitly configured.
- This prevents unauthenticated clients from spoofing `X-Forwarded-For` to evade per-IP write limits.

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
