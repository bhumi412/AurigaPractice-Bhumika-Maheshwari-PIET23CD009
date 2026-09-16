import Database from 'better-sqlite3';

type Priority = 'NORMAL' | 'HIGH' | 'URGENT';

const nextPriority: Record<Priority, Priority> = {
  NORMAL: 'HIGH',
  HIGH: 'URGENT',
  URGENT: 'URGENT',
};

export function escalateBreachedTickets(
  db: Database.Database,
  now: Date = new Date()
): string[] {
  const tickets = db
    .prepare(`
      SELECT id, priority, sla_deadline
      FROM tickets
      WHERE status NOT IN ('RESOLVED', 'CLOSED')
        AND sla_deadline < ?
    `)
    .all(now.toISOString()) as {
      id: string;
      priority: Priority;
      sla_deadline: string;
    }[];

  const update = db.prepare(`
    UPDATE tickets
    SET priority = ?
    WHERE id = ?
  `);

  const escalated: string[] = [];

  const transaction = db.transaction(() => {
    for (const ticket of tickets) {
      const newPriority = nextPriority[ticket.priority];

      if (newPriority !== ticket.priority) {
        update.run(newPriority, ticket.id);
        escalated.push(ticket.id);
      }
    }
  });

  transaction();

  return escalated;
}
