# AetherBoard

**AetherBoard** is an MVP universal tracker for agent orgs and execution pods.

It is designed to work for any multi-agent project (not just DivineSelfie), with first-cut primitives for:
- tasks/tickets with lifecycle status
- owners (human + agent)
- comments and artifact links
- agent profiles
- room model (common room + pod rooms)
- milestone feed

This folder contains:
- `spec.md` — concrete implementation spec (data model, APIs, flows, seeded data)

---

## MVP Scope (v0)

### 1) Tasks / Tickets
Each ticket has:
- `id`, `title`, `description`
- `status`: `todo | in-progress | review | done | blocked`
- `ownerId` (single current owner)
- optional `watcherIds`
- `artifactLinks` (docs, PRs, dashboards)
- `comments`
- timestamps + lightweight audit trail

### 2) Agent Profiles
Profiles represent humans or agents and include:
- canonical id (`agent:...` or `human:...`)
- display name, role, team/pod
- capabilities/tags
- status (`active`, `paused`, `archived`)

### 3) Rooms
Room types:
- `common` (global coordination)
- `pod` (focused track, e.g., engineering/design/marketing)

Rooms can host ticket discussions and milestone announcements.

### 4) Milestone Feed
Append-only event feed for project-level moments:
- kickoff
- council decisions
- blocker raised/cleared
- launch gates
- sprint rollups

---

## Why this shape

AetherBoard intentionally starts with the minimum structure required to run real cross-functional execution:
- clear ownership
- explicit status transitions
- documented decisions
- artifact traceability
- team-room context

This keeps the system reusable across domains (product, GTM, infra, research orgs).

---

## Initial Seed (Derived from Divine docs)

The spec includes first seeded entities sourced from Divine project docs:
- org hierarchy from `context/21-org-chart.md` and `context/33-agent-tree-index.yaml`
- execution tickets from:
  - `context/40-eng-execution-board.md`
  - `context/41-design-execution-board.md`
  - `context/42-marketing-execution-board.md`
- milestone entries for council and execution checkpoints

See **`spec.md` → Seeded Data (v0 Divine Import)**.

---

## MVP Non-goals

- no complex permissions matrix (simple role flags only)
- no full chat replacement (comments + room timeline only)
- no gantt/dependency optimizer
- no external integrations required for first runnable cut

---

## Quick Start (Implementation Order)

1. Create storage using schema in `spec.md`
2. Implement core CRUD endpoints for agents, tickets, comments, milestones, rooms
3. Enforce status transition rules
4. Load Divine seed set
5. Render basic board views:
   - by status (kanban)
   - by owner
   - by room/pod
   - milestone timeline

That is enough for a real MVP used by an active agent org.
