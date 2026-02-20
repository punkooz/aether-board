# AETHER Stack Security Gate — 2026-02-20 02:10 UTC

## Verdict: **PASS**

All required controls passed on the restored runtime observed on host.

## Evidence by control

1) **Internal-only exposure — PASS**
- Runtime listener check:
  - `ss -ltnp | grep -E ':(3000|5173)\s'`
  - Output: `LISTEN ... 127.0.0.1:3000 ...`
- Result: backend is loopback-only (`127.0.0.1`), not publicly bound.

2) **Write auth enforcement — PASS**
- Unauthenticated write attempt:
  - `POST /rooms` without bearer token
  - Response: `401 {"error":"Unauthorized. Bearer token required."}`
- Code evidence:
  - `backend/src/app.ts`: write routes use `preHandler: [writeRateLimit, requireScope('write:core')]`
  - `backend/src/lib/auth.ts`: bearer token validation + scope + role + expiry + revocation checks.

3) **Rate limiting — PASS**
- Burst test (85 unauthenticated writes to `/tasks`):
  - Result counts: `{401: 80, 429: 5}`
- Confirms limiter active and returning `429 Too many requests` after threshold.
- Code evidence:
  - `createRateLimit(80, 60_000)` and `writeRateLimit` applied on write endpoints.

4) **Audit endpoint protection — PASS**
- Unauthenticated audit read attempt:
  - `GET /audits`
  - Response: `401 {"error":"Unauthorized. Bearer token required."}`
- Code evidence:
  - `backend/src/app.ts`: `app.get('/audits', { preHandler: requireScope('read:audit') }, ...)`

5) **No public tunnel exposure — PASS**
- Tunnel process sweep:
  - `ps aux | grep -E 'cloudflared|ngrok|frpc|localtunnel|serveo' | grep -v grep`
  - Output: none
- No active tunnel client detected.

---

## Residual non-blocking notes
- `docker-compose.yml` maps `3000:3000` and `5173:5173`; if compose is used directly in non-firewalled environments, bind hardening is recommended (e.g., `127.0.0.1:3000:3000`, `127.0.0.1:5173:5173`).
- Current gate verdict remains **PASS** for the restored runtime state validated above.