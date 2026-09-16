/**
 * Ticket repository.
 *
 * This is the ONLY module that writes SQL. It is deliberately "dumb": it knows
 * how to store tickets and how to filter/search them, but it knows nothing
 * about queue ranking - that stays in shared/queue/ranking.ts. See
 * ticketService.ts for how the two are combined.
 */

import Database from 'better-sqlite3';
import { Ticket, Priority, Status } from '../../shared/types.js';
import { rowToTicket, TicketRow } from './db.js';

export interface TicketFilters {
  status?: Status;
  /** 'unassigned' means assignee IS NULL. Any other value is an exact match. */
  assignee?: string;
  /** Case-insensitive prefix match against customer name. */
  customerSearch?: string;
}

export interface CreateTicketInput {
  id: string;
  customerName: string;
  customerEmail?: string | null;
  title: string;
  description?: string;
  priority: Priority;
  status?: Status;
  assignee?: string | null;
  createdAt: string;
  slaDeadline: string;
}

export interface UpdateTicketInput {
  status?: Status;
  assignee?: string | null;
  priority?: Priority;
  slaDeadline?: string; // recalculated by the service if priority changes
  resolvedAt?: string | null;
  firstRespondedAt?: string | null;
}

export class TicketRepository {
  constructor(private db: Database.Database) {}

  /**
   * Return tickets matching the given filters. Deliberately returns the FULL
   * matching set, unsorted and unpaginated - ranking and pagination happen one
   * layer up, after this data is in memory. See ticketService.ts for why.
   */
  findMany(filters: TicketFilters): Ticket[] {
    const clauses: string[] = [];
    const params: Record<string, unknown> = {};

    if (filters.status) {
      clauses.push('status = @status');
      params.status = filters.status;
    }

    if (filters.assignee === 'unassigned') {
      clauses.push('assignee IS NULL');
    } else if (filters.assignee) {
      clauses.push('assignee = @assignee');
      params.assignee = filters.assignee;
    }

    if (filters.customerSearch) {
      // Prefix match uses the idx_tickets_customer_lc index.
      clauses.push('customer_name_lc LIKE @search');
      params.search = `${filters.customerSearch.toLowerCase()}%`;
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db.prepare(`SELECT * FROM tickets ${where}`).all(params) as TicketRow[];
    return rows.map(rowToTicket);
  }

  findById(id: string): Ticket | null {
    const row = this.db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as
      | TicketRow
      | undefined;
    return row ? rowToTicket(row) : null;
  }

  /** Distinct assignees currently in use, for populating filter dropdowns. */
  listAssignees(): string[] {
    const rows = this.db
      .prepare(
        'SELECT DISTINCT assignee FROM tickets WHERE assignee IS NOT NULL ORDER BY assignee'
      )
      .all() as { assignee: string }[];
    return rows.map((r) => r.assignee);
  }

  create(input: CreateTicketInput): Ticket {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO tickets (
           id, customer_name, customer_name_lc, customer_email, title, description,
           priority, status, assignee, created_at, updated_at, sla_deadline,
           resolved_at, first_responded_at
         ) VALUES (
           @id, @customerName, @customerNameLc, @customerEmail, @title, @description,
           @priority, @status, @assignee, @createdAt, @updatedAt, @slaDeadline,
           NULL, NULL
         )`
      )
      .run({
        id: input.id,
        customerName: input.customerName,
        customerNameLc: input.customerName.toLowerCase(),
        customerEmail: input.customerEmail ?? null,
        title: input.title,
        description: input.description ?? '',
        priority: input.priority,
        status: input.status ?? 'OPEN',
        assignee: input.assignee ?? null,
        createdAt: input.createdAt,
        updatedAt: now,
        slaDeadline: input.slaDeadline,
      });

    return this.findById(input.id) as Ticket;
  }

  update(id: string, input: UpdateTicketInput): Ticket | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const fields: string[] = ['updated_at = @updatedAt'];
    const params: Record<string, unknown> = { id, updatedAt: new Date().toISOString() };

    if (input.status !== undefined) {
      fields.push('status = @status');
      params.status = input.status;
    }
    if (input.assignee !== undefined) {
      fields.push('assignee = @assignee');
      params.assignee = input.assignee;
    }
    if (input.priority !== undefined) {
      fields.push('priority = @priority');
      params.priority = input.priority;
    }
    if (input.slaDeadline !== undefined) {
      fields.push('sla_deadline = @slaDeadline');
      params.slaDeadline = input.slaDeadline;
    }
    if (input.resolvedAt !== undefined) {
      fields.push('resolved_at = @resolvedAt');
      params.resolvedAt = input.resolvedAt;
    }
    if (input.firstRespondedAt !== undefined) {
      fields.push('first_responded_at = @firstRespondedAt');
      params.firstRespondedAt = input.firstRespondedAt;
    }

    this.db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = @id`).run(params);
    return this.findById(id);
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
    return result.changes > 0;
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as c FROM tickets').get() as { c: number };
    return row.c;
  }
}
