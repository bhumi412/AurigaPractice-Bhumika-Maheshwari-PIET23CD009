# Reasoning Behind the Helpdesk Ticket Queue Solution

## Overview

The goal of this project is to build a reliable IT helpdesk ticket queue where support engineers can quickly identify which ticket needs attention first. The central challenge is that ticket ordering cannot be based only on the ticket's priority. A ticket can become more important when its SLA deadline has been breached, even if it originally had a lower priority.

The solution therefore combines ticket priority, SLA state, ticket status, filtering, searching, and pagination into one consistent queueing system.

The application is implemented as a full-stack TypeScript application with a React frontend, an Express backend, and SQLite for persistent storage. The backend contains the main business logic so that queue behavior remains consistent regardless of which client consumes the API.

The design also includes an escalation mechanism. When an active ticket breaches its agreed response deadline, its priority can be increased by exactly one level. The escalation is intentionally incremental:

NORMAL → HIGH → URGENT

This prevents a ticket from jumping directly from NORMAL to URGENT in a single escalation run.

---

## Problem Understanding

A helpdesk system normally receives tickets from many customers at different times. Each ticket may have a different priority and response expectation. If tickets are displayed only in creation order, an old urgent issue could appear below a recently created normal issue. Similarly, if pagination is applied before ranking, an important ticket may exist on another page and never appear near the top of the queue.

The most important requirement was therefore to make the queue reflect the actual urgency of the complete filtered ticket set.

The key design principle is:

FILTER → RANK → PAGINATE

This ordering is important.

Filtering determines which tickets are relevant to the current user or view. Ranking then determines which of those relevant tickets should be handled first. Pagination is performed only after ranking so that the first page always contains the highest-ranked tickets from the complete filtered result.

This avoids an incorrect implementation such as:

FILTER → PAGINATE → RANK

because ranking only a single page could hide a more urgent ticket that exists on another page.

---

## Priority Model

The original helpdesk model contains urgent and normal tickets. To support progressive escalation, an intermediate HIGH priority was introduced.

The priority hierarchy is:

URGENT > HIGH > NORMAL

Internally, the ranking logic assigns a numeric rank to each priority so that the queue can compare tickets consistently.

URGENT receives the highest priority rank, followed by HIGH, followed by NORMAL.

The priority model is represented centrally in the shared TypeScript types. Keeping the priority definition in shared code prevents the frontend and backend from using different allowed values.

The application therefore treats the following values as valid priorities:

- URGENT
- HIGH
- NORMAL

This shared representation also makes TypeScript catch missing cases when the priority model changes.

---

## SLA Design

Every ticket has an SLA deadline that represents the agreed response deadline.

The configured SLA windows are:

- URGENT: 2 hours
- HIGH: 4 hours
- NORMAL: 24 hours

The deadline is calculated from the ticket creation time and the priority at the time the ticket is created.

The important design decision is that automatic escalation does not reset the original SLA deadline.

For example, suppose a NORMAL ticket is created with a deadline of 10:00 AM. If the ticket is still unresolved after 10:00 AM, the escalation mechanism may change its priority from NORMAL to HIGH. The ticket still retains its original 10:00 AM SLA deadline.

This is intentional because changing the priority should not make the original response commitment disappear. The system should remember that the ticket has already breached its original SLA.

Therefore, escalation changes the urgency of the ticket without rewriting its historical SLA deadline.

---

## Detecting an Overdue Ticket

A ticket is considered overdue when its SLA deadline has passed and the ticket is still active.

The active states in this application are:

- OPEN
- IN_PROGRESS

The terminal states are:

- RESOLVED
- CLOSED

Resolved and closed tickets should not continue to generate escalation events because they no longer require an active response.

The overdue condition is based on the current time compared with the stored SLA deadline.

Conceptually:

current time > SLA deadline

If the deadline has not been reached, the ticket remains within SLA.

If the deadline has passed and the ticket is active, it becomes eligible for escalation.

---

## Queue Ranking Logic

The queue ranking is intentionally separated from the API and UI code.

The ranking logic is implemented in a dedicated shared queue module so that the same ordering rules can be reused wherever tickets need to be ranked.

The first major distinction is whether an active ticket is overdue.

