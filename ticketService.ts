/**
 * Ticket service.
 *
 * This is where the FILTER -> RANK -> PAGINATE pipeline lives. It is the only
 * place that combines the repository (SQL) with the ranking module (pure JS).
 *
 * PIPELINE ORDER MATTERS:
 *   1. FILTER   - status / assignee / customer search done in SQL (indexed).
 *   2. RANK     - sortTicketsByUrgency() from shared/queue/ranking.ts, applied
 *                 to the FULL filtered set, using the current time.
 *   3. PAGINATE - slice the ranked list into a page.
 *
 * Paginating before ranking would be wrong: page 2 would not contain "the
 * next 20 most urgent tickets", it would contain whatever page 2 happened to
 * be under an arbitrary DB order. Ranking must see every matching ticket
 * before anyone gets sliced into a page.
 *
 * TRADE-OFF: because ranking depends on `now`, it cannot be pushed into SQL
 * with a plain ORDER BY - "overdue" is not a stored column. So filtering runs
 * in SQL (fast, indexed, scales with data volume) and ranking runs in Node on
 * the filtered result (fast at the "thousands of tickets" scale described in
 * the brief). If a helpdesk grew to tens of thousands of ACTIVE tickets, the
 * bucket/priority ordering could be expressed as a SQL ORDER BY expression
 * too (e.g. `ORDER BY (sla_deadline < :now) DESC, priority, sla_deadline`) -
 * at the cost of duplicating the rule in two places. Isolating one JS
 * comparator as the single source of truth is the better trade at this scale.
 */

import { Ticket, Status, isActiveTicket } from '../../shared/types.js';
import { calculateSlaDeadline } from '../../shared/sla.js';
import { isOverdue } from '../../shared/sla.js';
import { sortTicketsByUrgency } from '../../shared/queue/ranking.js';
import { TicketRepository, CreateTicketInput as RepoCreateInput } from './repository.js';

export interface ListTicketsParams {
  status?: Status;
  assignee?: string;
  customerSearch?: string;
  /** true = only overdue active tickets. Calculated dynamically, never stored. */
  overdueOnly?: boolean;
  page?: number;
  pageSize?: number;
  /** Injectable "current time" so callers (and tests) can control it. Defaults to now. */
  now?: Date | number | string;
}

export interface PaginatedTickets {
  items: Ticket[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CreateTicketRequest {
  customerName: string;
  customerEmail?: string;
  title: string;
  description?: string;
  priority: 'URGENT' | 'NORMAL';
  assignee?: string | null;
  status?: Status;
}

export interface UpdateTicketRequest {
  status?: Status;
  assignee?: string | null;
  priority?: 'URGENT' | 'NORMAL';
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export class TicketService {
  private nextIdCounter: number;

  constructor(private repo: TicketRepository) {
    this.nextIdCounter = repo.count() + 1;
  }

  /** FILTER -> RANK -> PAGINATE. */
  listTickets(params: ListTicketsParams): PaginatedTickets {
    const now = params.now ?? Date.now();
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE));

    // 1. FILTER - status/assignee/search pushed down to SQL.
    let matching = this.repo.findMany({
      status: params.status,
      assignee: params.assignee,
      customerSearch: params.customerSearch,
    });

    // "Overdue" is not a stored column, so this filter is applied in memory,
    // against the same isOverdue() function the ranking algorithm uses.
    if (params.overdueOnly) {
      matching = matching.filter((t) => isOverdue(t, now));
    }

    // 2. RANK - the ENTIRE filtered set, before any slicing happens.
    const ranked = sortTicketsByUrgency(matching, now);

    // 3. PAGINATE - only now do we cut a page out of the ranked list.
    const total = ranked.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = ranked.slice(start, start + pageSize);

    return { items, page, pageSize, total, totalPages };
  }

  /** The default queue: active tickets only, ranked, unpaginated size respected by caller. */
  getQueue(now: Date | number | string = Date.now()): Ticket[] {
    const active = this.repo.findMany({}).filter(isActiveTicket);
    return sortTicketsByUrgency(active, now);
  }

  getById(id: string): Ticket | null {
    return this.repo.findById(id);
  }

  listAssignees(): string[] {
    return this.repo.listAssignees();
  }

  createTicket(input: CreateTicketRequest): Ticket {
    const createdAt = new Date().toISOString();
    // The SLA deadline is ALWAYS derived here - never accepted from a client.
    const slaDeadline = calculateSlaDeadline(createdAt, input.priority);

    const repoInput: RepoCreateInput = {
      id: this.generateId(),
      customerName: input.customerName,
      customerEmail: input.customerEmail ?? null,
      title: input.title,
      description: input.description ?? '',
      priority: input.priority,
      status: input.status ?? 'OPEN',
      assignee: input.assignee ?? null,
      createdAt,
      slaDeadline,
    };

    return this.repo.create(repoInput);
  }

  updateTicket(id: string, input: UpdateTicketRequest): Ticket | null {
    const existing = this.repo.findById(id);
    if (!existing) return null;

    // If priority changes, the deadline must be recalculated from the
    // ORIGINAL creation time - re-deriving it any other way would silently
    // change how long the ticket has been "alive".
    const slaDeadline =
      input.priority && input.priority !== existing.priority
        ? calculateSlaDeadline(existing.createdAt, input.priority)
        : undefined;

    // Moving into RESOLVED/CLOSED stamps resolvedAt; moving back out clears it.
    let resolvedAt: string | null | undefined;
    if (input.status && input.status !== existing.status) {
      const closing = input.status === 'RESOLVED' || input.status === 'CLOSED';
      resolvedAt = closing ? new Date().toISOString() : null;
    }

    return this.repo.update(id, {
      status: input.status,
      assignee: input.assignee,
      priority: input.priority,
      slaDeadline,
      resolvedAt,
    });
  }

  deleteTicket(id: string): boolean {
    return this.repo.delete(id);
  }

  private generateId(): string {
    const id = `TKT-${String(this.nextIdCounter).padStart(4, '0')}`;
    this.nextIdCounter += 1;
    return id;
  }
}
