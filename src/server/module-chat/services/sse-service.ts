/**
 * SSE (Server-Sent Events) service - manages real-time connections
 * Simplified version that works with Hono's streamSSE
 */

import type { Message, Session } from '@shared/types'
import { getDb } from '@server/shared/db'

interface SSEStream {
  writeSSE: (data: { event?: string; data: string }) => Promise<void>
}

const sessionClients = new Map<string, Set<SSEStream>>()

// Staff connections grouped by businessId for data isolation
const staffClients = new Map<number, Set<SSEStream>>()

const deadStreams = new WeakSet<SSEStream>()

export function addSessionClient(sessionId: string, stream: SSEStream): void {
  if (!sessionClients.has(sessionId)) {
    sessionClients.set(sessionId, new Set())
  }
  sessionClients.get(sessionId)!.add(stream)
  console.log(`[SSE] Client connected to session: ${sessionId}`)
}

export function removeSessionClient(sessionId: string, stream: SSEStream): void {
  const clients = sessionClients.get(sessionId)
  if (clients) {
    clients.delete(stream)
    deadStreams.add(stream)
    if (clients.size === 0) {
      sessionClients.delete(sessionId)
    }
    console.log(`[SSE] Client disconnected from session: ${sessionId}`)
  }
}

export function addStaffClient(stream: SSEStream, businessId: number): void {
  if (!staffClients.has(businessId)) {
    staffClients.set(businessId, new Set())
  }
  staffClients.get(businessId)!.add(stream)
  console.log(`[SSE] Staff client connected for business ${businessId}`)
}

export function removeStaffClient(stream: SSEStream, businessId: number): void {
  const clients = staffClients.get(businessId)
  if (clients) {
    clients.delete(stream)
    deadStreams.add(stream)
    if (clients.size === 0) {
      staffClients.delete(businessId)
    }
  }
  console.log(`[SSE] Staff client disconnected from business ${businessId}`)
}

function isStreamDead(stream: SSEStream): boolean {
  return deadStreams.has(stream)
}

async function sendToStream(stream: SSEStream, event: string, data: unknown): Promise<boolean> {
  if (isStreamDead(stream)) {
    return false
  }

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('SSE write timeout')), 5000)
    })

    await Promise.race([
      stream.writeSSE({
        event,
        data: JSON.stringify(data),
      }),
      timeoutPromise,
    ])
    return true
  } catch (error) {
    console.error(`[SSE] Failed to send to stream:`, error)
    deadStreams.add(stream)
    return false
  }
}

function cleanupDeadStreams(): void {
  for (const [sessionId, clients] of sessionClients) {
    for (const client of clients) {
      if (isStreamDead(client)) {
        clients.delete(client)
      }
    }
    if (clients.size === 0) {
      sessionClients.delete(sessionId)
    }
  }

  for (const [businessId, clients] of staffClients) {
    for (const client of clients) {
      if (isStreamDead(client)) {
        clients.delete(client)
      }
    }
    if (clients.size === 0) {
      staffClients.delete(businessId)
    }
  }
}

async function getSessionBusinessId(sessionId: string): Promise<number | undefined> {
  const db = getDb()
  const session = await db.get<{ business_id: number }>(
    'SELECT business_id FROM sessions WHERE id = ?',
    [sessionId]
  )
  return session?.business_id
}

async function broadcastToStaffByBusiness(
  businessId: number,
  event: string,
  eventData: unknown
): Promise<void> {
  const clients = staffClients.get(businessId)
  if (!clients || clients.size === 0) {
    return
  }
  const sendPromises: Promise<boolean>[] = []
  for (const client of clients) {
    sendPromises.push(sendToStream(client, event, eventData))
  }
  await Promise.allSettled(sendPromises)
}

export async function broadcastMessage(message: Message): Promise<void> {
  const eventData = {
    type: 'message',
    message,
  }

  const sendPromises: Promise<boolean>[] = []

  // Send to session clients (visitor side)
  const clients = sessionClients.get(message.sessionId)
  if (clients) {
    for (const client of clients) {
      sendPromises.push(sendToStream(client, 'message', eventData))
    }
  }

  // Send to staff clients of the same business only
  const businessId = await getSessionBusinessId(message.sessionId)
  if (businessId) {
    const staffSet = staffClients.get(businessId)
    if (staffSet) {
      for (const client of staffSet) {
        sendPromises.push(sendToStream(client, 'message', eventData))
      }
    }
  }

  await Promise.allSettled(sendPromises)
  cleanupDeadStreams()
}

export async function broadcastSessionUpdate(session: Session): Promise<void> {
  const eventData = {
    type: 'session_update',
    session,
  }

  const sendPromises: Promise<boolean>[] = []

  // Send to staff clients of the same business only
  if (session.businessId) {
    const staffSet = staffClients.get(session.businessId)
    if (staffSet) {
      for (const client of staffSet) {
        sendPromises.push(sendToStream(client, 'session_update', eventData))
      }
    }
  }

  // Also send to the session's clients (for user-side updates)
  const sessionClientSet = sessionClients.get(session.id)
  if (sessionClientSet) {
    for (const client of sessionClientSet) {
      sendPromises.push(sendToStream(client, 'session_update', eventData))
    }
  }

  await Promise.allSettled(sendPromises)
  cleanupDeadStreams()
}

export async function broadcastMessageRead(sessionId: string, messageIds: number[]): Promise<void> {
  const eventData = {
    type: 'message_read',
    sessionId,
    messageIds,
  }

  const sendPromises: Promise<boolean>[] = []

  const sessionClientSet = sessionClients.get(sessionId)
  if (sessionClientSet) {
    for (const client of sessionClientSet) {
      sendPromises.push(sendToStream(client, 'message_read', eventData))
    }
    console.log(
      `[SSE] Broadcast message_read to ${sessionClientSet.size} clients for session ${sessionId}`
    )
  }

  await Promise.allSettled(sendPromises)
  cleanupDeadStreams()
}

export async function broadcastTransferRequest(transferRequest: any): Promise<void> {
  const eventData = {
    type: 'transfer_request',
    transferRequest,
  }

  // Look up businessId from the session in the transfer request
  const sessionId = transferRequest.sessionId || transferRequest.session_id
  if (sessionId) {
    const businessId = await getSessionBusinessId(sessionId)
    if (businessId) {
      await broadcastToStaffByBusiness(businessId, 'transfer_request', eventData)
    }
  }

  cleanupDeadStreams()
}

export async function sendHeartbeat(): Promise<void> {
  const eventData = { type: 'heartbeat', timestamp: Date.now() }

  const sendPromises: Promise<boolean>[] = []

  for (const [, clients] of sessionClients) {
    for (const client of clients) {
      sendPromises.push(sendToStream(client, 'heartbeat', eventData))
    }
  }

  for (const [, clients] of staffClients) {
    for (const client of clients) {
      sendPromises.push(sendToStream(client, 'heartbeat', eventData))
    }
  }

  await Promise.allSettled(sendPromises)
  cleanupDeadStreams()
}

export function getConnectionStats(): {
  sessionConnections: number
  staffConnections: number
  totalSessions: number
} {
  let sessionConnections = 0
  for (const [, clients] of sessionClients) {
    sessionConnections += clients.size
  }

  let staffConnections = 0
  for (const [, clients] of staffClients) {
    staffConnections += clients.size
  }

  return {
    sessionConnections,
    staffConnections,
    totalSessions: sessionClients.size,
  }
}

if (typeof process !== 'undefined' && process.versions?.node) {
  setInterval(() => {
    sendHeartbeat().catch(console.error)
  }, 30000)
}
