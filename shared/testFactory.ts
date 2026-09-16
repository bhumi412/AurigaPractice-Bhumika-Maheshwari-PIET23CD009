/**
 * Small helper for building tickets in tests.
 * Keeps the test files focused on the rule being tested instead of boilerplate.
 */

import { Ticket, Priority, Status } from './types.js';
import { calculateSlaDeadline } from './sla.js';

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;

let counter = 0;

interface TicketOverrides {
  id?: string;
  customerName?: string;
  title?: string;
  priority?: Priority;
  status?: Status;
  assignee?: string | null;
  createdAt?: string | number | Date;
  /** Override only when a test needs a deadline that does not follow the SLA rule. */
  slaDeadline?: string;
  resolvedAt?: string | null;
}

export function makeTicket(overrides: TicketOverrides = {}): Ticket {
  counter += 1;
  const priority = overrides.priority ?? 'NORMAL';
  const createdAt = new Date(
    overrides.createdAt ? new Date(overrides.createdAt).getTime() : Date.now()
  ).toISOString();

  return {
    id: overrides.id ?? `TKT-${String(counter).padStart(4, '0')}`,
    customerName: overrides.customerName ?? 'Test Customer',
    customerEmail: null,
    title: overrides.title ?? 'Test issue',
    description: '',
    priority,
    status: overrides.status ?? 'OPEN',
    assignee: overrides.assignee === undefined ? 'priya' : overrides.assignee,
    createdAt,
    updatedAt: createdAt,
    slaDeadline: overrides.slaDeadline ?? calculateSlaDeadline(createdAt, priority),
    resolvedAt: overrides.resolvedAt ?? null,
    firstRespondedAt: null,
  };
}

/** Reset ids between test files so generated ids stay predictable. */
export function resetTicketCounter(): void {
  counter = 0;
}
