// Picks the state store: Upstash Redis when configured, in-memory for local dev.

import { createMemoryStore } from './memory.js';
import { createRedisStore } from './redis.js';

/**
 * @typedef {object} Store
 * @property {(code: string) => Promise<{version: number, state: object} | null>} get
 * @property {(code: string, state: object) => Promise<boolean>} create
 *   Creates the room at version 1. Returns false if the code is taken.
 * @property {(code: string, expectedVersion: number, state: object) => Promise<boolean>} cas
 *   Writes only if the stored version still equals expectedVersion; version becomes +1.
 */

let store;

/** @returns {Store} */
export function getStore() {
  if (store) return store;
  const hasRedis =
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  if (hasRedis) {
    store = createRedisStore();
  } else if (process.env.VERCEL) {
    throw new Error('Redis is not configured: set UPSTASH_REDIS_REST_URL and _TOKEN on Vercel');
  } else {
    console.warn('[store] No Redis env vars found — using in-memory store (local dev only)');
    store = createMemoryStore();
  }
  return store;
}
