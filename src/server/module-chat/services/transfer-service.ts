import { getDb } from '@server/shared/db'

export interface TransferRequest {
  id: number
  session_id: string
  from_staff_id: number
  to_staff_id: number
  reason: string
  reject_reason?: string
  status: 'pending' | 'accepted' | 'rejected'
  created_at: number
  updated_at: number
}

export interface CreateTransferRequestParams {
  sessionId: string
  fromStaffId: number
  toStaffId: number
  reason: string
  businessId?: number
}

export async function createTransferRequest(
  params: CreateTransferRequestParams
): Promise<{ success: boolean; data?: TransferRequest; error?: string }> {
  const db = getDb()

  try {
    const session = await db.get<{ id: string; business_id: number; service_id: number; assigned_staff_id: number }>(
      'SELECT id, business_id, service_id, assigned_staff_id FROM sessions WHERE id = ?',
      [params.sessionId]
    )

    if (!session) {
      return { success: false, error: '会话不存在' }
    }

    if (params.businessId && params.businessId !== 0 && session.business_id !== params.businessId) {
      return { success: false, error: '无权访问该会话' }
    }

    // 检查是否是该会话的当前客服
    // 优先检查 assigned_staff_id（客服接收会话后设置），回退检查 service_id（兼容旧数据）
    const currentStaffId = session.assigned_staff_id || session.service_id || 0;
    if (currentStaffId === 0) {
      return { success: false, error: '该会话尚未被客服接收，无法转接' }
    }
    if (currentStaffId !== params.fromStaffId) {
      return { success: false, error: '您不是该会话的当前客服' }
    }

    if (params.businessId && params.businessId !== 0) {
      const targetStaff = await db.get<{ id: number }>(
        'SELECT id FROM staff_users WHERE id = ? AND business_id = ?',
        [params.toStaffId, params.businessId]
      )
      if (!targetStaff) {
        return { success: false, error: '目标客服不属于当前商家' }
      }
    }

    const existingRequest = await db.get<TransferRequest>(
      'SELECT id FROM transfer_requests WHERE session_id = ? AND status = ?',
      [params.sessionId, 'pending']
    )

    if (existingRequest) {
      return { success: false, error: '已存在待处理的转接请求' }
    }

    const result = await db.run(
      'INSERT INTO transfer_requests (session_id, from_staff_id, to_staff_id, reason, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        params.sessionId,
        params.fromStaffId,
        params.toStaffId,
        params.reason,
        'pending',
        Date.now(),
        Date.now(),
      ]
    )

    const request = await db.get<TransferRequest>('SELECT * FROM transfer_requests WHERE id = ?', [
      result.lastInsertRowid,
    ])

    return { success: true, data: request! }
  } catch (error) {
    console.error('[TransferService] Create transfer request error:', error)
    return { success: false, error: error instanceof Error ? error.message : '创建转接请求失败' }
  }
}

