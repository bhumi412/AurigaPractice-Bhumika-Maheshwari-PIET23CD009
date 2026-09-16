# Helpdesk Queue

A ticket-queue helpdesk app where the ordering rule is the whole point: the
ticket that most needs attention is always at the top, and that stays true as
time passes, without anyone manually re-sorting anything.

## 1. Tech stack

| Layer      | Choice                              | Why |
|------------|--------------------------------------|-----|
| Frontend   | React + TypeScript (Vite) + Tailwind | Fast dev loop, typed props, no framework magic to explain in an interview. |
| Backend    | Node + Express + TypeScript          | Small and boring on purpose - the interesting logic lives in one shared module, not in the framework. |
| Database   | SQLite (better-sqlite3)              | Real SQL, real indexes, zero infrastructure - one file. Synchronous API keeps the repository free of async noise. |
| Validation | Zod                                   | One schema validates a request and doubles as documentation of the shape. |
| Tests      | Vitest                                | Fast, same config style as Vite, and `now` can be passed in directly (no fake timers needed). |

No auth, no microservices, no websockets - deliberately, per the brief.

## 2. Project structure

```
helpdesk/
├── shared/                     # Pure logic. No HTTP, no SQL, no React.
│   ├── types.ts                 # Ticket, Priority, Status
│   ├── sla.ts                   # SLA windows, calculateSlaDeadline, isOverdue
│   ├── testFactory.ts           # makeTicket() helper used by tests
│   ├── sla.test.ts
│   └── queue/
│       ├── ranking.ts           # ★ THE queue-ranking algorithm
│       └── ranking.test.ts      # 16 tests covering every required scenario
├── server/
│   └── src/
│       ├── db.ts                 # SQLite connection + row-to-Ticket mapping
│       ├── schema.sql            # Table + indexes
│       ├── repository.ts         # The ONLY module that writes SQL
│       ├── ticketService.ts      # FILTER -> RANK -> PAGINATE pipeline
│       ├── routes.ts             # Express routes (HTTP only, no business logic)
│       ├── index.ts              # App bootstrap
│       ├── seed.ts               # Realistic scenario-based sample data
│       ├── repository.test.ts
│       └── ticketService.test.ts
└── client/
    └── src/
        ├── api.ts                 # Typed fetch wrapper
        ├── App.tsx                # Top-level state, polling, wiring
        ├── TopTicketBanner.tsx    # "Answer this next" - the #1 ticket, always
        ├── FilterBar.tsx          # Status / assignee / overdue / search
        ├── TicketQueue.tsx        # The ranked table
        ├── Pagination.tsx
        ├── CreateTicketForm.tsx
        └── Badges.tsx             # Priority / status / overdue chips
```

`ranking.ts` has zero dependencies beyond `types.ts` and `sla.ts`. That's
deliberate: it's the one file you'd open to explain the whole assignment.

## 3. The ranking rule (the heart of the app)

For every ticket, compute a 4-part sort key and compare lexicographically -
the first part that differs wins:

```
1. bucket         0 = active & overdue, 1 = active & on time, 2 = resolved/closed
2. priorityRank   0 = URGENT, 1 = NORMAL
3. slaDeadline    ascending (sooner deadline first)
4. createdAt      ascending, then ticket id (zero-padded, e.g. TKT-0042)
```

```ts
// shared/queue/ranking.ts
function getTicketRank(ticket, now) {
  const bucket = !isActiveTicket(ticket) ? 2 : isOverdue(ticket, now) ? 0 : 1;
  return { bucket, priorityRank: PRIORITY_RANK[ticket.priority],
           deadlineMs: toMillis(ticket.slaDeadline),
           createdAtMs: toMillis(ticket.createdAt), id: ticket.id };
}
```

**Why overdue outranks priority:** priority describes how bad the problem is;
overdue means a promise has already been broken and the damage is still
growing. A broken promise outranks one you can still keep - so a *breached
normal* ticket sits above an *on-time urgent* ticket. This is the case most
naive "sort by priority" implementations get wrong, and it's the first test
in `ranking.test.ts`.

**Why it stays correct as time passes:** `isOverdue` is never stored - it's
computed as `now > slaDeadline` on every read. Because `now` only moves
forward, a ticket can enter the overdue bucket but never leave it while still
active. The ordering is monotone in time, so the queue never flaps.

**Why resolved/closed tickets are dropped, not sorted to the bottom:** they
carry no outstanding SLA obligation, so pushing them into a low bucket (as
the code does) or excluding them from the active queue (as the API does by
default) both fall out of the same rule with no special-casing.

