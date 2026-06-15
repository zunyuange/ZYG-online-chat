/**
 * Hono RPC client configuration
 * Provides type-safe API client for frontend
 */

import { hc } from 'hono/client';
import type { AppType } from '@server/index';

/**
 * Create a type-safe RPC client
 * Usage: const client = createRpcClient();
 *        const response = await client.api.todos.$get();
 */
export const createRpcClient = () => {
  // Point to the same origin in development, or production API URL
  const baseUrl = typeof window !== 'undefined'
    ? '' // Use relative path in browser
    : 'http://localhost:3010'; // Use absolute URL in Node.js (tests)

  return hc<AppType>(baseUrl);
};

/**
 * Singleton RPC client instance
 */
export const rpcClient = createRpcClient();