An overdue active ticket is more pressing than an active ticket that is still within its SLA.

The general ranking structure is:

Overdue active tickets

then

Active tickets within SLA

then

Resolved and closed tickets

Priority is then used to order tickets within the relevant groups.

This means an overdue NORMAL ticket can become more important than an on-time URGENT ticket depending on the exact ranking rules and ticket state. The key idea is that SLA breach is treated as an important urgency signal rather than ignoring the deadline entirely.

The ranking function also considers deterministic tie-breaking so that tickets with otherwise equal urgency do not randomly change positions between requests.

Keeping the ranking logic deterministic makes the queue easier to reason about, test, and debug.

---

## Why Ranking Is Shared

The ranking function is not embedded directly inside an Express route or React component.

This was a deliberate architectural choice.

If ranking were implemented separately in the frontend and backend, the two implementations could eventually disagree. For example, the frontend could place HIGH above NORMAL while the backend returns a different order.

A shared ranking module provides one source of truth.

The backend uses the ranking logic to return correctly ordered data, while the frontend is responsible only for displaying the result.

This keeps business rules out of the presentation layer.

---

## Filtering, Ranking, and Pagination

The queue pipeline is one of the most important parts of the implementation.

The system follows:

FILTER → RANK → PAGINATE

Filtering can include conditions such as:

- Priority
- Status
- Overdue state
- Assigned-to-me
- Customer search

The filters are applied first because the user should only rank tickets relevant to the current query.

After filtering, the complete result set is ranked.

Only after ranking is pagination applied.

For example, if there are 54 matching tickets and the page size is 20, the system first determines the correct order of all 54 tickets. It then returns the first 20 tickets for page one.

This guarantees that page one represents the top of the actual queue rather than the top of an arbitrary subset.

---

## Customer Search

Customer search is designed to be case-insensitive.

The database stores a normalized customer name value so that searches do not need to depend on the exact capitalization used when the ticket was created.

For example, a search for:

rahul

can match:

Rahul Sharma

RAHUL SHARMA

rahul sharma

This improves usability while keeping the search implementation simple.

---

## Assigned-to-Me Filtering

Helpdesk systems are often used by multiple support engineers. A support engineer should be able to focus on the tickets assigned to them rather than reviewing the entire queue.

The assigned-to-me filter therefore restricts the ticket set to the current assignee.

This filter is applied before ranking so that the engineer receives a properly prioritized queue of only their assigned work.

The same FILTER → RANK → PAGINATE pipeline is preserved.

---

## Pagination Design

Pagination is implemented at the API level so that the backend can control the amount of data returned to the client.

The API provides information such as:

- Current page
- Page size
- Total matching tickets
- Total number of pages

For example:

{
  "page": 1,
  "pageSize": 20,
  "total": 54,
  "totalPages": 3
}

This allows the frontend to display pagination controls without having to independently calculate the total number of matching records.

More importantly, pagination is performed after ranking, which preserves the intended queue semantics.

---

# Automated Escalation Reasoning

The escalation mechanism was introduced to handle tickets that remain unresolved beyond their agreed response deadline.

The escalation chain is:

NORMAL → HIGH → URGENT

The most important constraint is that only one level can be increased during a single escalation run.

For example:

NORMAL → HIGH

is valid during one run.

The following is not allowed in one run:

NORMAL → URGENT

Similarly:

HIGH → URGENT

is valid, but only one level is increased.

This design prevents an overdue ticket from immediately skipping the intermediate priority.

---

## Why Escalation Is Incremental

Incremental escalation provides a predictable progression of urgency.

If a ticket becomes overdue, the first escalation communicates that the ticket needs more attention by moving it from NORMAL to HIGH.

If it remains overdue during a later run, it can move from HIGH to URGENT.

This makes the escalation state easier to understand and gives the system a clear progression:

Normal urgency

→ increased urgency

→ maximum urgency

The escalation function therefore maps each priority to its next priority:

NORMAL → HIGH

HIGH → URGENT

URGENT → URGENT

The final mapping means that URGENT tickets remain URGENT even if they are overdue.

---

## Why URGENT Does Not Escalate Further

URGENT is already the highest supported priority.

There is no higher priority value in the current model, so an overdue URGENT ticket remains URGENT.

