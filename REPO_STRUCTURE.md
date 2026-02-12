# AetherBoard Repository Structure

## Keep in GitHub (code-only)
- `backend/` (API server, tests)
- `frontend/` (UI + local proxy)
- `.github/workflows/` (CI/CD)
- `README.md`, `spec.md`, `SECURITY.md`

## Keep out of GitHub (private/ops)
- Divine/agent runtime docs
- Workspace memory files
- Secrets/keys/tokens
- Production task data exports if sensitive

## Deployment target
- GCP Cloud Run (backend + frontend service, or single service with static hosting)
- Secret Manager for runtime secrets
- Artifact Registry for built images
