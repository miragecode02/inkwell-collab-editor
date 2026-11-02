/**
 * RGA (Replicated Growable Array) CRDT for collaborative plain text.
 *
 * Reference: Roh, Jeon, Kim, Lee — "Replicated abstract data types:
 * Building blocks for collaborative applications" (JPDC 2011).
 *
 * Why RGA over OT:
 *   - OT requires a central transform function per operation-pair and a
 *     total-order server to keep every client's transform consistent.
 *     Getting the transform matrix right (insert-insert, insert-delete,
 *     delete-delete, and their inverses) is notoriously easy to get
 *     subtly wrong — Google Wave's OT implementation went through
 *     multiple correctness bugs before it stabilized.
 *   - RGA is a CRDT: every operation carries enough information
 *     (a globally unique id + the id of the element it was inserted
 *     after) to be applied independently, in ANY order, on any
 *     replica, and every replica still converges to the same final
 *     sequence. No central authority is required for correctness —
 *     the server is only needed for durability/broadcast, not for
 *     conflict resolution. That makes convergence provable rather
 *     than something you hope holds under enough manual testing.
 *
 * Core idea:
 *   Every inserted character gets a unique id `(counter, siteId)`.
 *   When you insert a character, you record the id of the character
 *   it was inserted immediately after (`originId`, or null for the
 *   head). Deletes don't remove the node — they mark it as a
 *   tombstone, so an id referenced as someone else's `originId`
 *   never "disappears" out from under a concurrent operation.
 *
 *   Ordering rule (this is the part that makes RGA a CRDT, not just a
 *   list): when multiple nodes share the same origin (i.e. multiple
 *   users inserted concurrently at the same position), they are
 *   ordered by id, comparing counter first and then siteId, in
 *   DESCENDING order. Because every replica applies the exact same
 *   deterministic comparator, every replica converges on the exact
 *   same total order no matter what order the insert operations
 *   physically arrive in over the network.
 */

export type SiteId = string;

export interface CharId {
  counter: number;
  site: SiteId;
}

export interface RgaNode {
  id: CharId;
  originId: CharId | null; // null = inserted at the very head
  value: string;
  deleted: boolean;
}

export type InsertOp = {
  type: 'insert';
  id: CharId;
  originId: CharId | null;
  value: string;
};

export type DeleteOp = {
  type: 'delete';
  id: CharId;
};

export type RgaOp = InsertOp | DeleteOp;

function idEquals(a: CharId | null, b: CharId | null): boolean {
  if (a === null || b === null) return a === b;
  return a.counter === b.counter && a.site === b.site;
}

// Descending comparator: higher counter first, tie-broken by siteId
// descending. This is the deterministic tie-break every replica must
// agree on for concurrent inserts sharing the same origin.
function idCompareDesc(a: CharId, b: CharId): number {
  if (a.counter !== b.counter) return b.counter - a.counter;
  return a.site < b.site ? 1 : a.site > b.site ? -1 : 0;
}

export class RgaDocument {
  private sequence: RgaNode[] = [];
  private counter = 0;
  private readonly siteId: SiteId;
  // index for O(1)-ish id -> array-position lookups instead of O(n) scans
  private index = new Map<string, number>();

  constructor(siteId: SiteId) {
    this.siteId = siteId;
  }

  private keyOf(id: CharId): string {
    return `${id.site}:${id.counter}`;
  }

  private rebuildIndex() {
    this.index.clear();
    this.sequence.forEach((n, i) => this.index.set(this.keyOf(n.id), i));
  }

  private findPos(id: CharId | null): number {
    if (id === null) return -1;
    const p = this.index.get(this.keyOf(id));
    return p === undefined ? -1 : p;
  }

  /** Visible (non-tombstoned) text, in document order. */
  getText(): string {
    let out = '';
    for (const n of this.sequence) if (!n.deleted) out += n.value;
    return out;
  }

  /** Number of visible characters. */
  length(): number {
    let c = 0;
    for (const n of this.sequence) if (!n.deleted) c++;
    return c;
  }

  /** Map a visible-text index to the id of the node currently there (or null = end). */
  private idAtVisibleIndex(visibleIndex: number): CharId | null {
    let count = 0;
    for (const n of this.sequence) {
      if (!n.deleted) {
        if (count === visibleIndex) return n.id;
        count++;
      }
    }
    return null;
  }

  /** Id of the visible node immediately before visibleIndex (the "origin"), or null for head. */
  private originForVisibleIndex(visibleIndex: number): CharId | null {
    if (visibleIndex <= 0) return null;
    let count = 0;
    for (const n of this.sequence) {
      if (!n.deleted) {
        count++;
        if (count === visibleIndex) return n.id;
      }
    }
    return null;
  }

