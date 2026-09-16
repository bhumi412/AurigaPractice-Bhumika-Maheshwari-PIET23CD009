/**
 * HTTP layer.
 *
 * Routes only: parse the request, call the service, shape the response.
 * No ranking, no SQL, no business rules live here - see ticketService.ts and
 * shared/queue/ranking.ts for that.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { TicketService } from './ticketService.js';
import { STATUSES, PRIORITIES } from '../../shared/types.js';

const createTicketSchema = z.object({
  customerName: z.string().trim().min(1, 'customerName is required'),
  customerEmail: z.string().email().optional().or(z.literal('')).transform((v) => v || undefined),
  title: z.string().trim().min(1, 'title is required'),
  description: z.string().optional(),
  priority: z.enum(['URGENT', 'NORMAL']),
  assignee: z.string().trim().min(1).optional().nullable(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
});

const updateTicketSchema = z
  .object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
    assignee: z.string().trim().min(1).optional().nullable(),
    priority: z.enum(['URGENT', 'NORMAL']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' });

export function createTicketRouter(service: TicketService): Router {
  const router = Router();

  // GET /api/tickets - FILTER -> RANK -> PAGINATE, all query-param driven.
  router.get('/tickets', (req: Request, res: Response) => {
    const { status, assignee, customer, overdue, page, pageSize, now } = req.query;

    if (status !== undefined && !STATUSES.includes(status as any)) {
      return res.status(400).json({ error: `Invalid status. Expected one of: ${STATUSES.join(', ')}` });
    }

    const result = service.listTickets({
      status: status as any,
      assignee: assignee as string | undefined,
      customerSearch: customer as string | undefined,
      overdueOnly: overdue === 'true',
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      // Optional override, mainly used by tests/demos to fast-forward time.
      now: now ? String(now) : undefined,
    });

    res.json(result);
  });

  router.get('/tickets/:id', (req: Request, res: Response) => {
    const ticket = service.getById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  });

  router.post('/tickets', (req: Request, res: Response) => {
    const parsed = createTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const ticket = service.createTicket(parsed.data);
    res.status(201).json(ticket);
  });

  router.patch('/tickets/:id', (req: Request, res: Response) => {
    const parsed = updateTicketSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const ticket = service.updateTicket(req.params.id, parsed.data);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    res.json(ticket);
  });

  router.delete('/tickets/:id', (req: Request, res: Response) => {
    const deleted = service.deleteTicket(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Ticket not found' });
    res.status(204).send();
  });

  router.get('/assignees', (_req: Request, res: Response) => {
    res.json(service.listAssignees());
  });

  router.get('/meta', (_req: Request, res: Response) => {
    res.json({ statuses: STATUSES, priorities: PRIORITIES });
  });

  return router;
}
