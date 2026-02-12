# Aetherboard GCP Cost-Safe Runbook (Start → Test → Stop)

**Goal:** Run dev/test workloads only when needed, then shut everything down cleanly.  
**Audience:** DevOps / Engineers running manual or scripted test cycles.  
**Mode:** Free-tier + low-credit safe operations.

## 0) Preflight (2 minutes)

- Confirm you are in **non-prod** project.
- Confirm budget remaining and active alerts.
- Confirm no long-running resources from previous session.

```bash
# Set target project
export PROJECT_ID="your-dev-project"
gcloud config set project "$PROJECT_ID"

# Quick sanity: list running compute VMs
gcloud compute instances list --filter="status=RUNNING" --format="table(name,zone,machineType,status,labels.owner)"
```

## 1) Start Phase (only what you need)

## 1.1 Start VM(s) only if required

```bash
# Start one VM
gcloud compute instances start INSTANCE_NAME --zone=ZONE

# Or start by label (example via shell loop)
for vm in $(gcloud compute instances list \
  --filter="labels.env=test AND labels.service=aetherboard" \
  --format="value(name,zone)"); do
  name=$(echo "$vm" | awk '{print $1}')
  zone=$(echo "$vm" | awk '{print $2}')
  gcloud compute instances start "$name" --zone="$zone"
done
```

## 1.2 Deploy serverless with scale-to-zero

```bash
# Cloud Run deploy (example safe defaults)
gcloud run deploy aetherboard-api \
  --image=REGION-docker.pkg.dev/$PROJECT_ID/repo/aetherboard:TAG \
  --region=REGION \
  --platform=managed \
  --min-instances=0 \
  --max-instances=2 \
  --cpu=1 \
  --memory=512Mi \
  --timeout=60 \
  --allow-unauthenticated
```

## 1.3 Stamp TTL metadata (required)

```bash
# Example labels for ephemeral run
gcloud compute instances add-labels INSTANCE_NAME \
  --zone=ZONE \
  --labels=env=test,owner=YOUR_NAME,service=aetherboard,ttl_hours=4
```

> Also record planned stop time in your team channel/ticket.

## 2) Test Phase (bounded)

- Set explicit test window (e.g., 60–120 min).
- Avoid load tests unless approved.
- Monitor usage every 30 min.

```bash
# Check currently running VMs
gcloud compute instances list --filter="status=RUNNING" --format="table(name,zone,status,lastStartTimestamp)"

# Check Cloud Run revision/service summary
gcloud run services list --region=REGION
```

## 3) Stop Phase (mandatory cleanup immediately after tests)

## 3.1 Stop compute instances

```bash
# Stop one VM
gcloud compute instances stop INSTANCE_NAME --zone=ZONE

# Stop all running test VMs by label
while read -r name zone; do
  gcloud compute instances stop "$name" --zone="$zone"
done < <(gcloud compute instances list \
  --filter="status=RUNNING AND labels.env=test AND labels.service=aetherboard" \
  --format="value(name,zone)")
```

## 3.2 Scale Cloud Run back to safe caps

```bash
# Keep min at zero, optionally reduce max after testing
gcloud run services update aetherboard-api \
  --region=REGION \
  --min-instances=0 \
  --max-instances=1
```

## 3.3 Clean transient artifacts (if created)

```bash
# Example: list old images/artifacts for manual cleanup policy
gcloud artifacts docker images list REGION-docker.pkg.dev/$PROJECT_ID/repo --include-tags
```

## 3.4 Post-run verification (required)

```bash
echo "Running VMs (should be none for aetherboard test):"
gcloud compute instances list \
  --filter="status=RUNNING AND labels.service=aetherboard AND labels.env=test" \
  --format="table(name,zone,status)"
```

If anything is still running unintentionally: stop it now.

## 4) Nightly Safety Net (automation)

Set a Cloud Scheduler job (or CI nightly workflow) to stop test resources.

Minimum nightly actions:
- stop VMs labeled `env=test`
- enforce Cloud Run `min-instances=0`
- notify team with stopped resource summary

## 5) Fast Incident Procedure (unexpected spend spike)

1. Freeze non-essential test deployments.
2. Stop all non-prod running VMs.
3. Reduce Cloud Run max instances to minimal safe values.
4. Review top spend services in billing export/console.
5. Open incident note with owner + root cause within 24h.

## 6) Operator Checklist (copy into PR or ticket)

- [ ] Correct non-prod project selected
- [ ] Budget headroom checked
- [ ] Only required resources started
- [ ] TTL/owner labels applied
- [ ] Test window stayed within plan
- [ ] All VMs stopped post-test
- [ ] Cloud Run min instances confirmed at 0
- [ ] Post-run verification captured

---

**Golden rule:** If testing is done, compute must be off.