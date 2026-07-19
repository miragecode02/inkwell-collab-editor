/**
 * Socket.io integration test: two clients connecting to the real server,
 * each making edits, proving that both converge to the same final text
 * via the RGA CRDT — not just a unit test of the CRDT in isolation, but
 * the full round-trip through Express + Socket.io + Postgres + Redis.
 *
 * Prerequisites: docker compose up -d
 */

import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer } from 'http';
import express from 'express';
import { Server as IOServer } from 'socket.io';
import { io as ioc, Socket } from 'socket.io-client';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { connectRedis } from '../presence';
import { attachSocketServer } from '../socket';
import { RgaDocument, RgaNode, RgaOp } from '@collab/crdt';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = 14321;

let httpServer: ReturnType<typeof createServer>;
let userAId: string;
let userBId: string;
let tokenA: string;
let tokenB: string;
let docId: string;

function makeToken(userId: string) {
  return jwt.sign({ sub: userId, email: `${userId}@test.com` }, JWT_SECRET, { expiresIn: '1h' });
}

function connectClient(token: string): Socket {
  return ioc(`http://localhost:${PORT}`, { auth: { token }, reconnection: false });
}

function waitForEvent(socket: Socket, event: string, timeout = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeout);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

function collectOps(socket: Socket, count: number): Promise<RgaOp[]> {
  return new Promise((resolve, reject) => {
    const ops: RgaOp[] = [];
    const t = setTimeout(() => reject(new Error(`Timeout: got ${ops.length}/${count} ops`)), 4000);
    socket.on('op', (op: RgaOp) => {
      ops.push(op);
      if (ops.length === count) { clearTimeout(t); resolve(ops); }
    });
  });
}

beforeAll(async () => {
  const { readFileSync } = require('fs');
  const { join } = require('path');
  const schema = readFileSync(join(__dirname, '../schema.sql'), 'utf-8');
  await pool.query(schema);
  await connectRedis();

  const ts = Date.now();
  const aRes = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, color) VALUES ($1,'x','Alice','#E64980') RETURNING id`,
    [`alice-${ts}@test.com`]
  );
  userAId = aRes.rows[0].id;
  tokenA = makeToken(userAId);

  const bRes = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, color) VALUES ($1,'x','Bob','#7048E8') RETURNING id`,
    [`bob-${ts}@test.com`]
  );
  userBId = bRes.rows[0].id;
  tokenB = makeToken(userBId);

  const docRes = await pool.query(
    `INSERT INTO documents (owner_id, title) VALUES ($1,'SocketTest') RETURNING id`,
    [userAId]
  );
  docId = docRes.rows[0].id;

  const app = express();
  httpServer = createServer(app);
  const io = new IOServer(httpServer, { cors: { origin: '*' } });
  attachSocketServer(io);
  await new Promise<void>((resolve) => httpServer.listen(PORT, resolve));
});

afterAll(async () => {
  httpServer.close();
  await pool.query(`DELETE FROM documents WHERE id = $1`, [docId]);
  await pool.query(`DELETE FROM users WHERE id IN ($1,$2)`, [userAId, userBId]);
  await pool.end();
});

describe('two-client op convergence via the real server', () => {
  it('both clients converge to the same text after concurrent edits', async () => {
    const sockA = connectClient(tokenA);
    const sockB = connectClient(tokenB);

    await Promise.all([waitForEvent(sockA, 'connect'), waitForEvent(sockB, 'connect')]);

    // Join the document — receive the real CRDT snapshot
    const [ackA, ackB] = await Promise.all([
      new Promise<{ snapshot: RgaNode[] }>((resolve) =>
        sockA.emit('join-document', { documentId: docId, displayName: 'Alice', color: '#E64980' }, resolve)
      ),
      new Promise<{ snapshot: RgaNode[] }>((resolve) =>
        sockB.emit('join-document', { documentId: docId, displayName: 'Bob', color: '#7048E8' }, resolve)
      ),
    ]);

    const docA = new RgaDocument('client-alice');
    const docB = new RgaDocument('client-bob');
    docA.loadSnapshot(ackA.snapshot);
    docB.loadSnapshot(ackB.snapshot);

    // Produce concurrent multi-character inserts — the hard case that exposes
    // RGA chain-interleaving bugs (Hello/World at same position).
    const opsFromA = docA.localInsert(0, 'Hello');  // 5 ops
    const opsFromB = docB.localInsert(0, 'World');  // 5 ops

    // Wire up listeners BEFORE emitting so we catch all broadcasts
    const bReceived = collectOps(sockB, opsFromA.length);
    const aReceived = collectOps(sockA, opsFromB.length);

    for (const op of opsFromA) sockA.emit('op', { documentId: docId, op });
    for (const op of opsFromB) sockB.emit('op', { documentId: docId, op });

    // Wait for each client to receive the other's ops, then apply them
    const [bOps, aOps] = await Promise.all([bReceived, aReceived]);
    for (const op of bOps) docB.apply(op);
    for (const op of aOps) docA.apply(op);

    // RGA convergence guarantee: same ops applied in any order → same result
    expect(docA.getText()).toBe(docB.getText());
    expect(docA.getText()).toContain('Hello');
    expect(docA.getText()).toContain('World');
    expect(docA.getText().length).toBe(10);

    sockA.disconnect();
    sockB.disconnect();
  });
});
