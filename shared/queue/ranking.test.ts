/**
 * Tests for the queue ranking rule.
 * Each test isolates ONE reason a ticket can outrank another, so a failure
 * points straight at the rule that broke.
 */

import { describe, it, expect } from 'vitest';
import {
  getTicketRank,
  compareTickets,
  sortTicketsByUrgency,
  getActiveQueue,
  QUEUE_BUCKET,
} from './ranking.js';
import { makeTicket, HOUR, MINUTE } from '../testFactory.js';

const NOW = new Date('2026-03-10T12:00:00.000Z').getTime();

/** Convenience: the ids of the queue, top first. */
const idsOf = (tickets: ReturnType<typeof makeTicket>[]) => tickets.map((t) => t.id);

describe('1. overdue beats not overdue', () => {
  it('puts an overdue NORMAL ticket above an on-time URGENT ticket', () => {
    // The case that proves we are not just sorting by priority.
    const overdueNormal = makeTicket({
      id: 'TKT-0001',
      priority: 'NORMAL',
      createdAt: NOW - 26 * HOUR, // due 2h ago
    });
    const onTimeUrgent = makeTicket({
      id: 'TKT-0002',
      priority: 'URGENT',
      createdAt: NOW - 1 * HOUR, // due in 1h
    });

    const queue = sortTicketsByUrgency([onTimeUrgent, overdueNormal], NOW);
    expect(idsOf(queue)).toEqual(['TKT-0001', 'TKT-0002']);
  });

  it('places overdue tickets in the overdue bucket', () => {
    const ticket = makeTicket({ priority: 'URGENT', createdAt: NOW - 3 * HOUR });
    expect(getTicketRank(ticket, NOW).bucket).toBe(QUEUE_BUCKET.OVERDUE);
  });
});

describe('2. priority breaks ties inside a bucket', () => {
  it('orders two overdue tickets urgent first', () => {
    const overdueNormal = makeTicket({
      id: 'TKT-0001',
      priority: 'NORMAL',
      createdAt: NOW - 30 * HOUR,
    });
    const overdueUrgent = makeTicket({
      id: 'TKT-0002',
      priority: 'URGENT',
      createdAt: NOW - 3 * HOUR,
    });

    const queue = sortTicketsByUrgency([overdueNormal, overdueUrgent], NOW);
    expect(idsOf(queue)).toEqual(['TKT-0002', 'TKT-0001']);
  });

  it('orders two on-time tickets urgent first', () => {
    const normal = makeTicket({ id: 'TKT-0001', priority: 'NORMAL', createdAt: NOW - 1 * HOUR });
    const urgent = makeTicket({ id: 'TKT-0002', priority: 'URGENT', createdAt: NOW - 1 * HOUR });

    const queue = sortTicketsByUrgency([normal, urgent], NOW);
    expect(idsOf(queue)).toEqual(['TKT-0002', 'TKT-0001']);
  });
});

describe('3. earlier SLA deadline wins when bucket and priority match', () => {
  it('puts the sooner deadline first', () => {
    const dueLater = makeTicket({
      id: 'TKT-0001',
      priority: 'URGENT',
      createdAt: NOW - 30 * MINUTE, // due in 90m
    });
    const dueSooner = makeTicket({
      id: 'TKT-0002',
      priority: 'URGENT',
      createdAt: NOW - 90 * MINUTE, // due in 30m
    });

    const queue = sortTicketsByUrgency([dueLater, dueSooner], NOW);
    expect(idsOf(queue)).toEqual(['TKT-0002', 'TKT-0001']);
  });

  it('puts the most-breached ticket first among equal-priority overdue tickets', () => {
    const breachedRecently = makeTicket({
      id: 'TKT-0001',
      priority: 'URGENT',
      createdAt: NOW - 2 * HOUR - 5 * MINUTE,
    });
    const breachedLongAgo = makeTicket({
      id: 'TKT-0002',
      priority: 'URGENT',
      createdAt: NOW - 8 * HOUR,
    });

    const queue = sortTicketsByUrgency([breachedRecently, breachedLongAgo], NOW);
    expect(idsOf(queue)).toEqual(['TKT-0002', 'TKT-0001']);
  });
});

describe('4. ties are deterministic', () => {
  it('falls back to creation time, then ticket id', () => {
    const created = NOW - 1 * HOUR;
    const sameEverything = ['TKT-0003', 'TKT-0001', 'TKT-0002'].map((id) =>
      makeTicket({ id, priority: 'URGENT', createdAt: created })
    );

    const queue = sortTicketsByUrgency(sameEverything, NOW);
    expect(idsOf(queue)).toEqual(['TKT-0001', 'TKT-0002', 'TKT-0003']);
  });

  it('produces the same order no matter how the input is shuffled', () => {
    const tickets = [
      makeTicket({ id: 'TKT-0001', priority: 'URGENT', createdAt: NOW - 3 * HOUR }),
      makeTicket({ id: 'TKT-0002', priority: 'NORMAL', createdAt: NOW - 25 * HOUR }),
      makeTicket({ id: 'TKT-0003', priority: 'URGENT', createdAt: NOW - 1 * HOUR }),
      makeTicket({ id: 'TKT-0004', priority: 'NORMAL', createdAt: NOW - 2 * HOUR }),
      makeTicket({ id: 'TKT-0005', priority: 'URGENT', createdAt: NOW - 1 * HOUR }),
    ];

    const expected = idsOf(sortTicketsByUrgency(tickets, NOW));
    const reversed = idsOf(sortTicketsByUrgency([...tickets].reverse(), NOW));
    const rotated = idsOf(sortTicketsByUrgency([...tickets.slice(2), ...tickets.slice(0, 2)], NOW));

    expect(reversed).toEqual(expected);
    expect(rotated).toEqual(expected);
  });

  it('never returns 0 for two different tickets', () => {
    const a = makeTicket({ id: 'TKT-0001', priority: 'URGENT', createdAt: NOW - 1 * HOUR });
    const b = makeTicket({ id: 'TKT-0002', priority: 'URGENT', createdAt: NOW - 1 * HOUR });
    expect(compareTickets(a, b, NOW)).not.toBe(0);
  });
});