The escalation function explicitly handles this case rather than attempting to create another priority level.

This also prevents repeated escalation runs from modifying an already maximum-priority ticket unnecessarily.

---

## Resolved and Closed Tickets

The escalation process explicitly excludes RESOLVED and CLOSED tickets.

This is important because a resolved ticket may have an old SLA deadline in the database, but it no longer represents active work.

If the escalation process ignored ticket status, an old resolved ticket could be repeatedly considered overdue and unnecessarily modified.

The query therefore considers only tickets whose status is not RESOLVED or CLOSED.

This keeps escalation focused on active support work.

---

## Persistence of Escalation

Escalation is not implemented as a temporary value in memory.

When a ticket is escalated, the new priority is written to SQLite.

For example:

NORMAL

becomes:

HIGH

and the database stores HIGH as the ticket's current priority.

This means the escalation remains after:

- Refreshing the application
- Restarting the backend
- Re-fetching the ticket
- Loading the ticket from another API request

Persistence is important because an automated escalation system should not lose its state when the server restarts.

---

## Preserving the Original SLA Deadline

A particularly important design decision is that the escalation operation updates the priority only.

It does not calculate a new SLA deadline.

For example:

Original ticket:

Priority = NORMAL

SLA deadline = 10:00 AM

After breach:

Priority = HIGH

SLA deadline = 10:00 AM

The deadline remains unchanged.

This preserves the original SLA commitment and prevents the system from accidentally extending the deadline simply because the ticket became more urgent.

The escalation module therefore performs a targeted database update rather than re-running the normal priority-update logic.

---

## Dedicated Escalation Module

Escalation is implemented in a dedicated module rather than being mixed into the general ticket ranking function.

This separation is useful because ranking and escalation have different responsibilities.

Ranking answers:

"Which ticket should appear first right now?"

Escalation answers:

"Which overdue active tickets should have their stored priority increased?"

Keeping these responsibilities separate makes both pieces easier to test.

It also prevents the queue-ranking function from unexpectedly modifying database state.

The ranking function is primarily concerned with ordering.

The escalation function is responsible for a controlled state change.

---

# Repository and Service Separation

The backend follows a layered structure.

The repository is responsible for database interaction.

The service layer is responsible for application-level ticket behavior.

The routes are responsible for HTTP communication.

This separation keeps the API layer from containing large amounts of database logic.

A typical request flow is:

HTTP Request

→ Express Route

→ Ticket Service

→ Ticket Repository

→ SQLite

The escalation mechanism follows the same general architecture while keeping the escalation-specific logic in its dedicated module.

---

## Repository Layer

The repository encapsulates SQLite operations.

Instead of allowing route handlers to construct SQL queries directly, database access is concentrated in the repository.

This makes the database interaction easier to maintain and reduces duplication.

The repository also converts database rows into the application's ticket representation.

---

## Service Layer

The service layer contains ticket-related business logic.

Examples include:

- Creating tickets
- Updating tickets
- Calculating SLA information
- Applying ticket-level business rules
- Returning tickets in the required queue order

Keeping this logic outside Express routes makes the application easier to test without requiring an HTTP request for every business-rule test.

---

## API Layer

Express routes expose the application's functionality through HTTP endpoints.

Examples include:

GET /api/tickets

GET /api/tickets/:id

POST /api/tickets

PATCH /api/tickets/:id

POST /api/tickets/escalate

The API layer validates incoming request data and delegates the actual business work to the appropriate backend components.

---

# Input Validation

Zod is used for API input validation.

This prevents invalid values from entering the application's business logic.

For example, the priority field accepts only:

URGENT

HIGH

NORMAL

Similarly, the status field is restricted to the supported ticket states.

This is preferable to relying only on frontend validation because API clients can send requests without using the React interface.

Backend validation therefore provides a second and more reliable boundary.

---

# SQLite Database Choice

SQLite was selected because the application is a relatively lightweight helpdesk system and does not require a separate database server for local development.

SQLite provides:

- Persistent storage
- SQL support
- Transactions
- Simple local setup
- Minimal infrastructure requirements

The application uses better-sqlite3 to communicate with SQLite from Node.js.

The database also uses a WAL configuration, which is useful for SQLite applications that may have concurrent read and write activity.

---

