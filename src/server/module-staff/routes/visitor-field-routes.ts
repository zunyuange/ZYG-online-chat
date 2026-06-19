/**
 * 访客自定义字段管理路由
 * 用于管理每个商家主体的自定义访客字段定义
 */
import { Hono } from 'hono';
import { getDb } from '../../shared/db';
import { verifyToken } from '@server/module-auth/services/auth-service';

const visitorFieldRoutes = new Hono();

// 认证中间件
async function requireAuth(c: any, next: any) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '未提供认证令牌' }, 401);
  }

  const token = authHeader.substring(7);
  const result = await verifyToken(token);

  if (!result.valid) {
    return c.json({ success: false, error: result.error || 'Token 无效' }, 401);
  }

  c.set('staffUser', result.staff || {
    userId: result.userId,
    username: result.username,
    businessId: result.businessId,
    role: result.role,
  });
  await next();
}

// 所有接口都需要认证
visitorFieldRoutes.use('*', requireAuth);

// 获取当前商家所有访客自定义字段
visitorFieldRoutes.get('/', async (c) => {
  try {
    const db = getDb();
    const staffUser = c.get('staffUser');
    const businessId = staffUser.businessId;

    // 先获取系统固定字段
    const fixedFields = [
      { id: 'fixed_0', fieldKey: 'userName', label: '姓名', type: 'text', isFixed: true, remark: '访客姓名/用户名（URL参数userName传入，自动备注）' },
      { id: 'fixed_1', fieldKey: 'email', label: '邮箱', type: 'text', isFixed: true, remark: '访客邮箱地址' },
      { id: 'fixed_2', fieldKey: 'phone', label: '手机', type: 'text', isFixed: true, remark: '访客手机号码' },
      { id: 'fixed_3', fieldKey: 'pid', label: '用户ID', type: 'text', isFixed: true, remark: '跨系统唯一标识' },
      { id: 'fixed_4', fieldKey: 'params', label: '自定义参数', type: 'json', isFixed: true, remark: 'URL传入的JSON自定义参数' },
      { id: 'fixed_5', fieldKey: 'ip', label: 'IP地址', type: 'text', isFixed: true, remark: '访客IP地址（自动获取）' },
      { id: 'fixed_6', fieldKey: 'fromUrl', label: '进入链接', type: 'url', isFixed: true, remark: '访客进入时的完整URL' },
      { id: 'fixed_7', fieldKey: 'referer', label: '来源地址', type: 'url', isFixed: true, remark: '访客来源页面（HTTP Referer）' },
      { id: 'fixed_8', fieldKey: 'userAgent', label: '浏览器', type: 'text', isFixed: true, remark: '访客浏览器User-Agent信息' },
      { id: 'fixed_9', fieldKey: 'device', label: '设备', type: 'text', isFixed: true, remark: '访客设备类型（自动识别）' },
      { id: 'fixed_10', fieldKey: 'lang', label: '语言', type: 'text', isFixed: true, remark: '访客语言偏好' },
      { id: 'fixed_11', fieldKey: 'avatar', label: '头像', type: 'url', isFixed: true, remark: '访客头像URL' },
    ];

    // 获取自定义字段
    const customFields = await db.all(
      'SELECT id, field_key as fieldKey, label, type, remark, sort_order as sortOrder, is_active as isActive, created_at as createdAt FROM visitor_custom_fields WHERE business_id = ? ORDER BY sort_order ASC',
      [businessId]
    );

    return c.json({
      success: true,
      data: {
        fixedFields,
        customFields: customFields.map((f: any) => ({ ...f, isFixed: false })),
      },
    });
  } catch (error) {
    console.error('Failed to get visitor fields:', error);
    return c.json({ success: false, error: '获取访客字段失败' }, 500);
  }
});

