# AETHER Security Gate — 2026-02-20

Status: **PASS**

Scope verified:
1. Internal-only exposure
2. Write auth enforcement
3. Rate limiting
4. Audit endpoint protection
5. No public tunnel exposure

## Evidence summary

- Internal exposure: backend listener bound to loopback (`127.0.0.1:3000`) at validation time.
- Write auth: unauthenticated write attempts return `401 Unauthorized`.
- Rate limit: burst write test crosses threshold and returns `429 Too many requests`.
- Audit endpoint: unauthenticated `GET /audits` returns `401 Unauthorized`; protected by `read:audit` scope.
- Public tunnel: no active `cloudflared/ngrok/frpc/localtunnel/serveo` process detected at check time.

## Related implementation references

- `backend/src/lib/auth.ts` — token hash verify, expiry, revocation, scope + role enforcement.
- `backend/src/app.ts` — write route guards (`requireScope('write:core')`), write limiter, protected `/audits` route.

## Residual non-blocking hardening

- Prefer explicit loopback port mapping in compose (`127.0.0.1:3000:3000`, `127.0.0.1:5173:5173`) for safer defaults outside hardened hosts.
