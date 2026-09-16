import { describe, it, expect } from 'vitest';
import { SLA_WINDOWS_MS, calculateSlaDeadline, isOverdue, msUntilDeadline } from './sla.js';
import { makeTicket, HOUR, MINUTE } from './testFactory.js';

const NOW = new Date('2026-03-10T12:00:00.000Z').getTime();

describe('SLA calculation', () => {
  it('gives urgent tickets a 2 hour window', () => {
    const created = '2026-03-10T09:00:00.000Z';
    expect(calculateSlaDeadline(created, 'URGENT')).toBe('2026-03-10T11:00:00.000Z');
    expect(SLA_WINDOWS_MS.URGENT).toBe(2 * HOUR);
  });

  it('gives normal tickets a 24 hour window', () => {
    const created = '2026-03-10T09:00:00.000Z';
    expect(calculateSlaDeadline(created, 'NORMAL')).toBe('2026-03-11T09:00:00.000Z');
    expect(SLA_WINDOWS_MS.NORMAL).toBe(24 * HOUR);
  });

  it('measures the deadline from creation time, not from "now"', () => {
    const oldTicket = calculateSlaDeadline('2020-01-01T00:00:00.000Z', 'URGENT');
    expect(oldTicket).toBe('2020-01-01T02:00:00.000Z');
  });
});

describe('overdue is dynamic', () => {
  it('is false while the deadline is in the future', () => {
    const ticket = makeTicket({ priority: 'URGENT', createdAt: NOW - 1 * HOUR });
    expect(isOverdue(ticket, NOW)).toBe(false);
    expect(msUntilDeadline(ticket, NOW)).toBe(1 * HOUR);
  });

  it('is false at the exact instant of the deadline', () => {
    const ticket = makeTicket({ priority: 'URGENT', createdAt: NOW - 2 * HOUR });
    expect(isOverdue(ticket, NOW)).toBe(false);
  });

  it('becomes true one millisecond later - same ticket, no data changed', () => {
    const ticket = makeTicket({ priority: 'URGENT', createdAt: NOW - 2 * HOUR });
    expect(isOverdue(ticket, NOW)).toBe(false);
    expect(isOverdue(ticket, NOW + 1)).toBe(true);
  });

  it('never marks resolved or closed tickets as overdue', () => {
    const resolved = makeTicket({
      priority: 'URGENT',
      status: 'RESOLVED',
      createdAt: NOW - 10 * HOUR,
    });
    const closed = makeTicket({ priority: 'NORMAL', status: 'CLOSED', createdAt: NOW - 90 * HOUR });
    expect(isOverdue(resolved, NOW)).toBe(false);
    expect(isOverdue(closed, NOW)).toBe(false);
  });

  it('reports a negative remaining time for breached tickets', () => {
    const ticket = makeTicket({ priority: 'URGENT', createdAt: NOW - 2 * HOUR - 30 * MINUTE });
    expect(msUntilDeadline(ticket, NOW)).toBe(-30 * MINUTE);
  });
});
