You are a senior full-stack developer and software architect. I have been given the following problem statement in a coding/technical assessment:

**Problem: “The Helpdesk is Drowning”**

Priya runs a two-person IT helpdesk and the queue never stops. Some tickets are urgent, such as “my laptop won’t boot before a client demo”; others are normal, such as “can I get a bigger monitor.”

Each ticket has:

* A priority
* An agreed response time / SLA
* An assigned person
* Customer information
* Ticket status

Urgent tickets must receive a response within 2 hours, while normal tickets must receive a response within 1 day.

Priya wants to **always pick the most pressing ticket next**. Any ticket that has passed its promised response time must automatically jump to the front.

She frequently needs to answer:

1. What tickets are overdue?
2. What tickets are assigned to me?
3. Find a specific customer's ticket by name.
4. Browse a large ticket list using pagination.

The key requirement is:

> **The ordering rule is the heart of the application. The right ticket should always appear at the top.**

The application should be generic enough to work for any IT helpdesk, not specifically hard-coded for Priya.

### YOUR TASK

Build the best practical solution for this problem.

Do NOT start coding immediately.

First analyze the requirements and explain your proposed solution briefly. Then implement it.

### CORE BUSINESS LOGIC

Design a clear and reliable ticket-ranking algorithm.

The queue must prioritize tickets based on urgency and SLA.

At minimum, the ordering should account for:

1. **Overdue status**

   * If the current time is past the ticket's promised response time, it is overdue.
   * Overdue tickets must jump ahead of non-overdue tickets.

2. **Priority**

   * Urgent tickets should be ahead of normal tickets when their SLA state is otherwise comparable.

3. **SLA deadline**

   * Among tickets with the same urgency/priority category, the ticket whose response deadline is sooner should appear first.

4. **Stable ordering**

   * If two tickets have the same ranking values, use a deterministic tie-breaker such as ticket creation time or ticket ID.

The ranking should be deterministic and easy to explain.

For example, conceptually:

OVERDUE → PRIORITY → EARLIEST DEADLINE → CREATION TIME

However, don't blindly assume this exact ordering if a better interpretation is appropriate. Explain your final ranking rule before implementing it.

### IMPORTANT

Do NOT simply sort by priority.

The application must correctly handle cases such as:

* Normal ticket that is already overdue
* Urgent ticket that is not overdue
* Two overdue tickets with different priorities
* Two tickets with the same priority but different deadlines
* Tickets created at different times
* Tickets whose deadlines are approaching
* Resolved/closed tickets

The "right ticket on top" behavior should remain correct as time passes.

### REQUIRED FEATURES

Build a functional helpdesk ticket management application with:

#### 1. Ticket List / Queue

Display tickets in the calculated queue order.

Each ticket should show useful information such as:

* Ticket ID
* Customer name
* Issue/title
* Priority
* Status
* Assignee
* Created time
* SLA deadline
* Overdue indicator

The highest-ranked ticket should be visually obvious.

#### 2. Create Ticket

Allow a user to create a ticket with fields such as:

* Customer name
* Issue/title
* Description
* Priority (Urgent/Normal)
* Assignee
* Status

The SLA deadline should be calculated automatically from priority:

* Urgent → 2 hours
* Normal → 24 hours

Avoid asking the user to manually enter the SLA deadline unless there is a strong reason.

#### 3. Overdue Filter

Provide an "Overdue" filter that shows only tickets whose SLA deadline has passed and are still unresolved.

#### 4. "Assigned to Me" Filter

Allow filtering tickets by assignee.

For example:

* All
* Assigned to me
* Unassigned
* Specific team member

#### 5. Customer Search

Allow searching for a ticket by customer name.

The search should work efficiently and support partial customer names if practical.

#### 6. Status Filtering

Support useful statuses such as:

* Open
* In Progress
* Resolved
* Closed

Resolved/closed tickets should not compete with active tickets in the main priority queue.

#### 7. Pagination

The ticket list may contain thousands of tickets.

Implement pagination rather than loading/displaying everything at once.

Show:

* Current page
* Page size
* Next/Previous controls
* Total results if practical

Filtering, searching, sorting and pagination should work together correctly.

### UI REQUIREMENTS

Create a clean, professional helpdesk dashboard.

Prioritize usability over flashy design.

The UI should make it immediately clear:

* Which ticket needs attention first
* Which tickets are overdue
* Who is assigned to each ticket
* How much time remains before SLA breach