describe('5. resolved and closed tickets do not compete', () => {
  it('sinks them below every active ticket, even when badly breached', () => {
    const resolvedBreached = makeTicket({
      id: 'TKT-0001',
      priority: 'URGENT',
      status: 'RESOLVED',
      createdAt: NOW - 50 * HOUR,
    });
    const activeOnTime = makeTicket({
      id: 'TKT-0002',
      priority: 'NORMAL',
      createdAt: NOW - 1 * HOUR,
    });

    const queue = sortTicketsByUrgency([resolvedBreached, activeOnTime], NOW);
    expect(idsOf(queue)).toEqual(['TKT-0002', 'TKT-0001']);
    expect(getTicketRank(resolvedBreached, NOW).bucket).toBe(QUEUE_BUCKET.CLOSED);
  });

  it('drops them from the active queue entirely', () => {
    const tickets = [
      makeTicket({ id: 'TKT-0001', status: 'RESOLVED', createdAt: NOW - 50 * HOUR }),
      makeTicket({ id: 'TKT-0002', status: 'CLOSED', createdAt: NOW - 50 * HOUR }),
      makeTicket({ id: 'TKT-0003', status: 'OPEN', createdAt: NOW - 1 * HOUR }),
      makeTicket({ id: 'TKT-0004', status: 'IN_PROGRESS', createdAt: NOW - 1 * HOUR }),
    ];

    expect(idsOf(getActiveQueue(tickets, NOW))).toEqual(['TKT-0003', 'TKT-0004']);
  });
});

describe('6. the queue re-orders as time passes', () => {
  it('moves a normal ticket to the top once it breaches, with no data change', () => {
    // Normal ticket created 23h ago -> due in 1 hour.
    const normal = makeTicket({ id: 'TKT-0001', priority: 'NORMAL', createdAt: NOW - 23 * HOUR });
    // Urgent ticket created just now -> due in 2 hours.
    const urgent = makeTicket({ id: 'TKT-0002', priority: 'URGENT', createdAt: NOW });
    const tickets = [normal, urgent];

    // Right now the urgent ticket leads: both are on time, urgent wins on priority.
    expect(idsOf(sortTicketsByUrgency(tickets, NOW))).toEqual(['TKT-0002', 'TKT-0001']);

    // 90 minutes later the normal ticket has breached and jumps the queue,
    // even though the urgent ticket is still within its SLA.
    const later = NOW + 90 * MINUTE;
    expect(idsOf(sortTicketsByUrgency(tickets, later))).toEqual(['TKT-0001', 'TKT-0002']);
  });

  it('keeps a breached ticket in the overdue bucket as time keeps moving', () => {
    const ticket = makeTicket({ priority: 'URGENT', createdAt: NOW - 3 * HOUR });
    for (const offset of [0, 1 * HOUR, 48 * HOUR]) {
      expect(getTicketRank(ticket, NOW + offset).bucket).toBe(QUEUE_BUCKET.OVERDUE);
    }
  });
});

describe('7. a realistic mixed queue', () => {
  it('orders a full scenario exactly as the rule predicts', () => {
    const tickets = [
      // bucket 1 (on time)
      makeTicket({ id: 'TKT-0050', priority: 'NORMAL', createdAt: NOW - 19 * HOUR }), // due in 5h
      makeTicket({ id: 'TKT-0040', priority: 'URGENT', createdAt: NOW - 1 * HOUR }), // due in 1h
      // bucket 0 (overdue)
      makeTicket({ id: 'TKT-0030', priority: 'NORMAL', createdAt: NOW - 26 * HOUR }), // 2h over
      makeTicket({ id: 'TKT-0020', priority: 'URGENT', createdAt: NOW - 150 * MINUTE }), // 30m over
      makeTicket({ id: 'TKT-0010', priority: 'URGENT', createdAt: NOW - 5 * HOUR }), // 3h over
      // bucket 2
      makeTicket({ id: 'TKT-0060', priority: 'URGENT', status: 'RESOLVED', createdAt: NOW - 9 * HOUR }),
    ];

    expect(idsOf(sortTicketsByUrgency(tickets, NOW))).toEqual([
      'TKT-0010', // overdue + urgent + earliest deadline
      'TKT-0020', // overdue + urgent
      'TKT-0030', // overdue + normal
      'TKT-0040', // on time + urgent
      'TKT-0050', // on time + normal
      'TKT-0060', // resolved, out of the race
    ]);
  });
});

describe('8. defensive behaviour', () => {
  it('does not mutate the input array', () => {
    const tickets = [
      makeTicket({ id: 'TKT-0002', priority: 'NORMAL', createdAt: NOW - 30 * HOUR }),
      makeTicket({ id: 'TKT-0001', priority: 'URGENT', createdAt: NOW - 1 * HOUR }),
    ];
    const before = idsOf(tickets);
    sortTicketsByUrgency(tickets, NOW);
    expect(idsOf(tickets)).toEqual(before);
  });

  it('handles an empty queue and a single ticket', () => {
    expect(sortTicketsByUrgency([], NOW)).toEqual([]);
    const only = makeTicket({ id: 'TKT-0001' });
    expect(idsOf(sortTicketsByUrgency([only], NOW))).toEqual(['TKT-0001']);
  });
});
