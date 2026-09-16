import React from 'react';
import { Status, STATUSES } from '../../shared/types.js';

export interface Filters {
  status: Status | 'ALL';
  assignee: string; // '' = all, 'unassigned', or a name
  overdueOnly: boolean;
  customerSearch: string;
}

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  assignees: string[];
  currentUser: string;
}

export function FilterBar({ filters, onChange, assignees, currentUser }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 bg-white border border-slate-200 rounded-lg p-3">
      <input
        type="text"
        placeholder="Search customer..."
        value={filters.customerSearch}
        onChange={(e) => onChange({ ...filters, customerSearch: e.target.value })}
        className="border border-slate-300 rounded px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <select
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value as Status | 'ALL' })}
        className="border border-slate-300 rounded px-2 py-1.5 text-sm"
      >
        <option value="ALL">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace('_', ' ')}
          </option>
        ))}
      </select>

      <select
        value={filters.assignee}
        onChange={(e) => onChange({ ...filters, assignee: e.target.value })}
        className="border border-slate-300 rounded px-2 py-1.5 text-sm"
      >
        <option value="">All assignees</option>
        <option value={currentUser}>Assigned to me ({currentUser})</option>
        <option value="unassigned">Unassigned</option>
        {assignees
          .filter((a) => a !== currentUser)
          .map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
      </select>

      <label className="flex items-center gap-1.5 text-sm text-slate-700 select-none cursor-pointer">
        <input
          type="checkbox"
          checked={filters.overdueOnly}
          onChange={(e) => onChange({ ...filters, overdueOnly: e.target.checked })}
        />
        Overdue only
      </label>
    </div>
  );
}
