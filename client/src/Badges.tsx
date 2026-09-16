import React from 'react';
import { Priority, Status } from '../../shared/types.js';

export function PriorityBadge({ priority }: { priority: Priority }) {
  const isUrgent = priority === 'URGENT';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
        isUrgent ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {isUrgent ? 'Urgent' : 'Normal'}
    </span>
  );
}

const STATUS_STYLES: Record<Status, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
  CLOSED: 'bg-slate-200 text-slate-600',
};

const STATUS_LABELS: Record<Status, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function OverdueBadge({ overdue }: { overdue: boolean }) {
  if (!overdue) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
      ⏰ Overdue
    </span>
  );
}
