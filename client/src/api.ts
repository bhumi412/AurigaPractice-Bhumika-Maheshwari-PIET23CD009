import { Ticket, Status, Priority } from '../../shared/types.js';

export interface PaginatedResponse {
  items: Ticket[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListParams {
  status?: Status;
  assignee?: string;
  customer?: string;
  overdue?: boolean;
  page?: number;
  pageSize?: number;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed with status ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  async listTickets(params: ListParams): Promise<PaginatedResponse> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.assignee) query.set('assignee', params.assignee);
    if (params.customer) query.set('customer', params.customer);
    if (params.overdue) query.set('overdue', 'true');
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));

    const res = await fetch(`/api/tickets?${query.toString()}`);
    return handle<PaginatedResponse>(res);
  },

  async listAssignees(): Promise<string[]> {
    const res = await fetch('/api/assignees');
    return handle<string[]>(res);
  },

  async createTicket(input: {
    customerName: string;
    customerEmail?: string;
    title: string;
    description?: string;
    priority: Priority;
    assignee?: string | null;
    status?: Status;
  }): Promise<Ticket> {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handle<Ticket>(res);
  },

  async updateTicket(
    id: string,
    input: { status?: Status; assignee?: string | null; priority?: Priority }
  ): Promise<Ticket> {
    const res = await fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    return handle<Ticket>(res);
  },
};
