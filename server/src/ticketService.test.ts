import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TicketRepository } from './repository.js';
import { TicketService } from './ticketService.js';
import { calculateSlaDeadline } from '../../shared/sla.js';
import { Priority } from '../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NOW = new Date('2026-03-10T12:00:00.000Z').getTime();
const HOUR = 60 * 60 * 1000;

function createTestDb(): Database.Database {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  const db = new Database(':memory:');
  db.exec(schema);
  return db;
}

function seedTicket(
  repo: TicketRepository,
  id: string,
  overrides: {
    customerName?: string;
    priority?: Priority;
    assignee?: string | null;
    status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
    ageMs?: number;
  } = {}
) {
  const priority = overrides.priority ?? 'NORMAL';
  const createdAt = new Date(NOW - (overrides.ageMs ?? HOUR)).toISOString();
  repo.create({
    id,
    customerName: overrides.customerName ?? 'Test Customer',
    title: 'Issue',
    priority,
    status: overrides.status ?? 'OPEN',
    assignee: overrides.assignee === undefined ? null : overrides.assignee,
    createdAt,
    slaDeadline: calculateSlaDeadline(createdAt, priority),
  });
}

describe('TicketService.listTickets - filter, rank, paginate pipeline', () => {
  let repo: TicketRepository;
  let service: TicketService;

  beforeEach(() => {
    repo = new TicketRepository(createTestDb());
    service = new TicketService(repo);
  });

  it('ranks the full filtered set before paginating (correct queue across pages)', () => {
    // 5 active tickets with distinct ranks; page size 2 should return exactly
    // the top 2 on page 1 and the next 2 on page 2, in rank order.
    seedTicket(repo, 'TKT-0001', { priority: 'NORMAL', ageMs: 30 * HOUR }); // overdue normal
    seedTicket(repo, 'TKT-0002', { priority: 'URGENT', ageMs: 3 * HOUR }); // overdue urgent
    seedTicket(repo, 'TKT-0003', { priority: 'URGENT', ageMs: 1 * HOUR }); // on-time urgent
    seedTicket(repo, 'TKT-0004', { priority: 'NORMAL', ageMs: 2 * HOUR }); // on-time normal
    seedTicket(repo, 'TKT-0005', { priority: 'NORMAL', ageMs: 1 * HOUR }); // on-time normal, newer

    const page1 = service.listTickets({ page: 1, pageSize: 2, now: NOW });
    const page2 = service.listTickets({ page: 2, pageSize: 2, now: NOW });
    const page3 = service.listTickets({ page: 3, pageSize: 2, now: NOW });

    expect(page1.items.map((t) => t.id)).toEqual(['TKT-0002', 'TKT-0001']); // both overdue, urgent first
    expect(page2.items.map((t) => t.id)).toEqual(['TKT-0003', 'TKT-0004']);
    expect(page3.items.map((t) => t.id)).toEqual(['TKT-0005']);
    expect(page1.total).toBe(5);
    expect(page1.totalPages).toBe(3);
  });

  it('filters by status', () => {
    seedTicket(repo, 'TKT-0001', { status: 'OPEN' });
    seedTicket(repo, 'TKT-0002', { status: 'RESOLVED' });

    const result = service.listTickets({ status: 'RESOLVED', now: NOW });
    expect(result.items.map((t) => t.id)).toEqual(['TKT-0002']);
  });

  it('filters by assignee, including "unassigned"', () => {
    seedTicket(repo, 'TKT-0001', { assignee: 'priya' });
    seedTicket(repo, 'TKT-0002', { assignee: 'rahul' });
    seedTicket(repo, 'TKT-0003', { assignee: null });

    expect(service.listTickets({ assignee: 'priya', now: NOW }).items.map((t) => t.id)).toEqual([
      'TKT-0001',
    ]);
    expect(service.listTickets({ assignee: 'unassigned', now: NOW }).items.map((t) => t.id)).toEqual([
      'TKT-0003',
    ]);
  });

  it('searches by customer name', () => {
    seedTicket(repo, 'TKT-0001', { customerName: 'Aarav Sharma' });
    seedTicket(repo, 'TKT-0002', { customerName: 'Priya Nair' });

    const result = service.listTickets({ customerSearch: 'aar', now: NOW });
    expect(result.items.map((t) => t.id)).toEqual(['TKT-0001']);
  });

  it('the overdue filter only returns active, breached tickets', () => {
    seedTicket(repo, 'TKT-0001', { priority: 'URGENT', ageMs: 3 * HOUR }); // overdue
    seedTicket(repo, 'TKT-0002', { priority: 'URGENT', ageMs: 1 * HOUR }); // on time
    seedTicket(repo, 'TKT-0003', { priority: 'URGENT', ageMs: 30 * HOUR, status: 'RESOLVED' }); // breached but resolved

    const result = service.listTickets({ overdueOnly: true, now: NOW });
    expect(result.items.map((t) => t.id)).toEqual(['TKT-0001']);
  });

  it('paginates correctly with metadata', () => {
    for (let i = 1; i <= 25; i++) {
      seedTicket(repo, `TKT-${String(i).padStart(4, '0')}`, { ageMs: i * HOUR });
    }

    const page1 = service.listTickets({ page: 1, pageSize: 10, now: NOW });
    const page3 = service.listTickets({ page: 3, pageSize: 10, now: NOW });

    expect(page1.items).toHaveLength(10);
    expect(page1.total).toBe(25);
    expect(page1.totalPages).toBe(3);
    expect(page3.items).toHaveLength(5);
  });

  it('excludes resolved/closed tickets from getQueue', () => {
    seedTicket(repo, 'TKT-0001', { status: 'OPEN' });
    seedTicket(repo, 'TKT-0002', { status: 'RESOLVED' });
    seedTicket(repo, 'TKT-0003', { status: 'CLOSED' });

    const queue = service.getQueue(NOW);
    expect(queue.map((t) => t.id)).toEqual(['TKT-0001']);
  });
});