Use clear visual indicators for:

* Overdue
* Urgent
* Normal
* Resolved

The most urgent ticket should be visually prominent without making the interface cluttered.

### TECHNICAL REQUIREMENTS

Choose a practical technology stack suitable for a coding assessment.

Before implementation, state:

* Frontend technology
* Backend technology
* Database/storage choice
* Important libraries
* Why you selected them

Keep the architecture simple enough to build and explain during an interview.

Avoid unnecessary microservices or complicated infrastructure.

### DATA MODEL

Create a sensible Ticket model.

At minimum it should contain:

* id
* customerName
* title
* description
* priority
* status
* assignee
* createdAt
* slaDeadline
* resolvedAt (if applicable)

You may add fields if they improve the solution.

### QUEUE ALGORITHM

Implement the queue-ranking logic as a separate, reusable function/module.

For example:

getTicketRank(ticket, currentTime)

or

sortTicketsByUrgency(tickets)

The ranking logic must NOT be scattered throughout the UI.

This is extremely important because the ordering rule is the core of the application.

Explain the algorithm's:

* Time complexity
* Space complexity
* Edge cases
* Why it correctly represents the SLA requirement

### TIME HANDLING

Do not hard-code "overdue" based on a value that is calculated only when the ticket is created.

Overdue status depends on the current time.

The system should dynamically determine:

current time > SLA deadline

for active tickets.

Make the implementation easy to test.

### SAMPLE DATA

Create realistic seed/mock data containing cases such as:

* Urgent ticket with 1 hour remaining
* Urgent ticket overdue by 30 minutes
* Normal ticket with 5 hours remaining
* Normal ticket overdue by 2 hours
* Multiple tickets with identical priorities
* Multiple tickets with different deadlines
* Resolved ticket
* Unassigned ticket
* Multiple tickets belonging to the same customer

This should allow me to demonstrate that the ordering algorithm actually works.

### TESTING

Add tests for the most important queue scenarios.

At minimum test:

1. Overdue ticket comes before non-overdue ticket.
2. Earlier SLA deadline comes before later deadline when other ranking factors are equal.
3. Urgent and normal tickets are ordered correctly.
4. Resolved/closed tickets do not appear ahead of active tickets.
5. Ties are deterministic.
6. Filtering by assignee works.
7. Customer search works.
8. Pagination works.
9. Queue order changes correctly when time passes and a ticket becomes overdue.

### CODE QUALITY

Write clean, readable, beginner-friendly code.

Use meaningful variable/function names.

Avoid unnecessary abstraction.

Keep business logic separate from UI code.

Add comments only where they explain important logic.

Do not generate a huge amount of unnecessary code.

### ASSESSMENT-FRIENDLY APPROACH

I may need to explain this project to an interviewer.

Therefore, after implementation, provide:

1. Project architecture
2. Folder structure
3. Explanation of the ticket ranking algorithm
4. Explanation of why overdue tickets jump to the front
5. Explanation of SLA calculation
6. Database schema
7. API endpoints, if a backend is used
8. Important technical decisions
9. Time and space complexity
10. Edge cases
11. Testing strategy
12. How to run the project
13. 5–10 likely interviewer questions with simple answers

### IMPORTANT DEVELOPMENT RULE

Work step-by-step.

First:

1. Analyze the problem.
2. Define the ranking/ordering rule.
3. Propose the architecture and tech stack.
4. Define the data model.
5. Show the folder structure.

Then wait for my confirmation before generating the complete implementation.

When I say **"continue"**, implement the project incrementally, starting with the backend/data model and core queue-ranking logic before building filters and UI.

Do not skip the core ordering logic.

The primary goal is:

> **Build a generic helpdesk system where the correct ticket is always at the top of the queue, especially when an SLA has been breached.**
Continue.
Use these decisions:

* Ranking: use the plain 4-key rule. Do NOT add the "<20% remaining" at-risk bucket.
* Scope: build the full Express + SQLite application, but keep the architecture simple and assessment-friendly.
* Keep the ranking logic independent and reusable so it can be tested separately.
* Do not spend time on unnecessary features, authentication, microservices, or complex styling.

Start implementation now.
Build order

1. Shared types/models
2. SLA calculation module
3. `ranking.ts` with the core ticket ordering algorithm
4. Comprehensive tests for ranking/SLA
5. SQLite database/repository
6. Express API
7. Frontend/dashboard
8. Filters, customer search, assignment and pagination
9. Seed realistic sample data
10. Final cleanup and README

