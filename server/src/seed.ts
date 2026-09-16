/**
 * Seed data.
 *
 * Every "scenario" ticket below exists to prove a specific ranking behaviour
 * when you open the dashboard. Deadlines are computed as OFFSETS FROM NOW at
 * seed time, so the demo is correct no matter when you run it.
 *
 * Run with: npm run seed
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './db.js';
import { TicketRepository, CreateTicketInput } from './repository.js';
import { calculateSlaDeadline } from '../../shared/sla.js';
import { Priority, Status } from '../../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../data/helpdesk.db');

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

let counter = 0;
function nextId(): string {
  counter += 1;
  return `TKT-${String(counter).padStart(4, '0')}`;
}

interface Scenario {
  customerName: string;
  customerEmail?: string;
  title: string;
  description?: string;
  priority: Priority;
  status?: Status;
  assignee?: string | null;
  /** How long ago the ticket was created, in ms. */
  ageMs: number;
  resolvedAgoMs?: number;
}

const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

const scenarios: Scenario[] = [
  // --- Designed to land at/near the top: overdue, urgent, oldest breach first ---
  {
    customerName: 'Aarav Sharma',
    title: 'Laptop will not boot before client demo',
    description: 'Laptop stuck on boot screen, demo starts in an hour.',
    priority: 'URGENT',
    assignee: 'priya',
    ageMs: 5 * HOUR, // urgent SLA = 2h -> overdue by 3h
  },
  {
    customerName: 'Meera Iyer',
    title: 'VPN drops every few minutes',
    priority: 'URGENT',
    assignee: 'rahul',
    ageMs: 2 * HOUR + 30 * MINUTE, // overdue by 30m
  },
  {
    customerName: 'Devika Rao',
    title: 'Payroll export failing since last night',
    priority: 'NORMAL',
    assignee: 'priya',
    ageMs: 26 * HOUR, // normal SLA = 24h -> overdue by 2h
  },
  // --- Tie case: two urgent tickets overdue by the same amount, same creation time ---
  {
    customerName: 'Kabir Singh',
    title: 'Printer offline for whole floor',
    priority: 'URGENT',
    assignee: 'rahul',
    ageMs: 3 * HOUR,
  },
  {
    customerName: 'Ananya Gupta',
    title: 'Shared drive permissions reset',
    priority: 'URGENT',
    assignee: 'rahul',
    ageMs: 3 * HOUR, // identical age to Kabir's ticket -> id breaks the tie
  },
  // --- Approaching deadline, still on time ---
  {
    customerName: 'Rohan Mehta',
    title: 'Second monitor flickering',
    priority: 'URGENT',
    assignee: 'priya',
    ageMs: 1 * HOUR, // 1h left of 2h window
  },
  {
    customerName: 'Sanya Kapoor',
    title: 'Onboarding new hire laptop setup',
    priority: 'NORMAL',
    assignee: null,
    ageMs: 19 * HOUR, // 5h left of 24h window
  },
  // --- Normal ticket, plenty of time, low in the active queue ---
  {
    customerName: 'Vikram Nair',
    title: 'Request for a bigger monitor',
    priority: 'NORMAL',
    assignee: 'rahul',
    ageMs: 2 * HOUR, // 22h left
  },
  // --- Unassigned, active, at risk of being forgotten ---
  {
    customerName: 'Isha Malhotra',
    title: 'Cannot connect to office wifi',
    priority: 'NORMAL',
    assignee: null,
    ageMs: 4 * HOUR,
  },
  // --- Same customer, multiple tickets (search demo) ---
  {
    customerName: 'Aarav Sharma',
    title: 'Second monitor cable missing',
    priority: 'NORMAL',
    assignee: 'priya',
    ageMs: 30 * MINUTE,
  },
  {
    customerName: 'Aarav Sharma',
    title: 'Password reset for CRM',
    priority: 'URGENT',
    assignee: null,
    ageMs: 10 * MINUTE,
  },
  // --- Resolved: must NOT appear in the active queue, even though badly breached ---
  {
    customerName: 'Farhan Ali',
    title: 'Email client crashing on send',
    priority: 'URGENT',
    status: 'RESOLVED',
    assignee: 'priya',
    ageMs: 30 * HOUR,
    resolvedAgoMs: 4 * HOUR,
  },
  // --- Closed: also excluded from the active queue ---
  {
    customerName: 'Nisha Verma',
    title: 'Old ticket about a retired laptop',
    priority: 'NORMAL',
    status: 'CLOSED',
    assignee: 'rahul',
    ageMs: 90 * HOUR,
    resolvedAgoMs: 40 * HOUR,
  },
  // --- In progress, active, mid-queue ---
  {
    customerName: 'Karan Malhotra',
    title: 'Slow laptop after Windows update',
    priority: 'NORMAL',
    status: 'IN_PROGRESS',
    assignee: 'priya',
    ageMs: 6 * HOUR,
  },
];

// Extra filler rows so the "thousands of tickets" pagination requirement has
// something real to page through.
const FILLER_CUSTOMERS = [
  'Ravi Kumar', 'Neha Joshi', 'Arjun Desai', 'Priyanka Das', 'Suresh Pillai',
  'Kavya Reddy', 'Manish Agarwal', 'Divya Menon', 'Amitabh Rao', 'Pooja Bhatt',
];
const FILLER_TITLES = [
  'Cannot access shared calendar', 'Software license expired', 'Mouse not working',
  'Slow internet connection', 'Need software installed', 'Email signature update',
  'Screen resolution issue', 'Keyboard keys sticking', 'Cannot print to network printer',
  'Headset microphone not detected',
];

function buildFillerScenarios(count: number): Scenario[] {
  const filler: Scenario[] = [];
  for (let i = 0; i < count; i++) {
    const priority: Priority = i % 3 === 0 ? 'URGENT' : 'NORMAL';
    filler.push({
      customerName: FILLER_CUSTOMERS[i % FILLER_CUSTOMERS.length],
      title: FILLER_TITLES[i % FILLER_TITLES.length],
      priority,
      assignee: i % 4 === 0 ? null : i % 2 === 0 ? 'priya' : 'rahul',
      ageMs: (i % 20) * HOUR + MINUTE * (i % 60),
    });
  }
  return filler;
}

function run() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = openDatabase(DB_PATH);
  const repo = new TicketRepository(db);

  db.exec('DELETE FROM tickets');

  const all = [...scenarios, ...buildFillerScenarios(40)];

  for (const scenario of all) {
    const createdAt = iso(now - scenario.ageMs);
    const slaDeadline = calculateSlaDeadline(createdAt, scenario.priority);
    const input: CreateTicketInput = {
      id: nextId(),
      customerName: scenario.customerName,
      customerEmail: scenario.customerEmail ?? null,
      title: scenario.title,
      description: scenario.description ?? '',
      priority: scenario.priority,
      status: scenario.status ?? 'OPEN',
      assignee: scenario.assignee === undefined ? null : scenario.assignee,
      createdAt,
      slaDeadline,
    };
    repo.create(input);

    if (scenario.resolvedAgoMs !== undefined) {
      repo.update(input.id, { resolvedAt: iso(now - scenario.resolvedAgoMs) });
    }
  }

  console.log(`Seeded ${all.length} tickets into ${DB_PATH}`);
  db.close();
}

run();
