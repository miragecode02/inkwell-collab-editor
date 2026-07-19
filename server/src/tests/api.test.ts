/**
 * Integration tests for auth + document REST routes.
 *
 * Prerequisites: docker compose up -d (Postgres on 5433, Redis on 6379)
 *
 * Run: npm run test --workspace=server
 */

import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import supertest from 'supertest';
import express from 'express';
import cors from 'cors';
import { authRouter, verifyToken } from '../auth';
import { pool, createDocument, listDocuments, getDocument } from '../db';
import { connectRedis } from '../presence';

function requireAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  const payload = token ? verifyToken(token) : null;
  if (!payload) return res.status(401).json({ error: 'unauthorized' });
  req.userId = payload.sub;
  next();
}

function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use('/auth', authRouter);

  app.get('/documents', requireAuth, async (req: any, res: any) => {
    res.json(await listDocuments(req.userId));
  });
  app.post('/documents', requireAuth, async (req: any, res: any) => {
    const doc = await createDocument(req.userId, req.body?.title);
    res.json(doc);
  });
  app.patch('/documents/:id', requireAuth, async (req: any, res: any) => {
    const { title } = req.body ?? {};
    if (!title) return res.status(400).json({ error: 'title required' });
    await pool.query(
      `UPDATE documents SET title = $1, updated_at = now() WHERE id = $2 AND owner_id = $3`,
      [title.trim(), req.params.id, req.userId]
    );
    res.json({ ok: true });
  });
  app.get('/documents/:id', requireAuth, async (req: any, res: any) => {
    const doc = await getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    res.json(doc);
  });

  return app;
}

const app = buildApp();
const request = supertest(app);

const email = `test-${Date.now()}@example.com`;
const password = 'hunter2';
let authToken = '';

beforeAll(async () => {
  await connectRedis();
  const schema = readFileSync(join(__dirname, '../schema.sql'), 'utf-8');
  await pool.query(schema);
});

afterAll(async () => {
  // Documents reference users via FK — delete documents first
  await pool.query(`DELETE FROM documents WHERE owner_id IN (SELECT id FROM users WHERE email = $1)`, [email]);
  await pool.query('DELETE FROM users WHERE email = $1', [email]);
  await pool.end();
});

describe('POST /auth/signup', () => {
  it('creates a new user and returns a token', async () => {
    const res = await request.post('/auth/signup').send({ email, password, displayName: 'Test User' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe(email);
    authToken = res.body.token;
  });

  it('rejects duplicate email', async () => {
    const res = await request.post('/auth/signup').send({ email, password, displayName: 'Dup' });
    expect(res.status).toBe(409);
  });

  it('rejects missing fields', async () => {
    const res = await request.post('/auth/signup').send({ email: 'x@x.com', password: 'y' });
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/login', () => {
  it('returns a token with valid credentials', async () => {
    const res = await request.post('/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  it('rejects wrong password', async () => {
    const res = await request.post('/auth/login').send({ email, password: 'wrong' });
    expect(res.status).toBe(401);
  });
});

describe('GET /documents', () => {
  it('returns 401 without token', async () => {
    const res = await request.get('/documents');
    expect(res.status).toBe(401);
  });

  it('returns array for authenticated user', async () => {
    const res = await request.get('/documents').set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /documents + PATCH + GET /:id', () => {
  let docId = '';

  it('creates a document', async () => {
    const res = await request
      .post('/documents')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'My First Doc' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('My First Doc');
    docId = res.body.id;
  });

  it('GET /documents/:id returns the doc', async () => {
    const res = await request.get(`/documents/${docId}`).set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(docId);
  });

  it('PATCH /documents/:id renames the doc', async () => {
    const res = await request
      .patch(`/documents/${docId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ title: 'Renamed' });
    expect(res.status).toBe(200);
    const getRes = await request.get(`/documents/${docId}`).set('Authorization', `Bearer ${authToken}`);
    expect(getRes.body.title).toBe('Renamed');
  });
});
