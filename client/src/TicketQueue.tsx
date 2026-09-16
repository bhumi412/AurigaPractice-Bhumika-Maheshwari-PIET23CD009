import React from 'react';
import { Ticket } from '../../shared/types.js';
import { formatTimeRemaining } from '../../shared/sla.js';
import { PriorityBadge, StatusBadge, OverdueBadge } from './Badges.js';

interface Props {
  tickets: Ticket[];
  now: number;
  rankOffset: number; // 0-based index of the first row's overall rank, for the "#1" marker
  onUpdate: (id: string, patch: { status?: Ticket['status']; assignee?: string | null }) => void;
  assignees: string[];
}

export function TicketQueue({ tickets, now, rankOffset, onUpdate, assignees }: Props) {
  if (tickets.length === 0) {
    return (
      <div className="text-center text-slate-500 py-12 border border-dashed border-slate-300 rounded-lg">
        No tickets match these filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200 bg-slate-50">
            <th className="px-3 py-2 font-medium">#</th>
            <th className="px-3 py-2 font-medium">Ticket</th>
            <th className="px-3 py-2 font-medium">Customer</th>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Assignee</th>
            <th className="px-3 py-2 font-medium">SLA</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket, i) => {
            const overdue = new Date(ticket.slaDeadline).getTime() < now;
            const isTopOverall = rankOffset + i === 0;
            return (
              <tr
                key={ticket.id}
                className={`border-b border-slate-100 last:border-0 ${
                  isTopOverall ? 'bg-blue-50/70' : overdue ? 'bg-red-50/40' : ''
                }`}
              >
                <td className="px-3 py-2 text-slate-400 font-mono">
                  {isTopOverall ? '👉' : rankOffset + i + 1}
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium text-slate-800">{ticket.title}</div>
                  <div className="text-xs text-slate-400 font-mono">{ticket.id}</div>
                </td>
                <td className="px-3 py-2 text-slate-700">{ticket.customerName}</td>
                <td className="px-3 py-2">
                  <PriorityBadge priority={ticket.priority} />
                </td>
                <td className="px-3 py-2">
                  <select
                    value={ticket.status}
                    onChange={(e) => onUpdate(ticket.id, { status: e.target.value as Ticket['status'] })}
                    className="border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-transparent"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={ticket.assignee ?? ''}
                    onChange={(e) => onUpdate(ticket.id, { assignee: e.target.value || null })}
                    className="border border-slate-200 rounded px-1.5 py-0.5 text-xs bg-transparent"
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={overdue ? 'text-red-600 font-medium' : 'text-slate-600'}>
                      {formatTimeRemaining(ticket, now)}
                    </span>
                    <OverdueBadge overdue={overdue} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
