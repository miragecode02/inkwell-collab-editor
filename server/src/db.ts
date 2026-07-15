import { Pool } from 'pg';
import { RgaOp, RgaNode } from '@collab/crdt';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/collab_editor',
});

export async function appendOperation(documentId: string, userId: string, op: RgaOp) {
  await pool.query(
    `INSERT INTO operations (document_id, user_id, op) VALUES ($1, $2, $3)`,
    [documentId, userId, JSON.stringify(op)]
  );
  await pool.query(`UPDATE documents SET updated_at = now() WHERE id = $1`, [documentId]);
}

/**
 * Reconstruct (or fetch a fast-pathed) document state.
 * Loads the latest snapshot (if any) then replays only the operations
 * after it -- this is the standard event-sourcing read pattern: full
 * history is authoritative, snapshots are just a cache.
 */
export async function loadDocumentOps(documentId: string): Promise<{ nodes: RgaNode[] | null; opsAfter: RgaOp[] }> {
  const snap = await pool.query(`SELECT up_to_seq, nodes FROM snapshots WHERE document_id = $1`, [documentId]);
  const upToSeq = snap.rows[0]?.up_to_seq ?? 0;
  const nodes: RgaNode[] | null = snap.rows[0]?.nodes ?? null;

  const ops = await pool.query(
    `SELECT op FROM operations WHERE document_id = $1 AND seq > $2 ORDER BY seq ASC`,
    [documentId, upToSeq]
  );
  return { nodes, opsAfter: ops.rows.map((r) => r.op as RgaOp) };
}

export async function saveSnapshot(documentId: string, upToSeq: number, nodes: RgaNode[]) {
  await pool.query(
    `INSERT INTO snapshots (document_id, up_to_seq, nodes, updated_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (document_id) DO UPDATE SET up_to_seq = $2, nodes = $3, updated_at = now()`,
    [documentId, upToSeq, JSON.stringify(nodes)]
  );
}

export async function createDocument(ownerId: string, title = 'Untitled document') {
  const r = await pool.query(
    `INSERT INTO documents (owner_id, title) VALUES ($1, $2) RETURNING id, title, created_at, updated_at`,
    [ownerId, title]
  );
  return r.rows[0];
}

export async function listDocuments(userId: string) {
  const r = await pool.query(
    `SELECT id, title, updated_at FROM documents WHERE owner_id = $1 ORDER BY updated_at DESC`,
    [userId]
  );
  return r.rows;
}