# Transactional Escalation

The escalation operation is performed inside a database transaction.

This is useful because one escalation run may update multiple tickets.

A transaction ensures that the database operation is treated as a single logical operation.

The process is conceptually:

Find overdue active tickets

→ Determine the next priority for each ticket

→ Update eligible tickets

→ Complete the transaction

If the operation fails during the transaction, SQLite can roll back the changes instead of leaving a partially completed escalation run.

This is an important reliability property for an automated background operation.

---

# Automatic Execution

The escalation mechanism is designed to run periodically rather than requiring a support engineer to manually inspect every ticket.

The backend can invoke the escalation function on an interval.

Each execution checks the current database state for overdue active tickets.

Because escalation is based on the stored priority and current SLA deadline, repeated runs are safe:

NORMAL can become HIGH

HIGH can become URGENT

URGENT remains URGENT

Resolved and closed tickets remain unchanged.

The database therefore acts as the source of truth for the current escalation state.

A manual escalation API endpoint is also useful because it allows the behavior to be triggered explicitly during development, testing, or operational debugging.

---

# Why Automatic Escalation Is Separate From Ranking

It may initially seem possible to simply display overdue NORMAL tickets as HIGH or URGENT without changing the database.

However, that would not satisfy the requirement that escalation persists.

A display-only approach would create a temporary calculated priority while the stored ticket remained NORMAL.

That would cause inconsistencies between different requests and clients.

For example, one component might display the ticket as URGENT while another API consumer still sees NORMAL.

The chosen approach changes the stored priority when the escalation condition is met.

This makes the ticket's new priority part of the persistent application state.

---

# Frontend Architecture

The frontend is implemented using React and TypeScript.

React is responsible for displaying:

- Ticket lists
- Ticket details
- Priority information
- Status information
- Filters
- Search controls
- Pagination
- Ticket actions

The frontend does not contain the authoritative queue-ranking algorithm.

Instead, it consumes the backend's ordered ticket results.

This keeps business rules centralized and prevents duplicate implementations.

---

# Why TypeScript Is Used

TypeScript is used throughout the application because the system contains several related domain types.

For example, a ticket contains:

- id
- customer
- title
- priority
- status
- assignee
- timestamps
- SLA information

Using TypeScript makes it possible to represent these structures explicitly.

The shared types also allow the frontend and backend to use the same definitions.

When HIGH was introduced as a new priority, TypeScript helped identify places where the old URGENT/NORMAL model was incomplete.

This made the priority change safer and reduced the chance of silently missing a case.

---

# Testing Strategy

Testing focuses on the most important business rules rather than only checking whether the server starts.

The project uses Vitest.

Important areas of behavior include:

- Ticket creation
- Ticket updates
- SLA calculation
- Overdue detection
- Queue ranking
- Filtering
- Pagination
- Priority handling
- Escalation

The escalation logic is especially important because it contains several edge cases.

The expected behavior includes:

NORMAL overdue → HIGH

HIGH overdue → URGENT

URGENT overdue → URGENT

RESOLVED overdue → no escalation

CLOSED overdue → no escalation

Non-overdue active ticket → no escalation

These cases verify that the escalation mechanism follows the intended state transitions.

---

# Handling Edge Cases

Several edge cases were considered during implementation.

## Already URGENT

An already URGENT ticket cannot move to a higher priority, so it remains URGENT.

## Resolved Ticket

A resolved ticket may have an SLA deadline in the past, but it should not escalate because the work has been completed.

## Closed Ticket

A closed ticket is also excluded from escalation.

## Not Yet Overdue

A ticket whose SLA deadline has not passed should not be escalated.

## Repeated Escalation Runs

Repeated runs should increase a ticket by only one level at a time.

For example:

First run:

NORMAL → HIGH

Second run:

HIGH → URGENT

Third run:

URGENT → URGENT

This makes repeated execution predictable.

## Empty Result

If there are no overdue active tickets, the escalation function returns an empty list and does not modify the database.

---

# Error Handling and Validation

The backend validates request payloads before processing them.

Invalid priority values, invalid statuses, or malformed input should not be allowed to reach the database layer.

Database constraints also provide an additional level of protection.

The SQLite schema restricts priority and status values so that invalid states cannot easily be persisted.

