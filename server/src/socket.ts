import { Server, Socket } from 'socket.io';
import { RgaDocument, RgaOp } from '@collab/crdt';
import { verifyToken } from './auth';
import { pool, loadDocumentOps, appendOperation, saveSnapshot, getDocument } from './db';
import { joinPresence, leavePresence, updateCursor, listPresence, PresenceInfo } from './presence';

// One live RgaDocument per actively-open document, kept in memory for
// the lifetime of the process. This is a cache over the durable
// operation log in Postgres -- if the process restarts, state is
// rebuilt by replaying (snapshot + ops-after-snapshot) on first join.
// See db.ts / schema.sql for the event-sourcing side of this.
const liveDocs = new Map<string, RgaDocument>();
let opsSinceSnapshot = new Map<string, number>();

// Per-document operation queue. The 'op' socket handler is async (it
// awaits DB writes before broadcasting). Without serialisation, rapid
// bursts from a single client can interleave their awaits in the event
// loop, causing op 'e' (whose RGA origin is 'H') to be broadcast before
// op 'H' is applied — breaking causal delivery. Queuing ops per-document
// ensures every op is fully applied and broadcast before the next starts.
const docOpQueues = new Map<string, Promise<void>>();

function enqueueDocOp(documentId: string, fn: () => Promise<void>): void {
  const prev = docOpQueues.get(documentId) ?? Promise.resolve();
  // Chain on the previous promise. Even if prev rejects, we still run fn.
  const next = prev.then(fn, fn);
  docOpQueues.set(documentId, next);
}

async function getOrLoadDoc(documentId: string): Promise<RgaDocument> {
  const cached = liveDocs.get(documentId);
  if (cached) return cached;

  const doc = new RgaDocument('server'); // server-side id space for its own bookkeeping only
  const { nodes, opsAfter } = await loadDocumentOps(documentId);
  if (nodes) doc.loadSnapshot(nodes);
  for (const op of opsAfter) doc.apply(op);

  liveDocs.set(documentId, doc);
  return doc;
}

const SNAPSHOT_EVERY_N_OPS = 200;

async function maybeSnapshot(documentId: string, doc: RgaDocument) {
  const count = (opsSinceSnapshot.get(documentId) || 0) + 1;
  opsSinceSnapshot.set(documentId, count);
  if (count >= SNAPSHOT_EVERY_N_OPS) {
    const seqRes = await pool.query(
      `SELECT COALESCE(MAX(seq), 0) AS max_seq FROM operations WHERE document_id = $1`,
      [documentId]
    );
    await saveSnapshot(documentId, seqRes.rows[0].max_seq, doc.snapshot());
    opsSinceSnapshot.set(documentId, 0);
  }
}

interface AuthedSocket extends Socket {
  userId?: string;
  displayName?: string;
  color?: string;
  currentDoc?: string;
}

export function attachSocketServer(io: Server) {
  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = token ? verifyToken(token) : null;
    if (!payload) return next(new Error('unauthorized'));
    socket.userId = payload.sub;
    next();
  });

  io.on('connection', (socket: AuthedSocket) => {
    socket.on('join-document', async ({ documentId, displayName, color }, ack) => {
      // Verify the document exists before allowing access.
      // Open-by-link: any authenticated user can join any document they know the ID of.
      const docMeta = await getDocument(documentId);
      if (!docMeta) {
        ack?.({ error: 'document not found' });
        return;
      }
      const doc = await getOrLoadDoc(documentId);
      socket.currentDoc = documentId;
      socket.displayName = displayName;
      socket.color = color;
      socket.join(`doc:${documentId}`);

      const presenceInfo: PresenceInfo = {
        socketId: socket.id,
        userId: socket.userId!,
        displayName,
        color,
        cursorIndex: null,
      };
      await joinPresence(documentId, presenceInfo);
      const roster = await listPresence(documentId);

      ack?.({ snapshot: doc.snapshot(), presence: roster });
      socket.to(`doc:${documentId}`).emit('presence-joined', presenceInfo);
    });

    socket.on('op', ({ documentId, op }: { documentId: string; op: RgaOp }) => {
      if (socket.currentDoc !== documentId) return; // must have joined first
      enqueueDocOp(documentId, async () => {
        const doc = await getOrLoadDoc(documentId);
        doc.apply(op);
        await appendOperation(documentId, socket.userId!, op);
        await maybeSnapshot(documentId, doc);
        // Broadcast to everyone else in the room. Every client applies
        // the same op independently via the CRDT -- no server-side
        // transform step needed, which is the whole point of using a
        // CRDT instead of OT here.
        socket.to(`doc:${documentId}`).emit('op', op);
      });
    });

    socket.on('cursor', async ({ documentId, cursorIndex }: { documentId: string; cursorIndex: number }) => {
      if (socket.currentDoc !== documentId) return;
      await updateCursor(documentId, socket.id, cursorIndex);
      socket.to(`doc:${documentId}`).emit('cursor', {
        socketId: socket.id,
        userId: socket.userId,
        cursorIndex,
      });
    });

    socket.on('disconnect', async () => {
      if (!socket.currentDoc) return;
      await leavePresence(socket.currentDoc, socket.id);
      socket.to(`doc:${socket.currentDoc}`).emit('presence-left', { socketId: socket.id });
    });
  });
}
