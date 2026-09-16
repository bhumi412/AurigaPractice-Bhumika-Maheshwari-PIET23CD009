/**
 * Database connection.
 *
 * better-sqlite3 is synchronous, which keeps the repository code free of
 * async noise - appropriate for a single-file demo database like this one.
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ticket } from '../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function openDatabase(filePath: string): Database.Database {
  const db = new Database(filePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);

  return db;
}

/** The shape a row comes back as from better-sqlite3 (snake_case columns). */
export interface TicketRow {
  id: string;
  customer_name: string;
  customer_name_lc: string;
  customer_email: string | null;
  title: string;
  description: string;
  priority: Ticket['priority'];
  status: Ticket['status'];
  assignee: string | null;
  created_at: string;
  updated_at: string;
  sla_deadline: string;
  resolved_at: string | null;
  first_responded_at: string | null;
}

export function rowToTicket(row: TicketRow): Ticket {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    title: row.title,
    description: row.description,
    priority: row.priority,
    status: row.status,
    assignee: row.assignee,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    slaDeadline: row.sla_deadline,
    resolvedAt: row.resolved_at,
    firstRespondedAt: row.first_responded_at,
  };
}
