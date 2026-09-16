import React, { useState } from 'react';
import { Priority } from '../../shared/types.js';

interface Props {
  onCreate: (input: {
    customerName: string;
    title: string;
    description?: string;
    priority: Priority;
    assignee?: string | null;
  }) => Promise<void>;
  assignees: string[];
  onClose: () => void;
}

export function CreateTicketForm({ onCreate, assignees, onClose }: Props) {
  const [customerName, setCustomerName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('NORMAL');
  const [assignee, setAssignee] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!customerName.trim() || !title.trim()) {
      setError('Customer name and title are required.');
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({
        customerName: customerName.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        assignee: assignee || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">New ticket</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Customer name</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
              placeholder="e.g. Aarav Sharma"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Issue / title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
              placeholder="e.g. Laptop won't boot"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm"
              rows={2}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="NORMAL">Normal (24h SLA)</option>
                <option value="URGENT">Urgent (2h SLA)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-600 mb-1">Assignee</label>
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm"
              >
                <option value="">Unassigned</option>
                {assignees.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            The SLA deadline is calculated automatically from priority - it isn't entered by hand.
          </p>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-sm rounded border border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create ticket'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