Core ranking requirement
For ACTIVE tickets, order by:

1. Overdue tickets first
2. Priority: Urgent before Normal
3. Earliest SLA deadline
4. Earliest creation time / deterministic ticket ID tie-breaker

Resolved/Closed tickets must not compete with active tickets in the main queue.
Overdue must be calculated dynamically from the current time:
`currentTime > slaDeadline`
SLA:

* Urgent = createdAt + 2 hours
* Normal = createdAt + 24 hours

Keep this logic in a dedicated module. Do not duplicate ranking logic in the frontend or API.
Tests must cover

* overdue vs non-overdue
* urgent vs normal
* earlier vs later SLA deadline
* deterministic ties
* resolved/closed tickets
* ticket becoming overdue as time passes
* SLA calculation
* filtering by assignee
* customer-name search
* pagination

Important
Make the project actually runnable, not pseudo-code.
Use TypeScript if practical.
Keep the code beginner-friendly because I need to explain it in an interview.
After each major implementation step, briefly tell me:

* what was created
* why it was created
* how it satisfies the requirement

Do NOT restart the analysis or ask me the two questions again. The decisions above are final.
Begin with the shared types, SLA module, `ranking.ts`, and its tests.
CONTINUE AND COMPLETE THE ENTIRE PROJECT NOW.

This is my final implementation pass, so do not stop after step 5 or step 6, do not ask me for confirmation, and do not give me another planning phase.

You already completed steps 1–4:

* shared types
* SLA module
* `ranking.ts`
* ranking/SLA tests

The ranking decision is FINAL:

* Active overdue tickets first
* Then Urgent before Normal
* Then earliest SLA deadline
* Then earliest creation time
* Then deterministic ticket ID
* No "<20% remaining" at-risk bucket
* Resolved/Closed tickets must not compete with active tickets in the main queue
* IDs are zero-padded such as `TKT-0042`, so `localeCompare` is an acceptable deterministic final tie-breaker.

Now COMPLETE the remaining application end-to-end.

### REQUIRED BUILD

#### Step 5 — SQLite

Implement:

* SQLite database
* Ticket schema
* Repository/data-access layer
* Seed/sample data
* Proper indexes where useful

Ticket fields should include:

* id
* customerName
* title
* description
* priority
* status
* assignee
* createdAt
* slaDeadline
* resolvedAt

Keep the repository behind a clean service/interface so the ranking logic remains independent of SQLite.

#### Step 6 — Express API

Implement the backend API for:

* GET `/api/tickets`
* GET `/api/tickets/:id`
* POST `/api/tickets`
* PATCH `/api/tickets/:id`
* DELETE `/api/tickets/:id` if appropriate

The GET ticket-list endpoint must support:

* customer search
* assignee filter
* status filter
* overdue filter
* pagination

IMPORTANT PIPELINE:

FILTER → DETERMINE OVERDUE/RANK → SORT → PAGINATE

Do not paginate before ranking, because that could produce an incorrect queue.

Return useful pagination metadata such as:

* items
* page
* pageSize
* total
* totalPages

#### Step 7 — Frontend

Build a clean professional helpdesk dashboard.

It must show:

* Ticket ID
* Customer
* Issue
* Priority
* Status
* Assignee
* SLA deadline
* Overdue indicator

Make the highest-priority ticket visually obvious.

Include:

* All tickets
* Overdue filter
* Assigned-to-me filter
* Assignee filter
* Status filter
* Customer search
* Pagination
* Create ticket form
* Ticket update/assignment capability

The UI should be practical and assessment-friendly, not overly complicated.

#### Step 8 — Real-time SLA behavior

Make sure overdue status is based on the current time, not permanently stored as a static boolean.

If practical, refresh/recalculate the displayed queue periodically so a ticket can automatically become overdue while the application is open.

Do not introduce unnecessary real-time infrastructure such as WebSockets unless genuinely required.

#### Step 9 — Seed data

Create enough realistic sample tickets to demonstrate:

* overdue urgent
* overdue normal
* urgent approaching deadline
* normal approaching deadline
* different assignees
* unassigned ticket
* same customer with multiple tickets
* resolved ticket
* closed ticket
* tie cases

The first few displayed tickets should clearly demonstrate that the ranking algorithm works.

