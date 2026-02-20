# Remediation F-002 Status — 2026-02-12

## Scope Completed
P0 remediation F-002 for proxy/IP trust hardening and limiter attribution is implemented.

## Changes Made

### 1) Removed unsafe proxy trust default
- Updated backend app bootstrap to stop trusting all proxies by default.
- `trustProxy` is now derived from explicit config (`TRUSTED_PROXIES`) with safe fallback to `false`.

**File:** `backend/src/app.ts`

### 2) Added explicit trusted proxy configuration + safe fallback
- Added `TRUSTED_PROXIES` parsing/validation logic:
  - accepts comma-separated entries
  - supports explicit IPs, CIDR ranges, and proxy-addr aliases (`loopback`, `linklocal`, `uniquelocal`)
  - treats empty/disabled values (`false`, `off`, `none`, `0`) as no trust
  - invalid-only config falls back to `trustProxy=false` with warning
  - partially invalid config uses only valid entries with warning

**File:** `backend/src/app.ts`

### 3) Hardened limiter attribution keying
- Updated write limiter key from:
  - `ip + raw url`
- To:
  - `ip + method + normalized route id`
- Route attribution now uses `request.routeOptions.url` (or path fallback) to avoid query-string key fragmentation/evasion.

**File:** `backend/src/app.ts`

### 4) Added spoofed-header regression tests
- Added tests to cover:
  1. **Safe fallback mode** (no trusted proxies): spoofed `X-Forwarded-For` does **not** bypass per-IP write limiter.
  2. **Explicit trusted proxy mode** (`TRUSTED_PROXIES=127.0.0.1`): forwarded client IP attribution works as intended; different forwarded client IPs are separated.
- Also added cleanup for `TRUSTED_PROXIES` env between tests.

**File:** `backend/test/app.test.ts`

### 5) Updated run/deploy docs
- Backend run docs now document `TRUSTED_PROXIES` behavior, defaults, examples, and security rationale.
- Deploy plan now includes:
  - explicit backend env/secrets list
  - `TRUSTED_PROXIES` guidance
  - note to provide `ADMIN_TOKEN` via Secret Manager
  - updated `gcloud run deploy` example with `--set-env-vars`.

**Files:**
- `backend/README.md`
- `deploy/gcp-deploy-plan.md`

## Validation
- `npm test` (backend): **pass** (5/5 tests)
- `npm run build` (backend TypeScript compile): **pass**

## Outcome
F-002 remediation objectives are met:
- unsafe proxy trust defaults removed
- explicit trusted proxy configuration added
- safe fallback behavior enforced
- spoofed header behaviors covered by automated tests
- run/deploy documentation updated accordingly
