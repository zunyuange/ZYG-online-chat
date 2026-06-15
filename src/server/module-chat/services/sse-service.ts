/**
 * SSE (Server-Sent Events) service - manages real-time connections
 * Simplified version that works with Hono's streamSSE
 */

import type { Message, Session } from '@shared/types';

// SSE Stream type (matches Hono's SSEStreamingApi)
interface SSEStream {
  writeSSE: (data: { event?: string; data: string }) => Promise<void>;
}

// Store connections by session ID
const sessionClients = new Map<string, Set<SSEStream>>();

// Store staff connections (they receive all messages)
const staffClients = new Set<SSEStream>();

// Track dead streams for cleanup
const deadStreams = new WeakSet<SSEStream>();

/**
 * Add a client connection for a session
 */
export function addSessionClient(sessionId: string, stream: SSEStream): void {
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Set());
  }
  sessionClients.get(sessionId)!.add(stream);
  console.log(`[SSE] Client connected to session: ${sessionId}`);
}

/**
 * Remove a client connection
 */
export function removeSessionClient(sessionId: string, stream: SSEStream): void {
  const clients = sessionClients.get(sessionId);
  if (clients) {
    clients.delete(stream);
    deadStreams.add(stream);
    if (clients.size === 0) {
      sessionClients.delete(sessionId);
    }
    console.log(`[SSE] Client disconnected from session: ${sessionId}`);
  }
}

/**
 * Add a staff client connection
 */
export function addStaffClient(stream: SSEStream): void {
  staffClients.add(stream);
  console.log(`[SSE] Staff client connected`);
}

/**
 * Remove a staff client connection
 */
export function removeStaffClient(stream: SSEStream): void {
  staffClients.delete(stream);
  deadStreams.add(stream);
  console.log(`[SSE] Staff client disconnected`);
}

/**
 * Check if a stream is dead
 */
function isStreamDead(stream: SSEStream): boolean {
  return deadStreams.has(stream);
}

/**
 * Send SSE event to a specific stream with timeout
 */
async function sendToStream(stream: SSEStream, event: string, data: unknown): Promise<boolean> {
  // Skip dead streams
  if (isStreamDead(stream)) {
    return false;
  }

  try {
    // Add 5 second timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('SSE write timeout')), 5000);
    });

    await Promise.race([
      stream.writeSSE({
        event,
        data: JSON.stringify(data),
      }),
      timeoutPromise,
    ]);
    return true;
  } catch (error) {
    console.error(`[SSE] Failed to send to stream:`, error);
    // Mark stream as dead so we don't try again
    deadStreams.add(stream);
    return false;
  }
}

/**
 * Clean up dead streams from collections
 */
function cleanupDeadStreams(): void {
  // Clean session clients
  for (const [sessionId, clients] of sessionClients) {
    for (const client of clients) {
      if (isStreamDead(client)) {
        clients.delete(client);
      }
    }
    if (clients.size === 0) {
      sessionClients.delete(sessionId);
    }
  }

  // Clean staff clients
  for (const client of staffClients) {
    if (isStreamDead(client)) {
      staffClients.delete(client);
    }
  }
}

/**
 * Broadcast a new message to session clients and staff
 */
export async function broadcastMessage(message: Message): Promise<void> {
  const eventData = {
    type: 'message',
    message,
  };

  // Collect all send promises
  const sendPromises: Promise<boolean>[] = [];

  // Send to session clients
  const clients = sessionClients.get(message.sessionId);
  if (clients) {
    for (const client of clients) {
      sendPromises.push(sendToStream(client, 'message', eventData));
    }
  }

  // Send to all staff clients
  for (const client of staffClients) {
    sendPromises.push(sendToStream(client, 'message', eventData));
  }

  // Wait for all sends to complete (don't block on failures)
  await Promise.allSettled(sendPromises);

  // Periodically clean up dead streams
  cleanupDeadStreams();
}

/**
 * Broadcast session update to staff clients and session clients
 */
export async function broadcastSessionUpdate(session: Session): Promise<void> {
  const eventData = {
    type: 'session_update',
    session,
  };

  const sendPromises: Promise<boolean>[] = [];

  // Send to all staff clients
  for (const client of staffClients) {
    sendPromises.push(sendToStream(client, 'session_update', eventData));
  }

  // Also send to the session's clients (for user-side updates)
  const sessionClientSet = sessionClients.get(session.id);
  if (sessionClientSet) {
    for (const client of sessionClientSet) {
      sendPromises.push(sendToStream(client, 'session_update', eventData));
    }
  }

  await Promise.allSettled(sendPromises);
  cleanupDeadStreams();
}

/**
 * Send heartbeat to keep connections alive
 */
export async function sendHeartbeat(): Promise<void> {
  const eventData = { type: 'heartbeat', timestamp: Date.now() };

  const sendPromises: Promise<boolean>[] = [];

  // Send to all session clients
  for (const [, clients] of sessionClients) {
    for (const client of clients) {
      sendPromises.push(sendToStream(client, 'heartbeat', eventData));
    }
  }

  // Send to all staff clients
  for (const client of staffClients) {
    sendPromises.push(sendToStream(client, 'heartbeat', eventData));
  }

  await Promise.allSettled(sendPromises);
  cleanupDeadStreams();
}

/**
 * Get connection stats
 */
export function getConnectionStats(): {
  sessionConnections: number;
  staffConnections: number;
  totalSessions: number;
} {
  let sessionConnections = 0;
  for (const [, clients] of sessionClients) {
    sessionConnections += clients.size;
  }

  return {
    sessionConnections,
    staffConnections: staffClients.size,
    totalSessions: sessionClients.size,
  };
}

// Start heartbeat interval (every 30 seconds) - only in Node.js environment
// Cloudflare Workers doesn't support global setInterval
if (typeof process !== 'undefined' && process.versions?.node) {
  setInterval(() => {
    sendHeartbeat().catch(console.error);
  }, 30000);
}
