/**
 * THE QUEUE RANKING ALGORITHM
 * ===========================
 *
 * This module is the heart of the application. It is a pure function of
 * (tickets, now) - no database, no HTTP, no React - so it can be tested on its
 * own and reused anywhere.
 *
 * Every ticket is reduced to a 4-part sort key and compared part by part.
 * The first part that differs decides the order:
 *
 *   1. bucket        0 = active & overdue, 1 = active & on time, 2 = resolved/closed
 *   2. priorityRank  0 = URGENT, 1 = NORMAL
 *   3. slaDeadline   sooner deadline first
 *   4. createdAt     older ticket first   (then id, as a final tie-break)
 *
 * WHY OVERDUE JUMPS THE QUEUE
 * Priority says how bad the problem is. Overdue says a promise has already been
 * broken and the damage is still growing. A broken promise outranks a promise
 * you can still keep, so breach state is checked before priority.
 *
 * A useful property: because `now` only moves forward, an active ticket can
 * never fall back out of the overdue bucket. The ordering is monotone in time,
 * so the queue never flaps.
 *
 * COMPLEXITY
 *   getTicketRank / compareTickets : O(1) time, O(1) space
 *   sortTicketsByUrgency           : O(n log n) time, O(n) space
 *
 * The rank depends on `now`, so it cannot be cached across time - it is
 * recomputed per request. At a few thousand tickets that is sub-millisecond.
 */

import { Priority, Ticket, isActiveTicket } from '../types.js';
import { isOverdue, toMillis } from '../sla.js';

/** Lower number = closer to the top of the queue. */
export const QUEUE_BUCKET = {
  OVERDUE: 0,
  ACTIVE: 1,
  CLOSED: 2,
} as const;

const PRIORITY_RANK: Record<Priority, number> = {
  URGENT: 0,
  HIGH: 1,
  NORMAL: 2,
};

export interface TicketRank {
  bucket: number;
  priorityRank: number;
  /** Deadline as a timestamp, ascending. */
  deadlineMs: number;
  /** Creation time as a timestamp, ascending. */
  createdAtMs: number;
  /** Final tie-break so the order is strict and reproducible. */
  id: string;
}

/**
 * Build the sort key for one ticket at a given moment.
 * Exported on its own because it is the clearest way to explain - or debug -
 * why a particular ticket sits where it does.
 */
export function getTicketRank(ticket: Ticket, now: Date | number | string): TicketRank {
  let bucket: number;
  if (!isActiveTicket(ticket)) {
    // Resolved and closed tickets never compete with active work.
    bucket = QUEUE_BUCKET.CLOSED;
  } else if (isOverdue(ticket, now)) {
    bucket = QUEUE_BUCKET.OVERDUE;
  } else {
    bucket = QUEUE_BUCKET.ACTIVE;
  }

  return {
    bucket,
    priorityRank: PRIORITY_RANK[ticket.priority],
    deadlineMs: toMillis(ticket.slaDeadline),
    createdAtMs: toMillis(ticket.createdAt),
    id: ticket.id,
  };
}

/**
 * Comparator: negative if `a` should appear above `b`.
 *
 * The id comparison at the end means this never returns 0 for two different
 * tickets, so the result does not depend on the sort being stable.
 */
export function compareTickets(a: Ticket, b: Ticket, now: Date | number | string): number {
  const rankA = getTicketRank(a, now);
  const rankB = getTicketRank(b, now);

  if (rankA.bucket !== rankB.bucket) return rankA.bucket - rankB.bucket;
  if (rankA.priorityRank !== rankB.priorityRank) return rankA.priorityRank - rankB.priorityRank;
  if (rankA.deadlineMs !== rankB.deadlineMs) return rankA.deadlineMs - rankB.deadlineMs;
  if (rankA.createdAtMs !== rankB.createdAtMs) return rankA.createdAtMs - rankB.createdAtMs;
  return rankA.id.localeCompare(rankB.id);
}

/**
 * Sort a list of tickets into queue order. Returns a new array; the input is
 * left untouched so callers never get surprise mutations.
 */
export function sortTicketsByUrgency(
  tickets: Ticket[],
  now: Date | number | string = Date.now()
): Ticket[] {
  return [...tickets].sort((a, b) => compareTickets(a, b, now));
}

/**
 * The main queue: active tickets only, in ranked order.
 * Resolved and closed tickets are dropped rather than pushed to the bottom,
 * because they carry no outstanding SLA obligation.
 */
export function getActiveQueue(
  tickets: Ticket[],
  now: Date | number | string = Date.now()
): Ticket[] {
  return sortTicketsByUrgency(tickets.filter(isActiveTicket), now);
}

/** A short, human readable reason for a ticket's position - handy in the UI and in demos. */
export function explainRank(ticket: Ticket, now: Date | number | string): string {
  const rank = getTicketRank(ticket, now);
  if (rank.bucket === QUEUE_BUCKET.CLOSED) return 'Not in queue (resolved or closed)';
  const state = rank.bucket === QUEUE_BUCKET.OVERDUE ? 'SLA breached' : 'Within SLA';
  return `${state} - ${ticket.priority.toLowerCase()} priority, due ${ticket.slaDeadline}`;
}
