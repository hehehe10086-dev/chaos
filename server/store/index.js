// Picks the state store: Upstash Redis when configured, in-memory for local dev.
// CHAOS_STORE=memory forces the in-memory store locally (npm run dev:offline uses it).

import { createMemoryStore } from './memory.js';
import { createRedisStore } from './redis.js';

/**
 * @typedef {object} Store
 * @property {(code: string) => Promise<{version: number, state: object, presence: Record<string, number>} | null>} get
 * @property {(code: string, state: object) => Promise<boolean>} create
 *   Creates the room at version 1. Returns false if the code is taken.
 * @property {(code: string, expectedVersion: number, state: object) => Promise<boolean>} cas
 *   Writes only if the stored version still equals expectedVersion; version becomes +1.
 * @property {(code: string, playerId: string, now: number) => Promise<void>} touch
 *   Records that a player polled (does not change the version).
 * @property {(name: string, ttlMs: number) => Promise<string | null>} lock
 *   Returns a token if the lock was free, null if someone else holds it.
 * @property {(name: string, token: string) => Promise<void>} unlock
 * @property {(name: string) => Promise<number>} incr  counter that expires after 2 days
 */

let store;

/** @returns {Store} */
export function getStore() {
  if (store) return store;
  const hasRedis =
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  if (process.env.VERCEL && !hasRedis) {
    throw new Error('Redis is not configured: set UPSTASH_REDIS_REST_URL and _TOKEN on Vercel');
  }
  if (hasRedis && process.env.CHAOS_STORE !== 'memory') {
    store = createRedisStore();
  } else {
    console.warn('[store] using in-memory store (local only) — rooms are lost on restart');
    store = createMemoryStore();
  }
  return store;
}
