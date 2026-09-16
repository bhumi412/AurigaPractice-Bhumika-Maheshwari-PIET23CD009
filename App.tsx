import React, { useEffect, useState, useCallback } from 'react';
import { Ticket, Priority, Status } from '../../shared/types.js';
import { api } from './api.js';
import { TopTicketBanner } from './TopTicketBanner.js';
import { FilterBar, Filters } from './FilterBar.js';
import { TicketQueue } from './TicketQueue.js';
import { Pagination } from './Pagination.js';
import { CreateTicketForm } from './CreateTicketForm.js';

// Hard-coded for the demo: "assigned to me" needs a concept of who "me" is.
// In a real app this would come from auth; a coding-assessment dashboard just
// needs one fixed identity to demonstrate the filter.
const CURRENT_USER = 'priya';

const PAGE_SIZE = 10;
// No websockets: overdue status is recalculated by re-fetching on an interval.
// This is enough to satisfy "the queue re-orders as time passes" without
// adding real-time infrastructure the brief explicitly says to avoid.
const REFRESH_INTERVAL_MS = 30_000;
const CLOCK_TICK_MS = 1_000;

const DEFAULT_FILTERS: Filters = {
  status: 'ALL',
  assignee: '',
  overdueOnly: false,
  customerSearch: '',
};

export default function App() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{
    items: Ticket[];
    total: number;
    totalPages: number;
  }>({ items: [], total: 0, totalPages: 1 });
  const [topTicket, setTopTicket] = useState<Ticket | null>(null);
  const [assignees, setAssignees] = useState<string[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      setError(null);
      const [listResponse, topResponse, assigneeList] = await Promise.all([
        api.listTickets({
          status: filters.status === 'ALL' ? undefined : filters.status,
          assignee: filters.assignee || undefined,
          customer: filters.customerSearch || undefined,
          overdue: filters.overdueOnly,
          page,
          pageSize: PAGE_SIZE,
        }),
        // The "answer this next" banner always reflects the GLOBAL top of the
        // active queue, independent of whatever filters are currently applied.
        api.listTickets({ status: undefined, page: 1, pageSize: 1 }),
        api.listAssignees(),
      ]);
      setResult(listResponse);
      setTopTicket(topResponse.items[0] ?? null);
      setAssignees(assigneeList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  // Reload whenever filters or page change.
  useEffect(() => {
    setLoading(true);
    loadTickets();
  }, [loadTickets]);

  // Reset to page 1 whenever a filter changes (not when only the page changes).
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // Periodically re-fetch so a ticket that breaches its SLA while the
  // dashboard is open moves to the front automatically.
  useEffect(() => {
    const id = setInterval(loadTickets, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [loadTickets]);

  // A faster local clock just for the countdown text and overdue highlighting,
  // so "1m left" doesn't sit frozen for 30 seconds between refreshes.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const handleUpdate = async (id: string, patch: { status?: Status; assignee?: string | null }) => {
    await api.updateTicket(id, patch);
    loadTickets();
  };

  const handleCreate = async (input: {
    customerName: string;
    title: string;
    description?: string;
    priority: Priority;
    assignee?: string | null;
  }) => {
    await api.createTicket(input);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    await loadTickets();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Helpdesk Queue</h1>
            <p className="text-sm text-slate-500">Logged in as {CURRENT_USER}</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700"
          >
            + New ticket
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-4">
        <TopTicketBanner ticket={topTicket} now={now} />

        <FilterBar
          filters={filters}
          onChange={setFilters}
          assignees={assignees}
          currentUser={CURRENT_USER}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center text-slate-400 py-12">Loading tickets…</div>
        ) : (
          <>
            <TicketQueue
              tickets={result.items}
              now={now}
              rankOffset={(page - 1) * PAGE_SIZE}
              onUpdate={handleUpdate}
              assignees={assignees}
            />
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={result.total}
              totalPages={result.totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </main>

      {showCreateForm && (
        <CreateTicketForm
          onCreate={handleCreate}
          assignees={assignees}
          onClose={() => setShowCreateForm(false)}
        />
      )}
    </div>
  );
}
