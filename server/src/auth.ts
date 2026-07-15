import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const CURSOR_COLORS = ['#E64980', '#7048E8', '#1971C2', '#0CA678', '#F08C00', '#E8590C'];

export const authRouter = Router();

authRouter.post('/signup', async (req, res) => {
  const { email, password, displayName } = req.body ?? {};
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'email, password, and displayName are required' });
  }
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) return res.status(409).json({ error: 'email already registered' });

  const hash = await bcrypt.hash(password, 10);
  const color = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];
  const r = await pool.query(
    `INSERT INTO users (email, password_hash, display_name, color)
     VALUES ($1, $2, $3, $4) RETURNING id, email, display_name, color`,
    [email, hash, displayName, color]
  );
  const user = r.rows[0];
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name, color: user.color } });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const r = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = r.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'invalid email or password' });
  }
  const token = jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, email: user.email, displayName: user.display_name, color: user.color } });
});

export function verifyToken(token: string): { sub: string; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { sub: string; email: string };
  } catch {
    return null;
  }
}
