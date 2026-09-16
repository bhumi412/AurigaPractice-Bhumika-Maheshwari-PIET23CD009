/**
 * The shared domain model.
 *
 * Nothing in this file knows about HTTP, SQLite or React. Both the API and the
 * tests import from here, so there is exactly one definition of what a ticket is.
 */

export type Priority = 'URGENT' | 'NORMAL';

export type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export const PRIORITIES: Priority[] = ['URGENT', 'NORMAL'];

export const STATUSES: Status[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

/**
 * A ticket is "active" while the helpdesk still owes the customer a response.
 * Active tickets are the only ones that can be overdue and the only ones that
 * compete for the top of the queue.
 */
export const ACTIVE_STATUSES: Status[] = ['OPEN', 'IN_PROGRESS'];

export interface Ticket {
  id: string;
  customerName: string;
  customerEmail: string | null;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  /** null means the ticket is unassigned. */
  assignee: string | null;
  /** ISO 8601 UTC strings everywhere, so dates sort correctly as text too. */
  createdAt: string;
  updatedAt: string;
  /** Derived from createdAt + priority. Never entered by hand. */
  slaDeadline: string;
  resolvedAt: string | null;
  /**
   * The SLA is a *response* time, so this records when an agent first replied.
   * Stored for reporting; the queue rule below uses status, per the spec.
   */
  firstRespondedAt: string | null;
}

/** True while the helpdesk still owes this customer a response. */
export function isActiveTicket(ticket: Ticket): boolean {
  return ACTIVE_STATUSES.includes(ticket.status);
}
