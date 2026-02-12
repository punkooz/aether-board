# AetherBoard MVP Spec (v0)

Date: 2026-02-12  
Target path: `projects/aetherboard/`  
Goal: ship a universal, reusable agent-org tracker MVP with concrete models + seed data.

---

## 1) Product Definition

AetherBoard is a lightweight operating layer for agent organizations.

It tracks:
1. **Who** is in the org (agent profiles)
2. **What** work exists (tickets/tasks)
3. **Where** coordination happens (common room + pod rooms)
4. **When** key outcomes happened (milestone feed)

---

## 2) Core Domain Model

## 2.1 Enums

```ts
export type TicketStatus =
  | 'todo'
  | 'in-progress'
  | 'review'
  | 'done'
  | 'blocked';

export type ActorType = 'agent' | 'human' | 'system';
export type RoomType = 'common' | 'pod';
export type ProfileState = 'active' | 'paused' | 'archived';
```

## 2.2 Entities

### AgentProfile
```ts
interface AgentProfile {
  id: string;                 // e.g., agent:main:main
  actorType: ActorType;       // agent | human
  displayName: string;        // Ooz
  role: string;               // CEO/Governor, PM-1, Design Pillar
  pod: string | null;         // leadership | engineering | design | marketing
  capabilities: string[];     // ['governance', 'architecture']
  state: ProfileState;        // active | paused | archived
  createdAt: string;
  updatedAt: string;
}
```

### Room
```ts
interface Room {
  id: string;                 // room:common / room:pod:engineering
  type: RoomType;             // common | pod
  name: string;               // Common Room, Engineering Pod
  description: string;
  memberIds: string[];        // AgentProfile ids
  createdAt: string;
  updatedAt: string;
}
```

### Ticket
```ts
interface Ticket {
  id: string;                 // AB-ENG-001
  title: string;
  description: string;
  status: TicketStatus;
  ownerId: string | null;     // active owner profile id
  watcherIds: string[];
  roomId: string;             // routing to common/pod room
  tags: string[];             // ['engineering', 'checkout']
  artifactLinks: ArtifactLink[];
  sourceRefs: SourceRef[];    // source docs for seeded/backfilled tickets
  comments: Comment[];
  blockedBy: string[];        // ticket ids or blocker tokens
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Comment
```ts
interface Comment {
  id: string;
  ticketId: string;
  authorId: string;           // profile id
  body: string;
  createdAt: string;
}
```

### ArtifactLink
```ts
interface ArtifactLink {
  id: string;
  label: string;
  url: string;                // local path or external URL
  type: 'doc' | 'spec' | 'dashboard' | 'pr' | 'runbook' | 'other';
}
```

### SourceRef
```ts
interface SourceRef {
  path: string;               // e.g., projects/divine-selfie/context/40-eng-execution-board.md
  section: string | null;     // e.g., "Next 10 Implementation Tasks"
}
```

### MilestoneEvent
```ts
interface MilestoneEvent {
  id: string;
  timestamp: string;
  title: string;
  detail: string;
  roomId: string;             // usually common, may be pod
  actorId: string;            // who posted/triggered
  relatedTicketIds: string[];
  links: ArtifactLink[];
  severity: 'info' | 'warning' | 'critical';
}
```

---

## 3) Status Transition Rules

Allowed transitions:

- `todo -> in-progress | blocked`
- `in-progress -> review | blocked | todo`
- `review -> done | in-progress | blocked`
- `blocked -> todo | in-progress`
- `done -> review` (reopen only)

Validation rules:
1. `ownerId` required for `in-progress`, `review`, `done`.
2. `blocked` requires at least one `blockedBy` item or blocker comment.
3. Transition to `done` requires at least one artifact link OR one completion comment.
4. All transitions append an audit comment: `"Status X -> Y by <actor>"`.

---

## 4) API Surface (MVP)

Minimal REST endpoints:

- `GET /profiles`
- `POST /profiles`
- `PATCH /profiles/:id`

- `GET /rooms`
- `POST /rooms`
- `PATCH /rooms/:id`

- `GET /tickets`
  - filters: `status`, `ownerId`, `roomId`, `tag`
- `POST /tickets`
- `PATCH /tickets/:id`
- `POST /tickets/:id/comments`
- `POST /tickets/:id/artifacts`
- `POST /tickets/:id/transition` `{toStatus, actorId, note?}`

- `GET /milestones`
- `POST /milestones`

- `POST /seed/divine-v0` (idempotent seeding endpoint)

---

## 5) Storage Shape (JSON-first MVP)

For fastest build, use file-backed JSON or SQLite tables mirroring these collections:
- `profiles`
- `rooms`
- `tickets`
- `milestones`

Suggested initial file layout:

```
projects/aetherboard/data/
  profiles.json
  rooms.json
  tickets.json
  milestones.json