describe('TicketService - create and update', () => {
  let repo: TicketRepository;
  let service: TicketService;

  beforeEach(() => {
    repo = new TicketRepository(createTestDb());
    service = new TicketService(repo);
  });

  it('calculates the SLA deadline from priority on create - urgent = 2h', () => {
    const ticket = service.createTicket({
      customerName: 'New Customer',
      title: 'Cannot log in',
      priority: 'URGENT',
    });
    const createdMs = new Date(ticket.createdAt).getTime();
    const deadlineMs = new Date(ticket.slaDeadline).getTime();
    expect(deadlineMs - createdMs).toBe(2 * HOUR);
  });

  it('calculates the SLA deadline from priority on create - normal = 24h', () => {
    const ticket = service.createTicket({
      customerName: 'New Customer',
      title: 'Bigger monitor please',
      priority: 'NORMAL',
    });
    const createdMs = new Date(ticket.createdAt).getTime();
    const deadlineMs = new Date(ticket.slaDeadline).getTime();
    expect(deadlineMs - createdMs).toBe(24 * HOUR);
  });

  it('generates sequential, zero-padded ids', () => {
    const a = service.createTicket({ customerName: 'A', title: 'x', priority: 'NORMAL' });
    const b = service.createTicket({ customerName: 'B', title: 'y', priority: 'NORMAL' });
    expect(a.id).toBe('TKT-0001');
    expect(b.id).toBe('TKT-0002');
  });

  it('recalculates the deadline (from the original createdAt) when priority changes', () => {
    const ticket = service.createTicket({ customerName: 'A', title: 'x', priority: 'NORMAL' });
    const updated = service.updateTicket(ticket.id, { priority: 'URGENT' });
    const createdMs = new Date(updated!.createdAt).getTime();
    const deadlineMs = new Date(updated!.slaDeadline).getTime();
    expect(deadlineMs - createdMs).toBe(2 * HOUR);
    expect(updated!.createdAt).toBe(ticket.createdAt); // creation time itself is untouched
  });

  it('stamps resolvedAt when a ticket is closed, and clears it on reopen', () => {
    const ticket = service.createTicket({ customerName: 'A', title: 'x', priority: 'NORMAL' });
    const resolved = service.updateTicket(ticket.id, { status: 'RESOLVED' });
    expect(resolved!.resolvedAt).not.toBeNull();

    const reopened = service.updateTicket(ticket.id, { status: 'OPEN' });
    expect(reopened!.resolvedAt).toBeNull();
  });

  it('returns null when updating a ticket that does not exist', () => {
    expect(service.updateTicket('TKT-9999', { status: 'OPEN' })).toBeNull();
  });
});