**Why the id is the final tie-breaker:** `createdAt` alone is not guaranteed
unique (seed/bulk-import timestamps can collide), and relying on
`Array.prototype.sort`'s stability across engines is a fragile crutch. Adding
`id` (zero-padded so lexicographic and numeric order agree) makes the
comparator a strict total order - it never returns `0` for two different
tickets, so the result is identical no matter how the input is shuffled.
Verified directly by a test that sorts the same list forward, reversed, and
rotated, and checks all three outputs match.

**Complexity:**
- `getTicketRank` / `compareTickets`: O(1) time and space.
- `sortTicketsByUrgency`: O(n log n) time, O(n) space (copies the array; input
  is never mutated).
- The rank depends on `now`, so it can't be cached across time - it's
  recomputed per request. At the "thousands of tickets" scale in the brief
  that's sub-millisecond.

**Edge cases handled (each has a dedicated test):** overdue-normal vs on-time
urgent; two overdue tickets at different priorities; equal-priority tickets
with different deadlines; identical deadlines and creation times (id
tie-break); a ticket transitioning from on-time to overdue between two calls
with no data changed; a resolved ticket that breached its SLA before being
resolved; an empty queue; a single-ticket queue.

**A known, documented trade-off:** inside the *on-time* bucket, priority beats
deadline. An urgent ticket due in 110 minutes currently outranks a normal
ticket due in 10 minutes - even though the normal one is about to breach.
This matches the brief's literal ordering
(`OVERDUE → PRIORITY → EARLIEST DEADLINE → CREATION TIME`) and keeps the rule
in one sentence. The documented alternative - an "at risk" sub-bucket for
tickets inside some percentage of their SLA window - was intentionally left
out per this project's explicit scope decision.

## 4. SLA calculation

```ts
SLA_WINDOWS_MS = { URGENT: 2 * HOUR, NORMAL: 24 * HOUR }
slaDeadline = createdAt + SLA_WINDOWS_MS[priority]
```

Computed once, server-side, at creation time - never accepted from the
client. If a ticket's priority is changed later, the deadline is
*recalculated from the original `createdAt`*, not from the edit time,
so re-prioritising doesn't secretly reset the clock.

`isOverdue(ticket, now) = ticket is active AND now > slaDeadline` - strictly
greater, so a ticket is not yet overdue at the exact instant of its deadline.

## 5. Filter → Rank → Paginate pipeline

```
1. FILTER   status / assignee / customer search -> pushed down to SQL (indexed)
2. RANK     sortTicketsByUrgency() over the ENTIRE filtered set, using `now`
3. PAGINATE slice the ranked list into the requested page
```

Pagination happens **last**. Paginating before ranking would mean "page 2" is
just whatever the database's arbitrary row order put there - not "the next
most urgent tickets" - which would silently break the one requirement the
whole assignment is about.

**Trade-off, stated explicitly:** because "overdue" is not a stored column,
the ranking step can't be expressed as a plain SQL `ORDER BY` without
duplicating the rule in two places (SQL and TypeScript). At the scale
described in the brief (thousands of active tickets), filtering in SQL and
ranking the filtered set in Node is fast and keeps a single source of truth
for the ordering. If the active-ticket count grew into the tens of
thousands, the bucket/priority portion of the rule could be pushed into a
SQL `ORDER BY` expression (e.g. `ORDER BY (sla_deadline < :now) DESC,
priority, sla_deadline`), accepting the duplication, with the TypeScript
comparator kept around as the test oracle that the SQL is checked against.

The `now` query parameter is exposed on `GET /api/tickets` specifically so
this transition-over-time behaviour can be demonstrated and tested without
waiting for a real SLA window to elapse.

## 6. Database schema

```sql
CREATE TABLE tickets (
  id                  TEXT PRIMARY KEY,
  customer_name       TEXT NOT NULL,
  customer_name_lc    TEXT NOT NULL,   -- lowercased, for indexed prefix search
  customer_email      TEXT,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  priority            TEXT NOT NULL CHECK (priority IN ('URGENT','NORMAL')),
  status              TEXT NOT NULL CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','CLOSED')),
  assignee            TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  sla_deadline        TEXT NOT NULL,   -- static, derived at creation
  resolved_at         TEXT,
  first_responded_at  TEXT
);

CREATE INDEX idx_tickets_status_deadline ON tickets(status, sla_deadline);
CREATE INDEX idx_tickets_assignee        ON tickets(assignee);
CREATE INDEX idx_tickets_customer_lc     ON tickets(customer_name_lc);
```

`overdue` is intentionally **not a column** - see section 4. `customer_name_lc`
exists so search can use `LIKE 'prefix%'`, which the index supports; a
`LIKE '%substring%'` query cannot use a plain index, so full substring search
(rather than prefix search) is the noted upgrade path (SQLite FTS5).

## 7. API endpoints

