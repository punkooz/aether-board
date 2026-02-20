# AetherBoard F-001 Remediation Status (2026-02-12)

## Outcome
✅ Implemented P0 remediation F-001 in backend.

## What changed

### 1) Replaced shared static `ADMIN_TOKEN` model
- Removed single-token equality check in `src/app.ts`.
- Added structured token validation via new module: `src/lib/auth.ts`.
- New required env var: `ADMIN_TOKENS` (JSON array of token definitions).

### 2) Added scoped + rotatable token design
- Bearer format is now: `<tokenId>.<secret>`.
- Token definitions include:
  - `id` (token identifier)
  - `secretHash` (SHA-256 hash of secret)
  - `expiresAt` (ISO timestamp)
  - `scopes` (permission scopes, wildcard supported as `resource:*`)
  - `roleScopes` (`CEO` / `Governor` allowed actor roles)
- Multiple active token definitions supported simultaneously (rotation-ready).

### 3) Hashed secret verification
- Token secret is hashed at request time and compared against `secretHash` using constant-time compare (`timingSafeEqual`).
- Plaintext shared secret is no longer stored/compared server-side.

### 4) Expiry + revocation list enforcement
- Expiry is checked on every protected request.
- Added persisted revocation list store:
  - `data/revoked-tokens.json`
  - Type: `RevokedToken` added in `src/types.ts`
- Added revocation endpoint:
  - `POST /auth/tokens/:id/revoke` (requires `auth:manage` scope)
- Revoked token IDs are denied on all subsequent requests.

### 5) Role + scope authorization checks
- All write endpoints now require `write:core` (satisfied by `write:*`).
- `/audits` now requires `read:audit` scope.
- Actor role (`x-role`) must be included in token `roleScopes`.

## Tests
Updated and expanded tests in `test/app.test.ts` to cover:
- Public read + protected writes
- Scoped write token behavior across task lifecycle/comments
- Role-scope denial (`Governor` with CEO-only token)
- Missing permission scope denial
- Expired token denial
- Token revocation flow + post-revocation denial

Result:
- `npm test` ✅ pass
- `npm run build` ✅ pass

## Migration note

### Breaking changes
1. `ADMIN_TOKEN` is no longer used for auth.
2. Clients must send bearer as `<tokenId>.<secret>`.

### Required migration actions
1. Generate per-token secrets.
2. Compute SHA-256 hashes for each secret.
3. Populate `ADMIN_TOKENS` JSON with `id`, `secretHash`, `expiresAt`, `scopes`, `roleScopes`.
4. Update clients to send `Authorization: Bearer <id>.<secret>`.
5. Remove old `ADMIN_TOKEN` from deployment env.

### Suggested stage-appropriate token split
- `core-write` → scopes: `write:*`, roles: `CEO`,`Governor`
- `audit-read` → scopes: `read:audit`, roles: `CEO`
- `auth-manager` → scopes: `auth:manage`, roles: `CEO`

## Files touched
- `backend/src/lib/auth.ts` (new)
- `backend/src/app.ts`
- `backend/src/types.ts`
- `backend/test/app.test.ts`
- `backend/test/app.test.js` (neutralized legacy duplicate)
- `backend/README.md`
