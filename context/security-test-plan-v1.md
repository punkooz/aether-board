# AetherBoard Security Test Plan v1

**Status:** Active  
**Owner:** White Hat Security Specialist  
**Last Updated:** 2026-02-12  
**Review By:** 2026-03-01  
**Canonical:** Yes  
**Depends On:** `projects/platform/context/whitehat-charter.md`

## 1) Objectives
- Validate core security controls for API/backend/frontend surfaces.
- Detect exploitable weaknesses early using non-destructive methods.
- Produce reproducible evidence and prioritized remediation.

## 2) Test Scope
Primary assets:
- Backend API: `projects/aetherboard/backend/src/**`
- Frontend proxy/server: `projects/aetherboard/frontend/server.js`
- Security docs + architecture assumptions: `projects/aetherboard/SECURITY.md`, `spec.md`

Environments:
- Preferred: local/dev first
- Staging: controlled validation
- Production: low-risk checks only, pre-approved

## 3) Methodology
- Threat-model driven + OWASP Top 10 coverage
- API abuse scenario testing
- AuthZ/AuthN bypass attempts
- Rate-limit and DoS resilience simulation (safe-mode)
- Input validation/injection checks
- Evidence-led reporting with severity and fix queue

## 4) OWASP Top 10 Coverage Matrix

## A01 Broken Access Control
Tests:
- Attempt write endpoints without bearer token.
- Attempt role-restricted actions with downgraded role.
- Validate object-level access controls where IDs are user-supplied.
Expected:
- 401/403 on unauthorized writes; no privilege escalation.

## A02 Cryptographic Failures
Tests:
- Confirm no secrets in repo/logs.
- Confirm token handling avoids accidental exposure in responses/errors.
- Verify TLS expectations for non-local deployment.
Expected:
- No plaintext secret leakage; secure transport enforced in deployed environments.

## A03 Injection
Tests:
- Inject SQL/NoSQL-like strings into all string inputs.
- Script injection payloads in comments/messages.
- Path/query injection attempts in proxy and API filters.
Expected:
- Inputs treated as data; no command/query execution side-effects.

## A04 Insecure Design
Tests:
- Review privilege model against spec and intended roles.
- Check status transition logic for governance/security bypass.
Expected:
- Business logic enforces intended controls with no unsafe shortcuts.

## A05 Security Misconfiguration
Tests:
- Verify host binding/exposure assumptions.
- Check trust proxy settings, security headers, and safe defaults.
- Validate admin mode behavior when env vars missing.
Expected:
- Fail-safe defaults; no insecure dev defaults in production.

## A06 Vulnerable and Outdated Components
Tests:
- Run dependency audit (`npm audit`/SCA in CI) for backend/frontend.
Expected:
- Known critical/high CVEs tracked and remediated.

## A07 Identification and Authentication Failures
Tests:
- Token missing/invalid/expired behavior.
- Brute-force simulation at safe volume.
- Verify no alternate unauthenticated write path.
Expected:
- Consistent auth enforcement and lockout/rate-limit behavior.

## A08 Software and Data Integrity Failures
Tests:
- Check build/deploy integrity assumptions.
- Verify seed/data loading paths are constrained and predictable.
Expected:
- No unsigned/unverified high-risk update channels.

## A09 Security Logging and Monitoring Failures
Tests:
- Validate audit trail generated for privileged operations.
- Confirm logs contain actor + action + timestamp, without secret leakage.
Expected:
- Sufficient forensic logging for writes and state transitions.

## A10 SSRF
Tests:
- Review URL-fetch/proxy behaviors and any user-controlled outbound requests.
Expected:
- No unrestricted server-side fetch to arbitrary internal resources.

## 5) API Abuse Test Cases
- Excessive object creation (tasks/comments/messages) to test throttling consistency.
- Enumeration attempts on ID-based resources.
- Query parameter fuzzing for filter endpoints.
- Replay of prior valid write requests.

Pass criteria:
- 429 behavior for abusive request rates.
- No unauthorized data mutation or hidden admin behavior.

## 6) Auth Bypass Test Cases
- Write request without `Authorization` header.
- `Authorization: Bearer invalid`.
- Role spoof via `x-role` with invalid/malicious values.
- Attempt Governor-to-done or other restricted transitions.

Pass criteria:
- Restricted actions blocked with explicit 401/403.
- Header spoofing does not grant unexpected privilege.

## 7) Rate-Limit Test Plan
Safe strategy:
- Burst test: 20-100 requests/minute per endpoint in dev/staging.
- Multi-source simulation (different IP headers only in controlled env) to test bypass resistance.
- Monitor memory/latency while limits engage.

Pass criteria:
- Deterministic 429 responses after threshold.
- No memory growth risk from limiter keying strategy.

## 8) DoS Simulation Strategy (Non-Destructive)
- Phase 1 (local): CPU/memory profiling under controlled burst.
- Phase 2 (staging): short duration (1-3 min), capped concurrency.
- Phase 3 (optional): production canary (very low rate, pre-approved only).

Controls:
- Immediate stop threshold on elevated error rate/latency.
- On-call contact and rollback path defined before run.

## 9) Injection Test Suite
Payload families:
- SQL/NoSQL-like: `' OR '1'='1`, `{"$ne":null}`
- Script: `<script>alert(1)</script>`, `"><img src=x onerror=alert(1)>`
- Template/control chars: `${7*7}`, `..%2f..%2f`
- JSON edge cases: deeply nested arrays/objects, oversize strings

Validation points:
- Title/description/comment/message/agent fields
- URL/query params and path params

## 10) Evidence Format (Required)
Per test/finding capture:
- Test ID + timestamp (UTC)
- Target endpoint/component + environment
- Request/response (sanitized)
- Observed behavior
- Expected behavior
- Verdict (Pass/Fail/Needs Review)
- If failing: severity + remediation recommendation

Suggested file naming:
- `security-evidence-<area>-YYYY-MM-DD.md`
- `security-findings-<cycle>-YYYY-MM-DD.md`

## 11) Execution Cadence
- Baseline full pass: every release candidate
- Delta checks: after auth, routing, or data-model changes
- Weekly lightweight regression: auth + rate-limit + injection smoke

## 12) Exit Criteria for v1
- OWASP Top 10 checklist executed
- Critical/high findings remediated or mitigated with owner-approved exception
- Evidence package complete and reproducible