| Method | Path                | Notes |
|--------|---------------------|-------|
| GET    | `/api/tickets`      | Query params: `status`, `assignee` (`unassigned` supported), `customer`, `overdue=true`, `page`, `pageSize`, `now` (ISO string override for demos/tests). Returns `{ items, page, pageSize, total, totalPages }`. |
| GET    | `/api/tickets/:id`  | 404 if not found. |
| POST   | `/api/tickets`      | Body validated with Zod. SLA deadline always computed server-side. |
| PATCH  | `/api/tickets/:id`  | Partial update: `status`, `assignee`, `priority`. Recalculates the deadline if priority changes; stamps/clears `resolvedAt` on close/reopen. |
| DELETE | `/api/tickets/:id`  | 204 on success, 404 if missing. |
| GET    | `/api/assignees`    | Distinct assignees, for filter dropdowns. |
| GET    | `/api/meta`         | Valid statuses/priorities. |

## 8. Real-time SLA behaviour (no websockets)

- `isOverdue` is computed from `now` on every request - never stored.
- The dashboard polls `GET /api/tickets` every 30 seconds, so a ticket that
  breaches its SLA while the page is open moves to the front automatically.
- A separate 1-second local clock (no network call) drives the live
  countdown text and the red "overdue" highlight, so the UI doesn't look
  frozen between polls.
- No websockets, per the brief - polling is sufficient at this scale and
  much simpler to explain and reason about.

## 9. Seed data

`npm run seed` populates 54 tickets, including (deadlines computed as offsets
from "now" at seed time, so the demo is correct whenever you run it):

- Urgent, overdue by 3h (laptop won't boot before a demo)
- Urgent, overdue by 30m
- Normal, overdue by 2h
- Two urgent tickets with identical age (tie-break demo)
- Urgent with 1h left; normal with 5h left (approaching-deadline demos)
- An unassigned normal ticket, an unassigned urgent ticket
- The same customer (Aarav Sharma) with 3 different tickets (search demo)
- A resolved ticket that breached its SLA before being resolved (proves it's
  excluded, not merely sorted low)
- A closed ticket
- An in-progress ticket
- 40 filler tickets across 10 customers for the pagination demo

The first several rows returned by the default queue are the overdue,
urgent, earliest-deadline tickets - visibly proving the algorithm without
any extra explanation needed.

## 10. Tests - actually run, all passing

```
$ npx vitest run

 ✓ shared/queue/ranking.test.ts   (16 tests)
 ✓ shared/sla.test.ts              (8 tests)
 ✓ server/src/repository.test.ts   (9 tests)
 ✓ server/src/ticketService.test.ts (13 tests)

 Test Files  4 passed (4)
      Tests  46 passed (46)
```

`npx tsc --noEmit` (shared + server) and `npx tsc -b && vite build` (client)
both complete with zero errors.

Coverage includes every scenario asked for: SLA calculation for both
priorities, dynamic overdue detection (including the exact-instant edge
case), overdue vs non-overdue, urgent vs normal, earliest-deadline
tie-breaking, creation-time and ticket-id tie-breaking, resolved/closed
exclusion, a full mixed-queue scenario matching the rule exactly, queue
re-ordering as `now` advances with no data change, assignee filtering
(including "unassigned"), customer search, status filtering, and
pagination metadata across multiple pages - plus a test proving ranking
happens over the *entire* filtered set before slicing a page, not per-page.

Also manually verified against a running server with real HTTP requests:
correct queue order, overdue filter, customer search, assignee filter,
status filter, pagination, ticket creation with correct auto-computed SLA,
resolving a ticket (and its immediate disappearance from the active queue),
and deletion.

## 11. How to run it

```bash
# from the project root
npm install
npm run seed        # populates server/data/helpdesk.db
npm run dev          # starts the API on http://localhost:4000

# in a second terminal
cd client
npm install
npm run dev          # starts the dashboard on http://localhost:5173
```

Open `http://localhost:5173`. The Vite dev server proxies `/api/*` to the
Express server on port 4000.

Run tests: `npm test` (from the project root).
Typecheck: `npm run typecheck` (root) and `cd client && npx tsc -b`.
Production build of the frontend: `cd client && npm run build`.

## 12. Important limitations

- Single-user demo identity (`priya`) hard-coded for the "assigned to me"
  filter - there's no auth layer, per the brief's scope.
- Customer search is prefix-only (index-backed); true substring search would
  need SQLite FTS5 or a LIKE `%...%` scan.
- Ranking is computed in Node over the SQL-filtered set rather than via a SQL
  `ORDER BY`, which is the right trade-off at the stated scale but would need
  revisiting (with the duplication trade-off noted in section 5) at tens of
  thousands of active tickets.
- The SLA rule tracks *response* time; a `firstRespondedAt` field exists on
  the model for that purpose but the current queue rule (per the brief) uses
  ticket status/resolution, not a first-response timestamp.
- Real-time updates are via 30-second polling, not push - a deliberate
  simplification, not an oversight.


