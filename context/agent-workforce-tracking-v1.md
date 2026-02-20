# Agent Workforce Tracking v1 (AetherBoard)

**Goal:** run and govern **20+ sub-agents** with clear ownership, low coordination overhead, and fast detection of failure/drift.

## 1) Roster Schema (lightweight, normalized)

Use one primary table (`agent_roster`) plus two supporting tables (`agent_assignments`, `agent_heartbeats`). Keep fields minimal but operationally complete.

### 1.1 `agent_roster`

| Field | Type | Required | Notes |
|---|---|---:|---|
| `agent_id` | string (ULID/UUID) | ✅ | Stable identifier across sessions |
| `agent_name` | string | ✅ | Human-readable label (`research-01`, `build-bot-3`) |
| `agent_type` | enum | ✅ | `main`, `subagent`, `specialist`, `watcher` |
| `capability_tags` | string[] | ✅ | e.g. `web_research`, `codegen`, `qa`, `ops` |
| `model_profile` | string | ✅ | Runtime/model preset used for predictability |
| `owner_id` | string | ✅ | Directly accountable owner (person or lead agent) |
| `team_id` | string | ✅ | Functional grouping (`platform`, `growth`, `support`) |
| `current_state` | enum | ✅ | Lifecycle state (see section 4) |
| `priority_tier` | enum | ✅ | `P0`, `P1`, `P2` determines SLA strictness |
| `cost_budget_daily` | number | ⛔ | Optional soft budget guardrail |
| `risk_level` | enum | ✅ | `low`, `medium`, `high` based on scope/tools |
| `created_at` | datetime | ✅ | Creation timestamp |
| `updated_at` | datetime | ✅ | Last metadata update |
| `last_seen_at` | datetime | ✅ | Last heartbeat or work event |
| `notes` | text | ⛔ | Freeform operational notes |

### 1.2 `agent_assignments` (current work ownership)

| Field | Type | Required | Notes |
|---|---|---:|---|
| `assignment_id` | string | ✅ | Unique assignment record |
| `agent_id` | string | ✅ | FK to roster |
| `workstream_id` | string | ✅ | Initiative/epic/bucket |
| `task_id` | string | ⛔ | Optional task ticket |
| `role_on_task` | enum | ✅ | `owner`, `contributor`, `reviewer`, `observer` |
| `start_at` | datetime | ✅ | Assignment start |
| `due_at` | datetime | ⛔ | Expected completion/SLA target |
| `status` | enum | ✅ | `active`, `blocked`, `handoff`, `done` |
| `blocker_code` | enum | ⛔ | `waiting_input`, `tool_error`, `dependency`, `policy` |
| `percent_complete` | int (0-100) | ⛔ | Lightweight progress signal |

### 1.3 `agent_heartbeats` (time-series)

| Field | Type | Required | Notes |
|---|---|---:|---|
| `heartbeat_id` | string | ✅ | Unique event id |
| `agent_id` | string | ✅ | FK to roster |
| `emitted_at` | datetime | ✅ | When heartbeat was sent |
| `status` | enum | ✅ | `ok`, `degraded`, `blocked`, `offline` |
| `work_mode` | enum | ✅ | `idle`, `executing`, `waiting`, `escalated` |
| `active_assignment_id` | string | ⛔ | Link to current assignment |
| `queue_depth` | int | ⛔ | Pending tasks count |
| `error_count_1h` | int | ⛔ | Short-window failure signal |
| `latency_p95_ms` | int | ⛔ | Optional responsiveness metric |
| `token_burn_1h` | int | ⛔ | Cost and runaway detection |
| `summary` | string | ⛔ | 1-line “what I’m doing/need” |

---

## 2) Reporting Lines (minimal hierarchy + escalation)

Use a **3-layer model** to avoid flat chaos:

1. **Workforce Manager (human or main orchestrator)**
   - Owns staffing strategy, priorities, and SLA policy.
2. **Pod Leads (3–6 leads for 20+ agents)**
   - Each lead manages a pod of ~4–7 agents by function.
3. **Execution Agents (specialists/subagents)**
   - Deliver tasks; escalate blockers quickly.

### Reporting rules

- Every agent must have exactly **one `owner_id`** (single throat to choke).
- Every agent may have **one `secondary_owner_id`** for coverage.
- Escalation path: `Agent -> Pod Lead -> Workforce Manager`.
- If blocked > SLA threshold, auto-escalate one level.
- Cross-pod work must designate one **DRI** (directly responsible individual).

---

## 3) Ownership Matrix (RACI-lite for agent operations)

Use lightweight RACI to prevent ambiguity.

| Activity | Workforce Manager | Pod Lead | Agent Owner | Specialist Agent | QA/Reviewer Agent |
|---|---|---|---|---|---|
| Agent creation/onboarding | A | R | C | I | I |
| Capability assignment | A | R | R | C | I |
| Task assignment/prioritization | A | R | R | C | I |
| Daily execution | I | C | A | R | C |
| Quality gate/review | I | C | A | C | R |
| Incident response (degraded/offline) | A | R | R | C | I |
| Lifecycle transitions | A | R | R | I | I |
| Budget/cost control | A | C | R | I | I |
| Retirement/archival | A | R | R | I | I |

