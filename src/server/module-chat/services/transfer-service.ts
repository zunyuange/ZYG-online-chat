import { getDb } from '@server/shared/db';

export interface TransferRequest {
  id: number;
  session_id: string;
  from_staff_id: number;
  to_staff_id: number;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: number;
  updated_at: number;
}

export interface CreateTransferRequestParams {
  sessionId: string;
  fromStaffId: number;
  toStaffId: number;
  reason: string;
}

export async function createTransferRequest(params: CreateTransferRequestParams): Promise<{ success: boolean; data?: TransferRequest; error?: string }> {
  const db = getDb();
  
  try {
    const session = await db.get<{ id: string; assigned_staff_id: number | null }>(
      'SELECT id, assigned_staff_id FROM sessions WHERE id = ?',
      [params.sessionId]
    );
    
    if (!session) {
      return { success: false, error: '�Ự������' };
    }
    
    if (session.assigned_staff_id !== params.fromStaffId) {
      return { success: false, error: '�����ǸûỰ�ĵ�ǰ�ͷ�' };
    }
    
    const existingRequest = await db.get<TransferRequest>(
      'SELECT id FROM transfer_requests WHERE session_id = ? AND status = ?',
      [params.sessionId, 'pending']
    );
    
    if (existingRequest) {
      return { success: false, error: '���д�������ת������' };
    }
    
    const result = await db.run(
      'INSERT INTO transfer_requests (session_id, from_staff_id, to_staff_id, reason, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [params.sessionId, params.fromStaffId, params.toStaffId, params.reason, 'pending', Date.now(), Date.now()]
    );
    
    const request = await db.get<TransferRequest>(
      'SELECT * FROM transfer_requests WHERE id = ?',
      [result.lastInsertRowid]
    );
    
    return { success: true, data: request! };
  } catch (error) {
    console.error('[TransferService] Create transfer request error:', error);
    return { success: false, error: error instanceof Error ? error.message : '����ת������ʧ��' };
  }
}

export async function respondToTransferRequest(requestId: number, staffId: number, action: 'accept' | 'reject'): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  
  try {
    const request = await db.get<TransferRequest>(
      'SELECT * FROM transfer_requests WHERE id = ?',
      [requestId]
    );
    
    if (!request) {
      return { success: false, error: 'ת�����󲻴���' };
    }
    
    if (request.to_staff_id !== staffId) {
      return { success: false, error: '����Ȩ������ת������' };
    }
    
    if (request.status !== 'pending') {
      return { success: false, error: 'ת�������Ѵ���' };
    }
    
    const status = action === 'accept' ? 'accepted' : 'rejected';
    
    if (action === 'accept') {
      await db.run(
        'UPDATE sessions SET assigned_staff_id = ?, updated_at = ? WHERE id = ?',
        [staffId, Date.now(), request.session_id]
      );
    }
    
    await db.run(
      'UPDATE transfer_requests SET status = ?, updated_at = ? WHERE id = ?',
      [status, Date.now(), requestId]
    );
    
    return { success: true };
  } catch (error) {
    console.error('[TransferService] Respond to transfer request error:', error);
    return { success: false, error: error instanceof Error ? error.message : '����ת������ʧ��' };
  }
}

export async function getPendingTransferRequests(staffId: number): Promise<TransferRequest[]> {
  const db = getDb();
  
  try {
    const requests = await db.all<TransferRequest>(
      'SELECT * FROM transfer_requests WHERE to_staff_id = ? AND status = ? ORDER BY created_at DESC',
      [staffId, 'pending']
    );
    
    return requests;
  } catch (error) {
    console.error('[TransferService] Get pending transfer requests error:', error);
    return [];
  }
}

export async function deleteTransferRequest(requestId: number, staffId: number): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  
  try {
    const request = await db.get<TransferRequest>(
      'SELECT * FROM transfer_requests WHERE id = ?',
      [requestId]
    );
    
    if (!request) {
      return { success: false, error: 'ת�����󲻴���' };
    }
    
    if (request.from_staff_id !== staffId && request.to_staff_id !== staffId) {
      return { success: false, error: '����Ȩɾ����ת������' };
    }
    
    await db.run('DELETE FROM transfer_requests WHERE id = ?', [requestId]);
    
    return { success: true };
  } catch (error) {
    console.error('[TransferService] Delete transfer request error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'ɾ��ת������ʧ��' };
  }
}

export async function getTransferRequestsBySession(sessionId: string): Promise<TransferRequest[]> {
  const db = getDb();
  
  try {
    const requests = await db.all<TransferRequest>(
      'SELECT * FROM transfer_requests WHERE session_id = ? ORDER BY created_at DESC',
      [sessionId]
    );
    
    return requests;
  } catch (error) {
    console.error('[TransferService] Get transfer requests by session error:', error);
    return [];
  }
}