This creates multiple validation boundaries:

Client validation

→ API validation

→ Application logic

→ Database constraints

---

# Performance Considerations

The application is designed for a moderate-sized helpdesk dataset.

SQLite provides sufficient performance for a local or small-scale application, while indexes are used for frequently searched or filtered ticket fields.

The database also stores a normalized customer-name value to make case-insensitive customer search easier.

Pagination prevents the frontend from receiving unnecessarily large result sets.

The queue pipeline also keeps the conceptual responsibilities clear:

FILTER

then

RANK

then

PAGINATE

For a much larger production system, ranking and pagination could be moved more heavily into SQL or a dedicated database query strategy. For the current application scale, keeping the queue behavior explicit and testable is more important than prematurely optimizing the implementation.

---

# Maintainability

The project is organized around clear responsibilities.

Shared domain types are stored separately from server-specific code.

SLA calculations are separated into their own module.

Queue ranking is separated into its own module.

Escalation is separated from ranking.

Database operations are handled through the repository.

Business logic is handled by the service layer.

HTTP handling is implemented through Express routes.

This organization makes future changes easier.

For example, if another priority such as CRITICAL were introduced later, the shared priority type, ranking map, escalation rules, and validation schema could be updated systematically.

---

# Trade-offs

One trade-off in the current design is the use of SQLite instead of a larger database system such as PostgreSQL.

SQLite is easier to set up and is well suited for development and demonstration, but a large production helpdesk system with many concurrent users could eventually require a server-based relational database.

Another trade-off is keeping some queue-ranking behavior in application code rather than implementing the entire ranking operation as a complex SQL query.

Application-level ranking makes the business rule easier to read, understand, and unit test. However, for very large datasets, database-side ordering would likely be more scalable.

The current implementation prioritizes clarity, correctness, and maintainability for the intended project scale.

---

# Security Considerations

The backend does not rely solely on frontend restrictions.

Incoming data is validated on the server.

Database queries use parameterized statements rather than dynamically concatenating user input into SQL.

This reduces the risk of SQL injection through customer search or ticket fields.

The database also enforces valid priority and status values through schema constraints.

For a production deployment, additional authentication, authorization, rate limiting, secure headers, logging, and more detailed access control would be required.

---

# Overall Design Philosophy

The main design philosophy of the project is to keep business rules explicit and predictable.

The queue should always answer:

"What should the support engineer handle first?"

The escalation mechanism should answer:

"Has an active ticket missed its agreed response deadline, and if so, should its priority increase?"

These are related but separate questions.

The queue uses current ticket state to determine ordering.

The escalation mechanism changes ticket state when an SLA breach occurs.

The database persists that state.

The frontend displays the resulting queue.

This separation makes the system easier to understand and prevents UI-specific behavior from becoming the source of truth for business rules.

---

# Final Result

The resulting system provides a complete helpdesk ticket workflow with:

- Persistent ticket storage
- Priority management
- SLA deadlines
- Overdue detection
- Priority-based queue ordering
- SLA-aware queue ordering
- Filtering
- Customer search
- Assigned-to-me filtering
- Pagination
- Input validation
- Automated priority escalation
- Persistent escalation state
- Manual escalation triggering
- Unit and integration testing
- React-based frontend
- Express-based backend
- SQLite database
- Shared TypeScript domain types

The most important architectural decision is the separation between queue ranking and ticket escalation.

Ranking determines the order in which tickets should be presented.

Escalation changes the stored priority of tickets that have breached their SLA.

Together, these mechanisms create a queue that is both responsive to current urgency and capable of progressively escalating unresolved work.

The overall flow can be summarized as:

Ticket Created
    ↓
Priority Assigned
    ↓
SLA Deadline Calculated
    ↓
Ticket Stored in SQLite
    ↓
Filters Applied
    ↓
Complete Result Set Ranked
    ↓
Pagination Applied
    ↓
Highest-Priority Tickets Displayed
    ↓
SLA Deadline Breached?
    ↓
Active Ticket?
    ↓
Priority Escalated by One Level
    ↓
New Priority Persisted in SQLite
    ↓
Queue Re-ranked

This approach provides a clear separation of concerns while satisfying the core helpdesk queue requirements and the automated escalation requirement.
