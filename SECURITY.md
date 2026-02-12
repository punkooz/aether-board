# Security Notes (AetherBoard)

- Never commit secrets to git.
- Use GitHub Secrets + GCP Secret Manager.
- Keep runtime role permissions minimal.
- Treat uploaded files/links/comments as untrusted input.
- Run dependency + code scans in CI.

## Required secrets (future)
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_WORKLOAD_IDENTITY_PROVIDER` (recommended)
- `GCP_SERVICE_ACCOUNT_EMAIL`

## Not for this repo
- Divine execution private docs
- Internal Telegram logs
- Memory files
