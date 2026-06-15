/**
 * Cleanup utilities for Vitest tests
 */

import { afterEach } from 'vitest';

/**
 * Cleanup function to reset state after each test
 */
export function cleanup() {
  // Reset any global state here if needed
}

// Register cleanup to run after each test
afterEach(() => {
  cleanup();
});