export async function respondToTransferRequest(
  requestId: number,
  staffId: number,
  action: 'accept' | 'reject',
  rejectReason?: string,
  businessId?: number
): Promise<{ success: boolean; error?: string }> {
  const db = getDb()

  try {
    const request = await db.get<TransferRequest & { session_business_id?: number }>(
      `SELECT tr.*, s.business_id as session_business_id
       FROM transfer_requests tr
       JOIN sessions s ON tr.session_id = s.id
       WHERE tr.id = ?`,
      [requestId]
    )

    if (!request) {
      return { success: false, error: '转接请求不存在' }
    }

    if (request.to_staff_id !== staffId) {
      return { success: false, error: '无权限处理该转接请求' }
    }

    if (request.status !== 'pending') {
      return { success: false, error: '转接请求已处理' }
    }

    if (businessId && businessId !== 0 && request.session_business_id !== businessId) {
      return { success: false, error: '无权处理该转接请求' }
    }

    const status = action === 'accept' ? 'accepted' : 'rejected'

    if (action === 'accept') {
      // 多租户隔离：UPDATE 带 business_id 条件防御
      // 同时更新 assigned_staff_id 和 service_id，确保翻译等功能能正确识别当前客服
      if (businessId && businessId !== 0) {
        await db.run(
          'UPDATE sessions SET assigned_staff_id = ?, service_id = ?, updated_at = ? WHERE id = ? AND business_id = ?',
          [staffId, staffId, Date.now(), request.session_id, businessId]
        )
      } else {
        await db.run('UPDATE sessions SET assigned_staff_id = ?, service_id = ?, updated_at = ? WHERE id = ?', [
          staffId,
          staffId,
          Date.now(),
          request.session_id,
        ])
      }

      await db.run('UPDATE transfer_requests SET status = ?, updated_at = ? WHERE id = ?', [
        status,
        Date.now(),
        requestId,
      ])
    } else {
      // Reject with reason
      await db.run(
        'UPDATE transfer_requests SET status = ?, reject_reason = ?, updated_at = ? WHERE id = ?',
        [status, rejectReason || null, Date.now(), requestId]
      )
    }

    return { success: true }
  } catch (error) {
    console.error('[TransferService] Respond to transfer request error:', error)
    return { success: false, error: error instanceof Error ? error.message : '创建转接请求失败' }
  }
}

export async function getPendingTransferRequests(staffId: number): Promise<any[]> {
  const db = getDb()

  try {
    const requests = await db.all(
      `SELECT 
        tr.*,
        s.visitor_name as session_visitor_name,
        su.name as from_staff_name,
        su.username as from_staff_username
      FROM transfer_requests tr
      JOIN sessions s ON tr.session_id = s.id
      JOIN staff_users su ON tr.from_staff_id = su.id
      WHERE tr.to_staff_id = ? AND tr.status = 'pending'
      ORDER BY tr.created_at DESC`,
      [staffId]
    )

    return requests
  } catch (error) {
    console.error('[TransferService] Get pending transfer requests error:', error)
    return []
  }
}

export async function deleteTransferRequest(
  requestId: number,
  staffId: number
): Promise<{ success: boolean; error?: string }> {
  const db = getDb()

  try {
    const request = await db.get<TransferRequest>('SELECT * FROM transfer_requests WHERE id = ?', [
      requestId,
    ])

    if (!request) {
      return { success: false, error: '转接请求不存在' }
    }

    if (request.from_staff_id !== staffId && request.to_staff_id !== staffId) {
      return { success: false, error: '无权限删除该转接请求' }
    }

    await db.run('DELETE FROM transfer_requests WHERE id = ?', [requestId])

    return { success: true }
  } catch (error) {
    console.error('[TransferService] Delete transfer request error:', error)
    return { success: false, error: error instanceof Error ? error.message : '删除转接请求失败' }
  }
}

export async function getTransferRequestsBySession(sessionId: string): Promise<TransferRequest[]> {
  const db = getDb()

  try {
    const requests = await db.all<TransferRequest>(
      'SELECT * FROM transfer_requests WHERE session_id = ? ORDER BY created_at DESC',
      [sessionId]
    )

    return requests
  } catch (error) {
    console.error('[TransferService] Get transfer requests by session error:', error)
    return []
  }
}

export async function getMyTransferRequests(staffId: number, sessionId?: string): Promise<any[]> {
  const db = getDb()

  try {
    let query = `
      SELECT 
        tr.*,
        s.visitor_name as session_visitor_name,
        su.name as to_staff_name,
        su.username as to_staff_username
      FROM transfer_requests tr
      JOIN sessions s ON tr.session_id = s.id
      JOIN staff_users su ON tr.to_staff_id = su.id
      WHERE tr.from_staff_id = ?
    `
    const params: any[] = [staffId]

    if (sessionId) {
      query += ' AND tr.session_id = ?'
      params.push(sessionId)
    }

    query += ' ORDER BY tr.created_at DESC'

    const requests = await db.all(query, params)

    return requests
  } catch (error) {
    console.error('[TransferService] Get my transfer requests error:', error)
    return []
  }
}
