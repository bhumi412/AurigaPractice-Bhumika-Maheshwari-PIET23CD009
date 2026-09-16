import React from 'react';
import { Ticket } from '../../shared/types.js';
import { formatTimeRemaining } from '../../shared/sla.js';
import { PriorityBadge, OverdueBadge } from './Badges.js';

export function TopTicketBanner({ ticket, now }: { ticket: Ticket | null; now: number }) {
  if (!ticket) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
        Queue is empty - nothing needs attention right now.
      </div>
    );
  }

  const overdue = new Date(ticket.slaDeadline).getTime() < now;

  return (
    <div
      className={`rounded-lg border-2 p-4 shadow-sm ${
        overdue ? 'border-red-400 bg-red-50' : 'border-blue-300 bg-blue-50'
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Answer this next
        </div>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={ticket.priority} />
          <OverdueBadge overdue={overdue} />
        </div>
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{ticket.title}</div>
      <div className="text-sm text-slate-600">
        {ticket.customerName} · {ticket.id} · {ticket.assignee ?? 'Unassigned'} ·{' '}
        {formatTimeRemaining(ticket, now)}
      </div>
    </div>
  );
}