```

---

## 6) Seeded Data (v0 Divine Import)

Sources used:
- `projects/divine-selfie/context/21-org-chart.md`
- `projects/divine-selfie/context/33-agent-tree-index.yaml`
- `projects/divine-selfie/context/40-eng-execution-board.md`
- `projects/divine-selfie/context/41-design-execution-board.md`
- `projects/divine-selfie/context/42-marketing-execution-board.md`

## 6.1 Seed Profiles

```json
[
  {
    "id": "agent:main:main",
    "actorType": "agent",
    "displayName": "Ooz",
    "role": "CEO/Governor",
    "pod": "leadership",
    "capabilities": ["governance", "resource-allocation", "arbitration"],
    "state": "active"
  },
  {
    "id": "agent:main:subagent:e24940c2-17aa-4c66-a485-fb497c9d181d",
    "actorType": "agent",
    "displayName": "PM-1",
    "role": "PM-1 Hindu Diaspora Core",
    "pod": "product",
    "capabilities": ["roadmap", "prioritization", "execution-control"],
    "state": "active"
  },
  {
    "id": "agent:main:subagent:47301836-a5c0-4660-9c00-f8faff0e2d5f",
    "actorType": "agent",
    "displayName": "Engineering Pillar",
    "role": "Engineering Pillar Lead",
    "pod": "engineering",
    "capabilities": ["architecture", "backend", "platform"],
    "state": "active"
  },
  {
    "id": "agent:main:subagent:3a7e35d7-38bc-4bfa-951e-bfc920db303a",
    "actorType": "agent",
    "displayName": "Design Pillar",
    "role": "Design Pillar Lead",
    "pod": "design",
    "capabilities": ["design-system", "ux-copy", "quality-fixtures"],
    "state": "active"
  },
  {
    "id": "agent:main:subagent:019494b2-c146-412c-909c-e15ef974b61b",
    "actorType": "agent",
    "displayName": "Marketing Pillar",
    "role": "Marketing Pillar Lead",
    "pod": "marketing",
    "capabilities": ["gtm", "creator-ops", "trust-comms"],
    "state": "active"
  },
  {
    "id": "human:council:sameer",
    "actorType": "human",
    "displayName": "Sameer",
    "role": "Council",
    "pod": "leadership",
    "capabilities": ["approval", "priority-setting"],
    "state": "active"
  }
]
```

## 6.2 Seed Rooms

```json
[
  {
    "id": "room:common",
    "type": "common",
    "name": "Common Room",
    "description": "Cross-pod coordination, council decisions, launch gates",
    "memberIds": [
      "agent:main:main",
      "agent:main:subagent:e24940c2-17aa-4c66-a485-fb497c9d181d",
      "agent:main:subagent:47301836-a5c0-4660-9c00-f8faff0e2d5f",
      "agent:main:subagent:3a7e35d7-38bc-4bfa-951e-bfc920db303a",
      "agent:main:subagent:019494b2-c146-412c-909c-e15ef974b61b",
      "human:council:sameer"
    ]
  },
  {
    "id": "room:pod:engineering",
    "type": "pod",
    "name": "Engineering Pod",
    "description": "Build lane for funnel implementation",
    "memberIds": [
      "agent:main:subagent:e24940c2-17aa-4c66-a485-fb497c9d181d",
      "agent:main:subagent:47301836-a5c0-4660-9c00-f8faff0e2d5f"
    ]
  },
  {
    "id": "room:pod:design",
    "type": "pod",
    "name": "Design Pod",
    "description": "Style quality, moderation thresholds, UX trust language",
    "memberIds": [
      "agent:main:subagent:e24940c2-17aa-4c66-a485-fb497c9d181d",
      "agent:main:subagent:3a7e35d7-38bc-4bfa-951e-bfc920db303a"
    ]
  },
  {
    "id": "room:pod:marketing",
    "type": "pod",
    "name": "Marketing Pod",
    "description": "24h GTM execution, KPI loop, trust response",
    "memberIds": [
      "agent:main:subagent:e24940c2-17aa-4c66-a485-fb497c9d181d",
      "agent:main:subagent:019494b2-c146-412c-909c-e15ef974b61b"
    ]
  }
]
```

## 6.3 Seed Tickets (Representative Initial Backlog)

```json
[
  {
    "id": "AB-ENG-001",
    "title": "Build API gateway/BFF skeleton with session + trace/idempotency middleware",
    "description": "Scaffold core endpoints and middleware accepted/logged for trace_id and idempotency.",
    "status": "todo",
    "ownerId": "agent:main:subagent:47301836-a5c0-4660-9c00-f8faff0e2d5f",
    "watcherIds": ["agent:main:subagent:e24940c2-17aa-4c66-a485-fb497c9d181d"],
    "roomId": "room:pod:engineering",
    "tags": ["engineering", "backend", "funnel-core"],
    "artifactLinks": [
      {"id": "a1", "label": "Engineering Architecture v1", "url": "projects/divine-selfie/context/27-engineering-architecture-v1.md", "type": "spec"}
    ],
    "sourceRefs": [
      {"path": "projects/divine-selfie/context/40-eng-execution-board.md", "section": "Next 10 Implementation Tasks"}
    ],
    "comments": [],
    "blockedBy": [],
    "dueAt": "2026-02-12T23:59:00Z"
  },
  {
    "id": "AB-ENG-006",
    "title": "Implement checkout service with webhook idempotency + entitlement grant",
    "description": "Payment_succeeded grants entitlement exactly once; replay-safe webhook.",
    "status": "blocked",
    "ownerId": "agent:main:subagent:47301836-a5c0-4660-9c00-f8faff0e2d5f",
    "watcherIds": ["agent:main:subagent:e24940c2-17aa-4c66-a485-fb497c9d181d"],
    "roomId": "room:pod:engineering",
    "tags": ["engineering", "checkout", "payments"],
    "artifactLinks": [],
    "sourceRefs": [
      {"path": "projects/divine-selfie/context/40-eng-execution-board.md", "section": "Blockers & Owners"}
    ],
    "comments": [
      {
        "id": "c1",
        "ticketId": "AB-ENG-006",
        "authorId": "agent:main:subagent:e24940c2-17aa-4c66-a485-fb497c9d181d",
        "body": "Blocked pending payment provider sandbox keys/webhook endpoint confirmation.",
        "createdAt": "2026-02-10T16:20:00Z"
      }
    ],
    "blockedBy": ["payment-provider-sandbox-keys"],
    "dueAt": "2026-02-17T23:59:00Z"
  },
  {
    "id": "AB-DES-001",
    "title": "Unblock Prayer Moment style with hand anatomy validator + retry logic",
    "description": "Style 6 is blocked until malformed-hand detection and auto-repair loop is implemented.",
    "status": "blocked",
    "ownerId": "agent:main:subagent:3a7e35d7-38bc-4bfa-951e-bfc920db303a",
    "watcherIds": ["agent:main:subagent:e24940c2-17aa-4c66-a485-fb497c9d181d"],
    "roomId": "room:pod:design",
    "tags": ["design", "quality", "moderation"],
    "artifactLinks": [
      {"id": "d1", "label": "Design Execution Board", "url": "projects/divine-selfie/context/41-design-execution-board.md", "type": "doc"}
    ],
    "sourceRefs": [
      {"path": "projects/divine-selfie/context/41-design-execution-board.md", "section": "Immediate Blockers"}
    ],
    "comments": [],
    "blockedBy": ["hand-anatomy-validation-missing"],
    "dueAt": null
  },
  {
    "id": "AB-DES-004",
    "title": "Wire funnel trust copy across upload/loading/result/delete/fallback surfaces",
    "description": "Complete UX copy insertion map coverage and enforce banned phrase policy.",
    "status": "todo",
    "ownerId": "agent:main:subagent:3a7e35d7-38bc-4bfa-951e-bfc920db303a",
    "watcherIds": ["agent:main:subagent:e24940c2-17aa-4c66-a485-fb497c9d181d"],
    "roomId": "room:pod:design",
    "tags": ["design", "ux-copy", "trust"],
    "artifactLinks": [],
    "sourceRefs": [
      {"path": "projects/divine-selfie/context/41-design-execution-board.md", "section": "UX Copy Insertion Map Across Funnel"}
    ],
    "comments": [],
    "blockedBy": [],
    "dueAt": null
  },
  {
    "id": "AB-MKT-001",
    "title": "Execute H0-H2 war-room lock and outbound kit freeze",
    "description": "Lock message angles, templates, UTM/ref structure, escalation owner map.",
    "status": "in-progress",
    "ownerId": "agent:main:subagent:019494b2-c146-412c-909c-e15ef974b61b",
    "watcherIds": ["agent:main:subagent:e24940c2-17aa-4c66-a485-fb497c9d181d"],
    "roomId": "room:pod:marketing",
    "tags": ["marketing", "war-room", "operations"],
    "artifactLinks": [
      {"id": "m1", "label": "Marketing Execution Board", "url": "projects/divine-selfie/context/42-marketing-execution-board.md", "type": "doc"}
    ],
    "sourceRefs": [
      {"path": "projects/divine-selfie/context/42-marketing-execution-board.md", "section": "Block A — H0-H2"}
    ],
    "comments": [],
    "blockedBy": [],
    "dueAt": "2026-02-10T18:15:00Z"
  },
  {
    "id": "AB-MKT-006",
    "title": "Publish KPI snapshots every 3h and gate memos at H12/H24",
    "description": "Maintain command-center cadence and trigger-based action routing.",
    "status": "todo",
    "ownerId": "agent:main:subagent:019494b2-c146-412c-909c-e15ef974b61b",
    "watcherIds": ["agent:main:subagent:e24940c2-17aa-4c66-a485-fb497c9d181d", "agent:main:main"],
    "roomId": "room:common",
    "tags": ["marketing", "analytics", "command-center"],
    "artifactLinks": [],
    "sourceRefs": [
      {"path": "projects/divine-selfie/context/42-marketing-execution-board.md", "section": "KPI Command Cadence"}
    ],
    "comments": [],
    "blockedBy": [],
    "dueAt": null
  }
]
```

## 6.4 Seed Milestone Feed

```json
[
  {
    "id": "MS-001",
    "timestamp": "2026-02-08T00:00:00Z",
    "title": "Council governance model locked",
    "detail": "Org chart and PM governance rules established as source of truth.",
    "roomId": "room:common",
    "actorId": "agent:main:main",
    "relatedTicketIds": [],
    "links": [
      {"id": "l1", "label": "Org Chart", "url": "projects/divine-selfie/context/21-org-chart.md", "type": "doc"}
    ],
    "severity": "info"
  },
  {
    "id": "MS-002",
    "timestamp": "2026-02-10T00:00:00Z",
    "title": "Engineering execution board published",
    "detail": "10-priority task lane and blockers with owners/ETA established.",
    "roomId": "room:pod:engineering",
    "actorId": "agent:main:subagent:47301836-a5c0-4660-9c00-f8faff0e2d5f",
    "relatedTicketIds": ["AB-ENG-001", "AB-ENG-006"],
    "links": [
      {"id": "l2", "label": "Engineering Board", "url": "projects/divine-selfie/context/40-eng-execution-board.md", "type": "doc"}
    ],
    "severity": "info"
  },
  {
    "id": "MS-003",
    "timestamp": "2026-02-10T00:00:00Z",
    "title": "Design board flags Prayer Moment as blocked",
    "detail": "Hand anatomy reliability declared P0 blocker for release readiness.",
    "roomId": "room:pod:design",
    "actorId": "agent:main:subagent:3a7e35d7-38bc-4bfa-951e-bfc920db303a",
    "relatedTicketIds": ["AB-DES-001"],
    "links": [
      {"id": "l3", "label": "Design Board", "url": "projects/divine-selfie/context/41-design-execution-board.md", "type": "doc"}
    ],
    "severity": "warning"
  },
  {
    "id": "MS-004",
    "timestamp": "2026-02-10T16:15:00Z",
    "title": "Marketing 24h operating system locked",
    "detail": "Execution blocks, owners, KPI cadence, and trust-response matrix made executable.",
    "roomId": "room:pod:marketing",
    "actorId": "agent:main:subagent:019494b2-c146-412c-909c-e15ef974b61b",
    "relatedTicketIds": ["AB-MKT-001", "AB-MKT-006"],
    "links": [
      {"id": "l4", "label": "Marketing Board", "url": "projects/divine-selfie/context/42-marketing-execution-board.md", "type": "doc"}
    ],
    "severity": "info"
  }
]
```

---

## 7) UI Views (MVP)

Minimum views to consider implementation complete:

1. **Board View (Kanban by status)**
   - columns: todo / in-progress / review / done / blocked
2. **Owner View**
   - grouped by profile with active counts + blocked count
3. **Room View**
   - common room timeline + each pod room ticket list
4. **Milestone Timeline**
   - reverse chronological feed with severity badges

---

## 8) Acceptance Criteria

MVP is accepted when:
- [ ] all entities above are creatable/readable/updatable
- [ ] status transition rules are enforced in backend
- [ ] comments + artifact links attach to tickets
- [ ] common room + at least 3 pod rooms exist
- [ ] Divine seed import endpoint populates profiles, rooms, tickets, milestones idempotently
- [ ] board view renders seeded tickets in correct status columns
- [ ] blocked tickets visibly show blocker reason(s)

---

## 9) Future Extensions (Post-MVP)

- multi-assignee tickets
- dependency graph visualization
- SLA timers and overdue alerts
- integration adapters (GitHub/Jira/Slack/Telegram)
- role-based access and audit export

---

## 10) Build Notes

This spec is intentionally implementation-ready and lightweight:
- can be built quickly in Node/TS + SQLite or JSON store
- can ingest legacy project docs as source references
- can support any agent org with minimal schema changes

AetherBoard v0 is therefore practical now, while keeping clean upgrade paths.
