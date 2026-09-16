import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TicketRepository } from './repository.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use an in-memory copy of the real schema so these tests exercise the exact
// SQL the app runs, without touching the file on disk.
function createTestDb(): Database.Database {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const db = new Database(':memory:');
  db.exec(schema);
  return db;
}

describe('TicketRepository', () => {
  let repo: TicketRepository;

  beforeEach(() => {
    const db = createTestDb();
    repo = new TicketRepository(db);
    repo.create({
      id: 'TKT-0001',
      customerName: 'Priya Nair',
      title: 'Laptop issue',
      priority: 'URGENT',
      status: 'OPEN',
      assignee: 'rahul',
      createdAt: new Date().toISOString(),
      slaDeadline: new Date(Date.now() + 3600_000).toISOString(),
    });
    repo.create({
      id: 'TKT-0002',
      customerName: 'Priyanka Shah',
      title: 'Monitor request',
      priority: 'NORMAL',
      status: 'OPEN',
      assignee: null,
      createdAt: new Date().toISOString(),
      slaDeadline: new Date(Date.now() + 86400_000).toISOString(),
    });
    repo.create({
      id: 'TKT-0003',
      customerName: 'Aarav Sharma',
      title: 'Old resolved ticket',
      priority: 'URGENT',
      status: 'RESOLVED',
      assignee: 'rahul',
      createdAt: new Date().toISOString(),
      slaDeadline: new Date().toISOString(),
    });
  });

  it('filters by status', () => {
    const open = repo.findMany({ status: 'OPEN' });
    expect(open.map((t) => t.id).sort()).toEqual(['TKT-0001', 'TKT-0002']);
  });

  it('filters by exact assignee', () => {
    const rahuls = repo.findMany({ assignee: 'rahul' });
    expect(rahuls.map((t) => t.id).sort()).toEqual(['TKT-0001', 'TKT-0003']);
  });

  it('filters unassigned tickets', () => {
    const unassigned = repo.findMany({ assignee: 'unassigned' });
    expect(unassigned.map((t) => t.id)).toEqual(['TKT-0002']);
  });

  it('searches customer name case-insensitively by prefix', () => {
    const results = repo.findMany({ customerSearch: 'pri' });
    expect(results.map((t) => t.id).sort()).toEqual(['TKT-0001', 'TKT-0002']);
  });

  it('combines filters', () => {
    const results = repo.findMany({ status: 'OPEN', assignee: 'rahul' });
    expect(results.map((t) => t.id)).toEqual(['TKT-0001']);
  });

  it('creates and immediately retrieves a ticket', () => {
    const ticket = repo.findById('TKT-0001');
    expect(ticket?.customerName).toBe('Priya Nair');
    expect(ticket?.priority).toBe('URGENT');
  });

  it('updates status and stamps updatedAt', () => {
    // Repository.update() stamps updatedAt with new Date().toISOString(), which
    // has millisecond resolution - on a fast machine, create() and update() can
    // land in the same millisecond, making this test flaky if it just compares
    // real wall-clock timestamps. Controlling the clock removes the race.
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
      const before = repo.findById('TKT-0001')!;

      vi.setSystemTime(new Date('2026-01-01T00:00:01.000Z'));
      const updated = repo.update('TKT-0001', { status: 'IN_PROGRESS' });

      expect(updated?.status).toBe('IN_PROGRESS');
      expect(updated?.updatedAt).not.toBe(before.updatedAt);
    } finally {
      vi.useRealTimers();
    }
  });

  it('deletes a ticket', () => {
    expect(repo.delete('TKT-0002')).toBe(true);
    expect(repo.findById('TKT-0002')).toBeNull();
    expect(repo.delete('TKT-0002')).toBe(false);
  });

  it('lists distinct assignees', () => {
    expect(repo.listAssignees()).toEqual(['rahul']);
  });
});
