import { createClient } from 'redis';

const redis = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
let redisReady = false;

redis.on('error', (err) => console.warn('[redis] connection error (presence degraded):', err.message));
redis.on('ready', () => { redisReady = true; });
redis.on('end', () => { redisReady = false; });

export async function connectRedis() {
  if (redis.isOpen) return;
  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error('Redis connection timeout')), 2000)
  );
  try {
    await Promise.race([redis.connect(), timeout]);
    redisReady = true;
  } catch (err: any) {
    // Redis is only used for presence (cursor tracking). If it's unavailable the
    // server still runs — socket rooms handle realtime delivery and presence state
    // just degrades to per-process memory.
    console.warn('[redis] unavailable, presence will be in-memory only:', err.message);
  }
}

export interface PresenceInfo {
  socketId: string;
  userId: string;
  displayName: string;
  color: string;
  cursorIndex: number | null;
}

// In-process fallback when Redis is unavailable
const memPresence = new Map<string, Map<string, PresenceInfo>>();

const key = (docId: string) => `presence:doc:${docId}`;

export async function joinPresence(docId: string, info: PresenceInfo) {
  if (redisReady) {
    await redis.hSet(key(docId), info.socketId, JSON.stringify(info));
  } else {
    if (!memPresence.has(docId)) memPresence.set(docId, new Map());
    memPresence.get(docId)!.set(info.socketId, info);
  }
}

export async function updateCursor(docId: string, socketId: string, cursorIndex: number) {
  if (redisReady) {
    const raw = await redis.hGet(key(docId), socketId);
    if (!raw) return;
    const info: PresenceInfo = JSON.parse(raw);
    info.cursorIndex = cursorIndex;
    await redis.hSet(key(docId), socketId, JSON.stringify(info));
  } else {
    const info = memPresence.get(docId)?.get(socketId);
    if (info) info.cursorIndex = cursorIndex;
  }
}

export async function leavePresence(docId: string, socketId: string) {
  if (redisReady) {
    await redis.hDel(key(docId), socketId);
  } else {
    memPresence.get(docId)?.delete(socketId);
  }
}

export async function listPresence(docId: string): Promise<PresenceInfo[]> {
  if (redisReady) {
    const all = await redis.hGetAll(key(docId));
    return Object.values(all).map((v) => JSON.parse(v));
  } else {
    return Array.from(memPresence.get(docId)?.values() ?? []);
  }
}
