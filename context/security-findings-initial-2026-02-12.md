# AetherBoard Initial Security Findings (Non-Destructive)

**Status:** Active  
**Owner:** White Hat Security Specialist  
**Date:** 2026-02-12  
**Method:** Architecture/doc/code review only (no destructive runtime testing)

## Executive Summary
A first-pass non-destructive review found multiple meaningful security gaps concentrated in authentication design, rate-limiting robustness, trust-proxy configuration, and data integrity controls. No exploit attempts were performed beyond static analysis.

Overall posture: **Moderate risk with several High findings requiring near-term remediation**.

---

## Findings

## F-001 — Shared Static Admin Token Without Rotation/Granularity
**Severity:** High  
**Area:** Backend auth model  
**Evidence:** `projects/aetherboard/backend/src/app.ts` (`requireAdmin`) and `projects/aetherboard/backend/README.md` auth model

### Observation
All write operations are protected by a single bearer token (`ADMIN_TOKEN`) with no expiry, no scoped privileges, no per-user token lifecycle, and no rotation mechanism defined.

### Impact
- Token compromise grants broad write control.
- Lack of token segmentation prevents least-privilege and clean revocation.

### Recommendation
- Move to short-lived signed tokens (JWT or equivalent) with role/scope claims.
- Add key rotation strategy and token revocation support.
- Segment permissions by action/resource where practical.

---

## F-002 — `trustProxy: true` May Permit IP Spoofing and Rate-Limit Bypass
**Severity:** High  
**Area:** Backend network trust / anti-abuse  
**Evidence:** `projects/aetherboard/backend/src/app.ts` (`Fastify({ ... trustProxy: true })`), rate-limit keying by `request.ip`

### Observation
`trustProxy` is globally enabled while rate limiting and audit IP attribution rely on `request.ip`. In misconfigured edge deployments, spoofed forwarding headers can alter perceived source IP.

### Impact
- Bypass or dilution of IP-based throttling.
- Reduced reliability of audit IP evidence.

### Recommendation
- Restrict trust proxy to known proxy hops/networks.
- Use edge-authenticated client IP headers only from trusted ingress.
- Add secondary limiter dimensions (token/user/resource) beyond IP.

---

## F-003 — In-Memory Rate Limiter Is Not Cluster-Safe and Lacks Eviction
**Severity:** Medium  
**Area:** Availability / abuse resistance  
**Evidence:** `projects/aetherboard/backend/src/app.ts` (`createRateLimit` Map)

### Observation
Limiter state is in-process memory and keyed by `ip:url` with no periodic cleanup of expired keys.

### Impact
- Multi-instance deployments can be bypassed via instance distribution.
- Potential unbounded memory growth under high-cardinality request patterns.

### Recommendation
- Use centralized limiter store (Redis/Memcache) for distributed consistency.
- Add TTL eviction sweep for stale keys.
- Define per-endpoint and per-principal policies.

---

## F-004 — Weak ID Generation Using `Math.random`
**Severity:** Medium  
**Area:** Identifier integrity  
**Evidence:** `projects/aetherboard/backend/src/lib/utils.ts` (`newId`)

### Observation
Resource IDs are generated with `Math.random()`, which is not cryptographically secure.

### Impact
- Predictability/collision risk for identifiers used in API object references.

### Recommendation
- Replace with cryptographically secure UUIDs (`crypto.randomUUID()`) or secure nanoid configuration.

---

## F-005 — Spec/Implementation Drift on Status Transition Rules
**Severity:** Medium  
**Area:** Insecure design / governance integrity  
**Evidence:**
- Spec: `projects/aetherboard/spec.md` section "Status Transition Rules"
- Implementation: `projects/aetherboard/backend/src/app.ts` (`statusTransitions`)

### Observation
Implementation allows `in-progress -> done` directly, while spec requires review gating and additional completion conditions.

### Impact
- Workflow integrity and control bypass risk.
- Potential for premature completion states without expected evidence.

### Recommendation
- Align code with canonical spec transition matrix.
- Enforce completion prerequisites (artifact or completion comment).
- Add transition rule tests.

---

## F-006 — File-Backed JSON Store Lacks Concurrency Safety
**Severity:** Medium  
**Area:** Data integrity  
**Evidence:** `projects/aetherboard/backend/src/lib/store.ts`

### Observation
Store reads/modifies/writes full JSON files without file locking/transaction semantics.

### Impact
- Lost updates and file corruption under concurrent writes.
- Integrity risk with parallel admin actions or scaled runtimes.

### Recommendation
- Move to transactional datastore (SQLite/Postgres) or implement write locks + append log.
- Add integrity checks/backups.

---

## F-007 — No Explicit Security Headers/TLS Enforcement in App Layer
**Severity:** Low  
**Area:** Secure defaults / hardening  
**Evidence:** `projects/aetherboard/backend/src/server.ts`, `app.ts`

### Observation
No explicit hardening middleware for security headers (CSP/HSTS/etc.) and no transport-enforcement controls at app level (expected to be handled by edge if deployed correctly).

### Impact
- Increased reliance on external infra correctness; easier misconfiguration risk.

### Recommendation
- Add baseline security headers middleware where applicable.
- Document mandatory TLS termination and secure proxy config in deploy runbooks.

---

## F-008 — Limited Secret and Logging Guardrails in Implementation Docs
**Severity:** Low  
**Area:** Operational security  
**Evidence:** `projects/aetherboard/SECURITY.md`, backend/frontend READMEs

### Observation
Security docs are present but minimal; missing concrete secret rotation cadence, incident response path, and secure logging constraints.

### Impact
- Process gaps during incident or team scaling.

### Recommendation
- Expand SECURITY.md with rotation policy, incident contacts, logging redaction standards, and release security checklist.

---

## Remediation Queue (Prioritized)

| Priority | Finding | Severity | Owner (Suggested) | Target |
|---|---|---|---|---|
| P0 | F-001 Static admin token model | High | Backend/Platform | 7 days |
| P0 | F-002 trustProxy + IP spoof/rate-limit bypass risk | High | Platform | 7 days |
| P1 | F-003 in-memory non-distributed limiter | Medium | Backend | 14 days |
| P1 | F-005 transition-rule drift vs spec | Medium | Backend + PM | 14 days |
| P1 | F-006 JSON store concurrency integrity | Medium | Backend | 21 days |
| P2 | F-004 non-crypto IDs | Medium | Backend | 21 days |
| P2 | F-007 header/TLS hardening controls | Low | Platform | 30 days |
| P2 | F-008 security runbook/doc maturity | Low | Security/Platform | 30 days |

---

## Positive Controls Observed
- Write endpoints are protected by auth check (`requireAdmin`).
- Admin writes are audited to `audits.json` with actor metadata.
- Basic input length/trim validation exists via `cleanText`.
- Rate limiting exists (though currently limited in robustness).

---

## Next Pass Recommendations
1. Execute staged runtime validation per `security-test-plan-v1.md` (auth bypass, rate-limit, injection smoke).
2. Add automated security test suite in CI for critical auth/transition controls.
3. Introduce threat model diagram for token trust boundary and proxy chain.
4. Re-run focused review after P0/P1 remediation.