Legend: **R** Responsible, **A** Accountable, **C** Consulted, **I** Informed.

---

## 4) Agent Lifecycle States (operational finite-state model)

Use explicit states and legal transitions.

### States

1. `registered` – identity created, not ready
2. `ready` – configured, available for assignment
3. `assigned` – has active assignment(s)
4. `executing` – currently doing work
5. `blocked` – cannot proceed without dependency/input
6. `degraded` – partial health/performance issues
7. `escalated` – issue raised to owner/lead
8. `paused` – intentionally stopped (maintenance/load shedding)
9. `retired` – intentionally removed from active workforce
10. `archived` – historical only, immutable except audit tags

### Allowed transitions (core)

- `registered -> ready`
- `ready -> assigned -> executing`
- `executing -> blocked -> escalated -> executing`
- `executing -> degraded -> executing`
- `executing/ready -> paused -> ready`
- `ready/paused -> retired -> archived`

### Governance rules

- No direct `executing -> archived` (must retire first).
- `blocked` older than threshold auto-transitions to `escalated`.
- `degraded` unresolved beyond threshold triggers reassignment recommendation.

---

## 5) SLA Heartbeat Model (for 20+ agents)

Keep it tiered and predictable.

### 5.1 Heartbeat cadence by priority

| Tier | Typical workload criticality | Heartbeat interval | Miss threshold | Escalate at |
|---|---|---:|---:|---:|
| `P0` | Critical path / customer-facing | 60s | 2 misses | 3 misses |
| `P1` | Important delivery work | 180s | 2 misses | 3 misses |
| `P2` | Background/non-urgent | 600s | 2 misses | 3 misses |

### 5.2 Heartbeat payload minimum

Required fields per ping:
- `agent_id`
- `emitted_at`
- `status` (`ok/degraded/blocked/offline`)
- `work_mode`
- `active_assignment_id` (nullable)
- `summary` (<= 140 chars)

### 5.3 SLA evaluation logic

- **Healthy:** heartbeat on time + `status=ok` + error budget within threshold.
- **At Risk:** one miss OR `status=degraded` OR elevated error rate.
- **Breach:** miss threshold reached OR `blocked` exceeds allowed duration.
- **Critical:** escalate threshold reached or repeated breaches in rolling window.

### 5.4 Breach policy

1. Mark agent `degraded` or `offline` automatically.
2. Notify owner + pod lead immediately.
3. If unacknowledged in N minutes, escalate to workforce manager.
4. Optionally trigger automatic failover/reassignment for P0/P1 work.

---

## 6) Dashboards & Alerts for AetherBoard

Build **3 dashboard layers**: executive, pod, and agent drill-down.

### 6.1 Executive dashboard (single-pane summary)

Widgets:
- Active agents by state (stacked count)
- SLA health: Healthy / At Risk / Breach / Critical
- Workload distribution by pod/team
- Top blockers by category
- Throughput trend (completed assignments/day)
- Cost burn vs daily budget

Purpose: quickly answer “Are we under control?”

### 6.2 Pod lead dashboard (operational)

Widgets:
- Pod roster with live state and last heartbeat age
- Assignment queue depth per agent
- Aging blocked tasks (by minutes/hours)
- Error hotspots (agents with highest failure density)
- Ownership gaps (agents with missing owner/secondary owner)

Purpose: rebalance work and clear blockers fast.

### 6.3 Agent detail view

Widgets:
- Timeline: state changes + heartbeats + incidents
- Current assignment + dependencies
- Last 20 summaries/status notes
- Performance strip (latency, errors, token burn)
- Action buttons: pause, reassign, escalate, retire

Purpose: diagnose one agent in <2 minutes.

### 6.4 Alert catalog (must-have)

**P1 alerts (immediate):**
- Heartbeat breach (miss threshold exceeded)
- Agent enters `offline` or repeated `degraded`
- P0 assignment blocked beyond threshold
- Ownerless active agent detected

**P2 alerts (batched/periodic):**
- Rising error trend in 1h/24h window
- Cost burn anomaly per agent/pod
- Queue depth imbalance (overloaded vs idle agents)
- Lifecycle hygiene issues (stale paused/retired-but-assigned)

---

## 7) Practical defaults for “20+ agents without chaos”

- Pod size target: **5 ± 2 agents** per lead.
- No agent without owner, tier, and capability tags.
- Default state timeout policies:
  - `blocked` > 15 min (P0), 45 min (P1), 2h (P2) => escalate
  - `degraded` > 10 min (P0), 30 min (P1), 90 min (P2) => incident
- Weekly hygiene routine:
  - Archive inactive agents
  - Revalidate owner mappings
  - Review top 5 recurring blocker codes

---

## 8) v1 Implementation Notes (lean rollout)

1. Launch with only the 3 core entities (`roster`, `assignments`, `heartbeats`).
2. Enforce mandatory fields at write-time (owner, tier, state).
3. Add dashboards before advanced automation.
4. Turn on auto-escalation only after baseline false-positive tuning.
5. Keep all state transitions auditable (who/what/when/reason).

This model is intentionally lightweight: strict ownership + explicit lifecycle + tiered heartbeats + focused alerts are sufficient to coordinate 20+ agents reliably without heavyweight enterprise process.