// 添加自定义字段
visitorFieldRoutes.post('/', async (c) => {
  try {
    const db = getDb();
    const staffUser = c.get('staffUser');
    const businessId = staffUser.businessId;

    const body = await c.req.json();
    const { fieldKey, label, type = 'text', remark = '' } = body;

    if (!fieldKey || !label) {
      return c.json({ success: false, error: '字段标识和显示名称不能为空' }, 400);
    }

    // 验证 fieldKey 格式（只允许英文字母、数字、下划线）
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldKey)) {
      return c.json({ success: false, error: '字段标识只能包含英文字母、数字和下划线，且不能以数字开头' }, 400);
    }

    // 检查是否与固定字段冲突
    const fixedKeys = ['userName', 'email', 'phone', 'pid', 'params', 'ip', 'fromUrl', 'referer', 'userAgent', 'device', 'lang', 'avatar'];
    if (fixedKeys.includes(fieldKey)) {
      return c.json({ success: false, error: `字段标识 "${fieldKey}" 已被系统固定字段使用` }, 400);
    }

    // 检查同一商家下是否已存在
    const existing = await db.get(
      'SELECT id FROM visitor_custom_fields WHERE business_id = ? AND field_key = ?',
      [businessId, fieldKey]
    );
    if (existing) {
      return c.json({ success: false, error: `字段标识 "${fieldKey}" 已存在` }, 400);
    }

    // 获取最大排序号
    const maxSort = await db.get<{ maxSort: number }>(
      'SELECT MAX(sort_order) as maxSort FROM visitor_custom_fields WHERE business_id = ?',
      [businessId]
    );
    const sortOrder = (maxSort?.maxSort || 0) + 1;

    const now = Date.now();
    const result = await db.run(
      'INSERT INTO visitor_custom_fields (business_id, field_key, label, type, remark, sort_order, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)',
      [businessId, fieldKey, label, type, remark, sortOrder, now, now]
    );

    return c.json({
      success: true,
      data: {
        id: result.lastInsertRowid,
        fieldKey,
        label,
        type,
        remark,
        sortOrder,
        isActive: true,
        isFixed: false,
        createdAt: now,
      },
    });
  } catch (error) {
    console.error('Failed to create visitor field:', error);
    return c.json({ success: false, error: '创建字段失败' }, 500);
  }
});

// 更新自定义字段
visitorFieldRoutes.put('/:id', async (c) => {
  try {
    const db = getDb();
    const staffUser = c.get('staffUser');
    const businessId = staffUser.businessId;
    const fieldId = parseInt(c.req.param('id'));

    const body = await c.req.json();
    const { label, type, remark, isActive, sortOrder } = body;

    // 验证归属
    const field = await db.get(
      'SELECT * FROM visitor_custom_fields WHERE id = ? AND business_id = ?',
      [fieldId, businessId]
    );
    if (!field) {
      return c.json({ success: false, error: '字段不存在或无权操作' }, 404);
    }

    const now = Date.now();
    await db.run(
      'UPDATE visitor_custom_fields SET label = ?, type = ?, remark = ?, is_active = ?, sort_order = ?, updated_at = ? WHERE id = ?',
      [
        label ?? (field as any).label,
        type ?? (field as any).type,
        remark ?? (field as any).remark,
        isActive !== undefined ? (isActive ? 1 : 0) : (field as any).is_active,
        sortOrder ?? (field as any).sort_order,
        now,
        fieldId,
      ]
    );

    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to update visitor field:', error);
    return c.json({ success: false, error: '更新字段失败' }, 500);
  }
});

// 删除自定义字段
visitorFieldRoutes.delete('/:id', async (c) => {
  try {
    const db = getDb();
    const staffUser = c.get('staffUser');
    const businessId = staffUser.businessId;
    const fieldId = parseInt(c.req.param('id'));

    const field = await db.get(
      'SELECT * FROM visitor_custom_fields WHERE id = ? AND business_id = ?',
      [fieldId, businessId]
    );
    if (!field) {
      return c.json({ success: false, error: '字段不存在或无权操作' }, 404);
    }

    await db.run('DELETE FROM visitor_custom_fields WHERE id = ?', [fieldId]);

    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to delete visitor field:', error);
    return c.json({ success: false, error: '删除字段失败' }, 500);
  }
});

export { visitorFieldRoutes };
