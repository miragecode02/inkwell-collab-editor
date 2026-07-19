import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { authRouter, verifyToken } from './auth';
import { pool, createDocument, listDocuments, getDocument } from './db';
import { connectRedis } from './presence';
import { attachSocketServer } from './socket';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/auth', authRouter);

function requireAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'unauthorized' });
  req.userId = payload.sub;
  next();
}

app.get('/documents', requireAuth, async (req: any, res) => {
  res.json(await listDocuments(req.userId));
});

app.post('/documents', requireAuth, async (req: any, res) => {
  const doc = await createDocument(req.userId, req.body?.title);
  res.json(doc);
});

app.patch('/documents/:id', requireAuth, async (req: any, res) => {
  const { title } = req.body ?? {};
  if (!title || typeof title !== 'string') return res.status(400).json({ error: 'title required' });
  await pool.query(
    `UPDATE documents SET title = $1, updated_at = now() WHERE id = $2 AND owner_id = $3`,
    [title.trim(), req.params.id, req.userId]
  );
  res.json({ ok: true });
});

// Fetch a single document — used by the editor when navigating directly to /doc/:id
// (open-by-link: any authenticated user can read any document they have the URL for)
app.get('/documents/:id', requireAuth, async (req: any, res) => {
  const doc = await getDocument(req.params.id);
  if (!doc) return res.status(404).json({ error: 'not found' });
  res.json(doc);
});

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });
attachSocketServer(io);

const PORT = process.env.PORT || 4000;

async function main() {
  await connectRedis();
  httpServer.listen(PORT, () => console.log(`collab-editor server listening on :${PORT}`));
}

main().catch((err) => {
  console.error('fatal startup error', err);
  process.exit(1);
});
