# AETHER Stack Recovery + Hardened Re-enable Proof

Timestamp (UTC): 2026-02-20
Operator: subagent

## Scope executed
1. Recovered/reused existing repo + artifacts (no reset, no rebuild).
2. Re-enabled hardened setup in runtime:
   - internal ingress (local-only bind)
   - admin-token-gated writes
   - write rate limiting
   - audit trail logging
3. Validated with command/output evidence.

## 1) Recovery / reuse evidence
- Repo path: `projects/aetherboard`
- Existing build artifacts reused: `backend/dist/*` (used `npm start`, no `npm run build` executed)
- Existing dependencies reused: `backend/node_modules/*`
- Git state snapshot:
  - branch: `main`
  - head: `4c49e27`
  - dirty files count: `14`

## 2) Hardened runtime enablement
Backend launched with:
- `HOST=127.0.0.1`
- `PORT=3000`
- `DATA_DIR=/home/clawd/.openclaw/workspace/projects/aetherboard/backend/data`
- `TRUSTED_PROXIES=127.0.0.1`
- `ADMIN_TOKENS=<scoped JSON token set>`

Start command:
```bash
cd projects/aetherboard/backend
PORT=3000 HOST=127.0.0.1 DATA_DIR=/home/clawd/.openclaw/workspace/projects/aetherboard/backend/data \
TRUSTED_PROXIES=127.0.0.1 ADMIN_TOKENS="$(cat /tmp/aether_admin_tokens.json)" npm start
```

Listener proof:
```text
LISTEN 0 511 127.0.0.1:3000 0.0.0.0:* users:(("node",pid=421507,fd=21))
```

## 3) Validation commands + results
Base URL: `http://127.0.0.1:3000`

### Health + read
- `GET /health` => `200`
- `GET /tasks` => `200`

### Admin-token-gated writes
- `POST /tasks` without auth => `401`
- `POST /tasks` with scoped bearer `core-write.<secret>` + role header => `201`

### Rate limit proof
- 90 rapid unauthenticated write attempts to `POST /tasks`
- `429` responses observed: `12`

### Audit trail proof
- `GET /audits` with `audit-read.<secret>` + CEO role => `200`
- `backend/data/audits.json` snapshot:
  - `AUDIT_COUNT=4`
  - `AUDIT_LAST_ACTION=create`
  - `AUDIT_LAST_ACTOR=Governor:gov-1`

## Result status
- Internal ingress (local-only bind): PASS
- Token-gated writes: PASS
- Rate limit: PASS
- Audit trail: PASS

## Security reviewer coordination status
- Evidence package prepared in this file for Security review signoff.
- Reviewer final binary decision pending explicit reviewer response.

## Notes / constraint
- Cloud ingress-level validation (e.g., Cloud Run `--ingress internal`) not executed in this environment because `gcloud` CLI is unavailable (`EXIT=127`).
- Local internal-ingress equivalent was enforced via `HOST=127.0.0.1` and verified at socket level.
