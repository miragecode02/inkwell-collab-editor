# Inkwell — Real-Time Collaborative Document Editor

A from-scratch collaborative text editor. Multiple users edit the same
document at once and see each other's changes and cursors instantly,
with conflict resolution handled by a CRDT implemented in this repo
(not pulled in from Yjs/Automerge).

## Why CRDT (RGA) instead of OT

Both solve the same problem: User A inserts at position 5 while User B
deletes at position 3, concurrently, over an unreliable network — and
every replica has to converge to the same correct document regardless
of delivery order. This repo uses **RGA (Replicated Growable Array)**,
a CRDT, rather than Operational Transformation, because:

- OT needs a central sequencer and a hand-written transform function
  for every pair of operation types (insert-insert, insert-delete,
  delete-delete, and their inverses). Getting that transform matrix
  provably correct is a known hard problem — Google Wave's own OT
  implementation shipped with convergence bugs before it stabilized.
- A CRDT operation is self-contained: it carries a globally unique id
  and the id of the node it was inserted after. Any replica can apply
  any operation, in any order, any number of times (see the
  idempotency test), and still converge — no central transform
  authority required. That makes correctness something you can test
  and prove, not just something you hope holds after enough manual
  clicking.

The full algorithm and its correctness properties are documented in
`packages/crdt/src/rga.ts`, and proven (not just asserted) by the test
suite in `packages/crdt/src/rga.test.ts` — including the exact
concurrent insert/delete scenario above, a 3-way out-of-order delivery
test, a duplicate-delivery idempotency test, and a 5-way randomized
stress test. Run them yourself:

```bash
npm run test:crdt
```

## Architecture

```
packages/crdt   — the algorithm. Pure TypeScript, zero dependencies,
                  framework-agnostic. This is what an interviewer
                  should be pointed at first.
server/         — Express + Socket.io. Holds one live RgaDocument per
                  open document in memory, persists every operation to
                  Postgres (event sourcing), tracks presence in Redis.
client/         — React + TypeScript + Tailwind. Diffs local text
                  changes into CRDT ops, sends them over a socket,
                  applies remote ops the same way every other replica
                  does, and renders colored remote cursors.
```

### Data flow for a single keystroke
1. User types → `Editor.tsx` fires `onChange` with the new full text.
2. `useCollabDoc` diffs old vs. new text into insert/delete ops via the
   local `RgaDocument` instance (this *is* the CRDT, running client-side).
3. Ops are emitted over the socket to the server.
4. The server applies the op to its own in-memory `RgaDocument` for
   that document, appends it to the Postgres `operations` table
   (the durable event log), and rebroadcasts it to every other
   connected client in that document's room.
5. Every other client applies the same op to its own local
   `RgaDocument` and re-renders. No client ever trusts the server to
   resolve a conflict — the CRDT guarantees convergence regardless of
   arrival order, which is the whole point of using one.

### Persistence: event sourcing
`operations` is the source of truth — an append-only log of every op
ever applied to a document. Current state is a fold over that log.
`snapshots` is a pure performance cache (taken every 200 ops) so
loading a long-lived document doesn't replay from op #1 every time.
Because the full log is retained, "reconstruct the document at any
point in time" is free — a version-history *UI* was explicitly out of
scope for this project, but the underlying data already supports it.

## Running it locally

```bash
docker compose up -d          # Postgres + Redis
npm install
npm run db:migrate            # DATABASE_URL=postgres://postgres:postgres@localhost:5432/collab_editor
npm run dev:server            # http://localhost:4000
npm run dev:client            # http://localhost:5173
```

Open the client in two browser windows (or one normal + one incognito,
so they get separate sessions), sign up two different users, open the
same document from each, and type in both simultaneously.

## Scope decisions worth being able to explain in an interview

- **Rich text is markdown-style markers through the same op pipeline**,
  not a schema/mark-aware CRDT. A block-aware CRDT (where bold/italic
  are first-class attributes on ranges, not characters) is its own
  multi-week project layered on top of this one — the brief explicitly
  said not to over-scope this, and the algorithmic value of the
  project lives in `packages/crdt`, not the text-rendering layer.
- **New joiners bootstrap from a flattened text snapshot**, not the
  full CRDT node graph (with real ids and tombstones) on `join-document`.
  This is simpler and works correctly for the demo, but a production
  version would send the real node array so a joining client has the
  exact same tie-break history as everyone else, rather than a
  synthetic id space. Worth knowing as a stated limitation, not
  something to pretend isn't there.
- **Comments, version-history UI, offline mode, and mobile are out of
  scope**, per the brief — the operation log already stores what a
  version browser would need; it just isn't exposed yet.

## Stack
React + TypeScript + Tailwind · Node.js + Express + Socket.io ·
PostgreSQL (documents, users, operation log) · Redis (live presence) ·
JWT auth (email + password, bcrypt-hashed).
