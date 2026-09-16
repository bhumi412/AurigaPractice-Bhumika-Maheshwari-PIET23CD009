/**
 * SLA rules.
 *
 * Two ideas that must not be confused:
 *
 *   slaDeadline  is STATIC  - fixed when the ticket is created (or re-prioritised).
 *   overdue      is DYNAMIC - depends on the current time, so it is never stored.
 *
 * Every function here takes `now` as an argument instead of calling Date.now()
 * internally. That is what makes the queue testable: a test can say "pretend it
 * is 14:00" without touching the system clock.
 */

import { Priority, Ticket, isActiveTicket } from './types.js';

const HOUR_MS = 60 * 60 * 1000;

/**
 * How long we promise to respond, per priority.
 * This is the only place the business rule lives, so a different helpdesk can
 * change the numbers - or add a tier - without touching the ranking algorithm.
 */
export const SLA_WINDOWS_MS: Record<Priority, number> = {
  URGENT: 2 * HOUR_MS,
  NORMAL: 24 * HOUR_MS,
};

/** Accepts a Date, a timestamp, or an ISO string and returns milliseconds. */
export function toMillis(value: Date | number | string): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return new Date(value).getTime();
}

/**
 * slaDeadline = createdAt + the window for that priority.
 * Called on create, and again if a ticket's priority changes.
 */
export function calculateSlaDeadline(
  createdAt: Date | number | string,
  priority: Priority
): string {
  const createdMs = toMillis(createdAt);
  return new Date(createdMs + SLA_WINDOWS_MS[priority]).toISOString();
}

/**
 * Milliseconds left before the promise is broken.
 * Negative means the promise is already broken, by that many milliseconds.
 */
export function msUntilDeadline(ticket: Ticket, now: Date | number | string): number {
  return toMillis(ticket.slaDeadline) - toMillis(now);
}

/**
 * The core time rule: currentTime > slaDeadline.
 *
 * Strictly greater, so a ticket is NOT overdue at the exact instant of its
 * deadline - you still have that moment to answer.
 *
 * Resolved and closed tickets are never overdue: the response was given (or the
 * ticket was dropped), so there is no outstanding promise left to break.
 */
export function isOverdue(ticket: Ticket, now: Date | number | string): boolean {
  if (!isActiveTicket(ticket)) return false;
  return toMillis(now) > toMillis(ticket.slaDeadline);
}

/** Human readable countdown for the dashboard, e.g. "1h 30m left" / "2h 5m overdue". */
export function formatTimeRemaining(ticket: Ticket, now: Date | number | string): string {
  const remaining = msUntilDeadline(ticket, now);
  const overdue = remaining < 0;
  const totalMinutes = Math.floor(Math.abs(remaining) / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (parts.length < 2) parts.push(`${minutes}m`);

  return `${parts.join(' ')} ${overdue ? 'overdue' : 'left'}`;
}
