import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { openDatabase } from './db.js';
import { TicketRepository } from './repository.js';
import { TicketService } from './ticketService.js';
import { createTicketRouter } from './routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../data');
const DB_PATH = path.join(DATA_DIR, 'helpdesk.db');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = openDatabase(DB_PATH);
const repo = new TicketRepository(db);
const service = new TicketService(repo);

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api', createTicketRouter(service));

app.get('/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(PORT, () => {
  console.log(`Helpdesk API listening on http://localhost:${PORT}`);
});
import { escalateBreachedTickets } from './escalation.js';
setInterval(() => {
  try {
    const escalated = escalateBreachedTickets(db);
    if (escalated.length > 0) {
      console.log(`Escalated tickets: ${escalated.join(', ')}`);
    }
  } catch (error) {
    console.error('Automatic escalation failed:', error);
  }
}, 30_000);
