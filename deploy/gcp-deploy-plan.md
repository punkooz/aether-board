# AetherBoard GCP Deploy Plan (First Deploy)

Status: Execution-ready
Last updated: 2026-02-12 UTC

---

## 1) Deployment Objective

Deploy AetherBoard MVP to GCP with minimal recurring cost and fast rollback.

Target stack:
- Cloud Run (backend)
- Cloud Run or static hosting for frontend
- Artifact Registry
- Cloud Build
- Secret Manager
- Cloud Logging

Region: `us-central1`

---

## 2) Preflight (Blockers First)

- [ ] Sameer grants required IAM roles (see `projects/platform/context/gcp-blockers-and-access.md`)
- [ ] Billing account linked to project
- [ ] Budget alerts configured
- [ ] APIs enabled: Run, Build, Artifact Registry, Secret Manager, Logging, IAM, Cloud Resource Manager

---

## 3) Deploy Strategy

### Phase 0 (Today): Backend only, public endpoint

1. Build backend container from `projects/aetherboard/backend`
2. Push image to Artifact Registry
3. Deploy Cloud Run service `aetherboard-backend`
4. Set environment variables and secrets
5. Smoke test `/health` and core APIs

Runtime defaults:
- CPU 1
- Memory 512Mi
- Min 0, Max 3
- Concurrency 80
- Timeout 30s

### Phase 1: Frontend deploy

Option A (fastest): deploy frontend as second Cloud Run service (`aetherboard-frontend`)
Option B (cheapest static): Cloud Storage static hosting (+ optional Cloud CDN)

Initial recommendation: Option A for speed, then migrate to static hosting if desired.

### Phase 2: Hardening

- Add custom domain + HTTPS mapping
- Add uptime check
- Add basic auth/rate limiting middleware if public internet traffic increases

---

## 4) Concrete Command Skeleton (Operator-Run)

```bash
# Set project
PROJECT_ID="<sameer-project-id>"
REGION="us-central1"
REPO="aetherboard"

gcloud config set project "$PROJECT_ID"

# Enable required APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com logging.googleapis.com

# Create Artifact Registry repo (once)
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="AetherBoard images"

# Build and push backend
cd projects/aetherboard/backend
gcloud builds submit --tag "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/backend:$(date +%Y%m%d-%H%M%S)"

# Deploy backend
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/backend:<tag>"
gcloud run deploy aetherboard-backend \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --concurrency 80 \
  --timeout 30 \
  --set-env-vars "TRUSTED_PROXIES=127.0.0.1"
```

`ADMIN_TOKEN` should be provided via Secret Manager binding to an env var at deploy time.


---

## 5) Secrets Plan

Initial backend env/secrets:
- `ADMIN_TOKEN` (**required**, secret)
- `TRUSTED_PROXIES` (optional, non-secret; explicit list only, e.g. `127.0.0.1,10.0.0.0/8`)
- `AETHERBOARD_API_KEY` (if used)
- any external integration key

Rules:
- store secrets in Secret Manager
- mount secrets via Cloud Run secret env refs
- pass non-secret runtime config as normal env vars
- do not commit `.env` production secrets

---

## 6) Verification Checklist

- [ ] `/health` returns 200
- [ ] `GET /tasks` returns expected schema
- [ ] create/update/transition task works
- [ ] logs show no crash loops
- [ ] billing dashboard shows expected near-zero baseline after idle period

---

## 7) Rollback Plan

If bad release:
1. Cloud Run -> Revisions
2. Shift traffic to previous healthy revision (100%)
3. Keep faulty revision for diagnosis, then delete

Expected rollback time: < 5 minutes

---

## 8) Day-2 Plan (after first live traffic)

- Migrate JSON persistence to Firestore for durability
- Add auth hardening beyond placeholder headers
- Add CI pipeline with deploy only from protected branch
- Add staging environment