#### Step 10 — Tests

Run the complete test suite.

Fix any failing tests or TypeScript/build errors.

Test at least:

1. SLA calculation
2. overdue detection
3. urgent vs normal
4. overdue vs non-overdue
5. earliest deadline
6. creation-time tie-break
7. ticket-ID tie-break
8. resolved/closed behavior
9. filters
10. search
11. pagination
12. API behavior

Do not merely say tests should pass. ACTUALLY RUN THEM if the environment allows it.

Also run the TypeScript/build checks.

### IMPORTANT ARCHITECTURE RULE

Keep responsibilities separated:

* `ranking.ts` → only queue ranking/business logic
* SLA module → SLA calculation/time logic
* repository → SQLite/data access
* service/API → application/business orchestration
* frontend → presentation and user interaction

Do not duplicate the ranking algorithm in multiple places.

### IMPORTANT PERFORMANCE RULE

For the large-ticket-list requirement, make reasonable use of database filtering/search and pagination.

However, because queue ranking is the heart of the assignment, make sure the implementation still guarantees the correct global queue order.

If database-side sorting can safely reproduce the exact ranking, use it. Otherwise, clearly isolate the ranking step and explain the trade-off.

### FINAL QUALITY CHECK

Before finishing:

1. Inspect the project structure.
2. Check for TypeScript errors.
3. Run tests.
4. Run/build the frontend.
5. Fix any errors you find.
6. Verify API routes.
7. Verify filters + ranking + pagination together.
8. Verify creating a ticket calculates the correct SLA.
9. Verify an overdue ticket moves to the front.
10. Verify the UI starts successfully.

Do not leave TODOs, placeholder implementations, pseudo-code, fake API calls, or unfinished features.

### FINAL RESPONSE TO ME

After implementation, give me a concise final report containing:

* What was built
* Final folder structure
* Tech stack
* Queue-ranking rule
* Filter → rank → paginate flow
* API endpoints
* Database schema
* Tests/results
* Exact commands to install/run/test the project
* Any important limitations

Most importantly:

**FINISH THE WORKING PROJECT, NOT JUST THE EXPLANATION.**
The project is NOT complete in my workspace.

I currently only have these files:
README.md
ranking.ts
sla.ts
ticketService.ts
routes.ts
App.tsx

There is NO client/ directory and NO server/ directory.

When I run:
npm run seed

I get:
Cannot find module '/workspaces/.../server/src/seed.ts'

And:
cd client
returns:
No such file or directory.

Your previous report claimed the complete Express + SQLite + React project was built, but the actual workspace/files do not contain the required project structure.

IMPORTANT: Do not just explain the issue.

FIX THE PROJECT NOW.

Create the complete runnable project in the current workspace with this structure (or an equally clean structure):

helpdesk/
├── client/
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   └── ...
│   └── ...
├── server/
│   ├── src/
│   │   ├── seed.ts
│   │   ├── app.ts
│   │   ├── routes.ts
│   │   ├── ...
│   │   └── ...
├── shared/
│   ├── types.ts
│   ├── ranking.ts
│   └── sla.ts
├── package.json
├── README.md
└── ...

Requirements:
- Express + TypeScript backend
- SQLite using better-sqlite3
- React + TypeScript + Vite + Tailwind frontend
- Zod validation
- Vitest tests
- Working seed command
- Working backend dev command
- Working frontend dev command
- The shared ranking module must be used by the backend
- Dynamic overdue calculation: now > slaDeadline
- Ranking:
  overdue → active → closed
  then urgent → normal
  then earliest SLA deadline
  then creation time
  then ticket ID
- Filters: overdue, assignee, status
- Customer search
- Assignment
- Pagination
- Create/update/delete tickets
- SLA: urgent = 2 hours, normal = 24 hours
- Seed realistic tickets
- Tests for ranking, SLA, repository/service, filters and pagination

Most importantly, ACTUALLY CREATE ALL MISSING FILES in the current workspace.

After creating them, run:
npm install
npm run seed
npm test
npm run build (or the appropriate TypeScript/Vite build commands)

Fix all errors you encounter.

Do not stop after giving me code snippets. Make the files exist in the workspace and verify the project runs.

At the end, show me the exact commands I should run in GitHub Codespaces to start:
1. backend
2. frontend

Do not ask me to make architectural decisions. Use sensible defaults and complete the project.
