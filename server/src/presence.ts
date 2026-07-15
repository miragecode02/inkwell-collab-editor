import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redis.on('error', (err) => console.error('Redis error', err));

export async function connectRedis() {
  if (!redis.isOpen) await redis.connect();
}

export interface PresenceInfo {
  socketId: string;
  userId: string;
  displayName: string;
  color: string;
  cursorIndex: number | null;
}

const key = (docId: string) => `presence:doc:${docId}`;

export async function joinPresence(docId: string, info: PresenceInfo) {
  await redis.hSet(key(docId), info.socketId, JSON.stringify(info));
}

export async function updateCursor(docId: string, socketId: string, cursorIndex: number) {
  const raw = await redis.hGet(key(docId), socketId);
  if (!raw) return;
  const info: PresenceInfo = JSON.parse(raw);
  info.cursorIndex = cursorIndex;
  await redis.hSet(key(docId), socketId, JSON.stringify(info));
}

export async function leavePresence(docId: string, socketId: string) {
  await redis.hDel(key(docId), socketId);
}

export async function listPresence(docId: string): Promise<PresenceInfo[]> {
  const all = await redis.hGetAll(key(docId));
  return Object.values(all).map((v) => JSON.parse(v));
}
