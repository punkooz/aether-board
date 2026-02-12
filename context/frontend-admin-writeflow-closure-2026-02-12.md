# Frontend/Admin Write-Flow Closure — 2026-02-12

## 1) Current behavior (as-built)

### Frontend (`frontend/index.html`, `frontend/app.js`)
- UI is effectively **read-only**:
  - Board/task/agents/rooms/milestones/reviews are fetched via `GET` calls.
  - No create/edit/transition/comment/message/milestone submit controls exist.
- Frontend sends fixed headers on all requests:
  - `x-role: CEO`
  - `x-user-id: sameer`
- Frontend does **not** send `Authorization: Bearer <ADMIN_TOKEN>`.

### Backend (`backend/src/app.ts`)
- Read endpoints are public (`GET`).
- All write endpoints are protected by `requireAdmin` + `writeRateLimit`:
  - Require `ADMIN_TOKEN` configured.
  - Require `Authorization: Bearer <ADMIN_TOKEN>` on each write.
  - Optional actor attribution from `x-role` / `x-user-id`.
- Role gate currently enforced:
  - Governor cannot transition task directly to `done`.

## 2) Gaps causing write-flow break

1. **Frontend cannot perform any write action** (no write UI wired).
2. **Auth mismatch** for writes:
   - Frontend never provides bearer token.
   - Any future frontend write call will fail 401/403 until token path exists.
3. **Doc drift**:
   - Frontend README still references stale endpoint shapes (`/rooms/:id/feed`, `/reviews?queue=ceo`) vs actual backend (`/rooms/:id/messages`, reviews derived from `/tasks?status=review`).
4. **No frontend write-flow tests** (only backend write-path tests currently exist).

## 3) Exact next implementation steps

## Phase A — unblock secure write path (minimum)
1. Add admin token input + local storage in frontend topbar:
   - New key: `aetherboard_admin_token`.
   - Masked input + save button.
2. Introduce shared request helpers:
   - `fetchJson(path)` for read.
   - `fetchJsonWrite(path, method, body)` for writes.
   - `fetchJsonWrite` adds `Authorization: Bearer <token>` only when token present.
3. Add explicit UI error handling for write auth failures:
   - 401/403 => show “Admin token missing/invalid”.

## Phase B — add minimal admin write controls
4. Task tab:
   - Add “Create task” form (title, description, assignee optional) -> `POST /api/tasks`.
   - Add task status transition control -> `POST /api/tasks/:id/transition`.
   - Add comment composer -> `POST /api/tasks/:id/comments`.
5. Rooms tab:
   - Add message composer for selected room -> `POST /api/rooms/:id/messages`.
6. Milestones tab:
   - Add milestone create form -> `POST /api/milestones`.
7. (Optional for this cleanup pass) Add agent create/edit and room create forms.

## Phase C — correctness + docs
8. Update frontend README endpoint contract to match backend reality.
9. Add frontend smoke tests (Playwright) for write journey:
   - create task -> transition -> comment -> room message -> milestone.
10. Re-run backend tests and frontend smoke in CI/local predeploy script.

## 4) Redeploy gates (must-pass)

## Build/Test gates
- [ ] `backend`: `npm test` passes.
- [ ] `backend`: `npm run build` passes.
- [ ] `frontend`: app boots and loads all read tabs without console errors.
- [ ] Frontend write smoke tests pass (automated Playwright or deterministic scripted checks).

## Security gates
- [ ] `ADMIN_TOKEN` set in deploy env and length policy met.
- [ ] No token hardcoded in frontend source or committed docs.
- [ ] Token stored only client-side by operator choice; not logged to console.

## Functional gates (manual spot-check)
- [ ] Create task from UI succeeds (201) and appears on board.
- [ ] Transition task respects transition matrix and role restrictions.
- [ ] Comment submit succeeds and appears in task thread.
- [ ] Room message submit succeeds and appears in room feed.
- [ ] Milestone submit succeeds and appears in milestones list.
- [ ] Invalid/missing token shows clear UX error, no silent failure.

## Release gate
- [ ] QA proof doc updated with post-fix evidence (commands + screenshots + API responses).

## 5) Closure status
- **Status today:** write-flow cleanup **not closed yet** (read-only frontend + auth mismatch).
- **Closure condition:** complete Phase A+B+C and pass all redeploy gates above.