  /**
   * LOCAL insert: user typed `value` at visible position `pos`.
   * Produces an operation to broadcast, and applies it locally.
   */
  localInsert(pos: number, value: string): InsertOp[] {
    const ops: InsertOp[] = [];
    let cursor = pos;
    for (const ch of value) {
      const originId = this.originForVisibleIndex(cursor);
      const id: CharId = { counter: ++this.counter, site: this.siteId };
      const op: InsertOp = { type: 'insert', id, originId, value: ch };
      this.applyInsert(op);
      ops.push(op);
      cursor++;
    }
    return ops;
  }

  /** LOCAL delete of the visible character at `pos`. Returns op to broadcast, or null if out of range. */
  localDelete(pos: number): DeleteOp | null {
    const id = this.idAtVisibleIndex(pos);
    if (id === null) return null;
    this.applyDelete({ type: 'delete', id });
    return { type: 'delete', id };
  }

  /**
   * REMOTE (or local) insert application. Safe to call multiple times /
   * out of order / concurrently from any replica — this is what makes
   * it a CRDT. Idempotent: inserting the same id twice is a no-op.
   */
  applyInsert(op: InsertOp) {
    if (this.index.has(this.keyOf(op.id))) return; // already applied (idempotent)

    const originPos = op.originId === null ? -1 : this.findPos(op.originId);
    // Start scanning right after the origin.
    let insertAt = originPos + 1;

    // RGA conflict rule: walk forward past any existing siblings that
    // share the same origin AND sort ahead of the new node under the
    // deterministic descending comparator. This is what guarantees
    // every replica lands on the identical order regardless of the
    // sequence operations were received in.
    while (insertAt < this.sequence.length) {
      const candidate = this.sequence[insertAt];
      if (idEquals(candidate.originId, op.originId)) {
        if (idCompareDesc(candidate.id, op.id) > 0) {
          // candidate sorts AFTER op -> op goes before candidate, stop here
          break;
        }
        insertAt++;
      } else {
        // Different origin. We must check whether the candidate is a descendant
        // of a node that was already scanned past (i.e., sits "inside" the
        // priority-chain of a sibling that sorts before the new op).
        //
        // If the candidate's own origin is at or before the original insertion
        // anchor (originPos), it belongs to a different subtree and we stop.
        // If it is strictly after originPos, it is a descendant of something we
        // already walked past and we must skip over it so it stays together with
        // its ancestor — otherwise concurrent multi-character edits at the same
        // position produce non-convergent interleavings.
        const candidateOriginPos = this.findPos(candidate.originId);
        if (candidateOriginPos <= originPos) {
          break;
        }
        insertAt++;
      }
    }

    this.sequence.splice(insertAt, 0, {
      id: op.id,
      originId: op.originId,
      value: op.value,
      deleted: false,
    });
    this.rebuildIndex();

    // Keep the local logical clock ahead of anything we've seen so
    // future locally-generated ids stay unique.
    if (op.id.counter > this.counter) this.counter = op.id.counter;
  }

  /** REMOTE (or local) delete application. Idempotent tombstoning. */
  applyDelete(op: DeleteOp) {
    const p = this.findPos(op.id);
    if (p === -1) return; // unknown id (shouldn't happen if inserts are causally delivered first)
    this.sequence[p].deleted = true;
  }

  apply(op: RgaOp) {
    if (op.type === 'insert') this.applyInsert(op);
    else this.applyDelete(op);
  }

  /** Convert a visible-text character index to the underlying node id, for cursor tracking. */
  visibleIndexToId(pos: number): CharId | null {
    return this.idAtVisibleIndex(pos);
  }

  /** Convert a node id back to its current visible-text index (for rendering remote cursors). */
  idToVisibleIndex(id: CharId | null): number {
    if (id === null) return this.length();
    let count = 0;
    for (const n of this.sequence) {
      if (idEquals(n.id, id)) return n.deleted ? count : count;
      if (!n.deleted) count++;
    }
    return this.length();
  }

  /** Full internal state, for persistence / snapshotting. */
  snapshot(): RgaNode[] {
    return this.sequence.map((n) => ({ ...n }));
  }

  loadSnapshot(nodes: RgaNode[], counterHint = 0) {
    this.sequence = nodes.map((n) => ({ ...n }));
    this.counter = Math.max(counterHint, ...nodes.map((n) => n.id.counter), 0);
    this.rebuildIndex();
  }
}
