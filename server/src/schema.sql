-- Tickets table.
--
-- Notes:
--   * customer_name_lc is a lowercased copy of customer_name so search can use
--     a plain indexed prefix match instead of scanning every row.
--   * sla_deadline is stored because it is fixed at creation time (or when the
--     priority changes) - see shared/sla.ts. "Overdue" itself is NEVER stored;
--     it is calculated at read time from (now > sla_deadline).
CREATE TABLE IF NOT EXISTS tickets (
  id                  TEXT PRIMARY KEY,
  customer_name       TEXT NOT NULL,
  customer_name_lc    TEXT NOT NULL,
  customer_email      TEXT,
  title               TEXT NOT NULL,
  description         TEXT NOT NULL DEFAULT '',
  priority            TEXT NOT NULL CHECK (priority IN ('URGENT', 'HIGH', 'NORMAL')),
  status              TEXT NOT NULL CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  assignee            TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  sla_deadline        TEXT NOT NULL,
  resolved_at         TEXT,
  first_responded_at  TEXT
);

-- Speeds up "active tickets ordered by deadline", the main queue query.
CREATE INDEX IF NOT EXISTS idx_tickets_status_deadline ON tickets(status, sla_deadline);

-- Speeds up the assignee filter ("assigned to me" / "unassigned" / a specific person).
CREATE INDEX IF NOT EXISTS idx_tickets_assignee ON tickets(assignee);

-- Speeds up customer search (prefix match, e.g. customer_name_lc LIKE 'pri%').
CREATE INDEX IF NOT EXISTS idx_tickets_customer_lc ON tickets(customer_name_lc);
