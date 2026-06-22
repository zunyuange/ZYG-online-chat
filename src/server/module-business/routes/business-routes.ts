import { Hono } from 'hono';
import { getDb } from '@server/shared/db';
import { verifyToken } from '@server/module-auth/services/auth-service';
import { verifyAdminToken } from '@server/module-admin/routes/admin-auth-routes';
import { hashPassword } from '@server/shared/crypto';

const businessRoutes = new Hono();

async function requireAuth(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '未提供认证令牌' }, 401);
  }

  const token = authHeader.substring(7);
  
  let result = await verifyToken(token);
  
  if (!result.valid) {
    const adminResult = await verifyAdminToken(token);
    if (adminResult.valid) {
      // admin_users 的管理员 token，使用默认商家 id=1
      c.set('businessId', adminResult.userId || 1);
      await next();
      return;
    }
    return c.json({ success: false, error: 'Token 无效' }, 401);
  }

  // 修复旧 token 中 businessId=0 的问题：使用 userId 替代
  // 只有 default 商家的 admin 才保持 businessId=0（超级管理员权限）
  let businessId = result.businessId;
  if (businessId === 0 && result.userId && result.businessSlug !== 'default') {
    businessId = result.userId;
  }
  
  if (businessId !== undefined) {
    c.set('businessId', businessId);
  }

  await next();
}

businessRoutes.use('/settings', (c, next) => {
  if (c.req.method === 'POST' || c.req.method === 'GET') {
    return requireAuth(c, next);
  }
  return next();
});

// GET /info 也需要认证
businessRoutes.use('/info', (c, next) => {
  if (c.req.method === 'GET') {
    return requireAuth(c, next);
  }
  return next();
});

// 具体路由放在前面
businessRoutes.get('/list', async (c) => {
  try {
    const db = getDb();
    const businesses = await db.all(
      'SELECT id, business_name as name, business_slug as slug, description, created_at FROM staff_users WHERE business_id = 0 ORDER BY created_at DESC'
    );
    return c.json({ success: true, data: businesses });
  } catch (error) {
    console.error('Get business list error:', error);
    return c.json({ success: false, error: 'Failed to get business list' }, 500);
  }
});

businessRoutes.get('/info', async (c) => {
  try {
    const db = getDb();
    const slug = c.req.query('slug');
    
    let business;
    if (slug) {
      business = await db.get(
        'SELECT id, business_name, business_slug, default_lang as lang, created_at, updated_at FROM staff_users WHERE business_slug = ?',
        [slug]
      );
    } else {
      // 优先从认证上下文获取 businessId（通过 requireAuth 中间件设置）
      let businessId = c.get('businessId');
      
      // businessId 可能是 0（超级管理员使用旧 token），需要用 userId 替代
      if (businessId === 0) {
        const authHeader = c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const result = await verifyToken(token);
          if (result.valid && result.userId) {
            businessId = result.userId;
          }
        }
      }
      
      if (businessId !== undefined && businessId > 0) {
        // ★ 关键修复：先查当前用户，判断是商家管理员还是下属客服
        const currentUser = await db.get<{ id: number; business_id: number; role: string; business_slug: string | null; business_name: string | null }>(
          'SELECT id, business_id, role, business_slug, business_name FROM staff_users WHERE id = ?',
          [businessId]
        );

        if (currentUser) {
          // 如果是商家管理员（有自己的 business_slug），直接返回自己的信息
          if (currentUser.role === 'admin' && currentUser.business_slug) {
            business = {
              id: currentUser.id,
              business_name: currentUser.business_name || '默认商家',
              business_slug: currentUser.business_slug,
              lang: null,
              created_at: 0,
              updated_at: 0,
            };
            console.log('[BusinessRoutes] /info: user is admin with slug:', currentUser.business_slug);
          } else if (currentUser.business_id && currentUser.business_id !== currentUser.id) {
            // ★ 下属客服：business_id 指向上级商家 → 查上级商家信息
            business = await db.get(
              'SELECT id, business_name, business_slug, default_lang as lang, created_at, updated_at FROM staff_users WHERE id = ?',
              [currentUser.business_id]
            );
            console.log('[BusinessRoutes] /info: user is staff, resolved parent business_id:', currentUser.business_id);
          } else {
            // 兜底：按 businessId 查（商家管理员但没 slug）
            business = await db.get(
              'SELECT id, business_name, business_slug, default_lang as lang, created_at, updated_at FROM staff_users WHERE id = ?',
              [businessId]
            );
          }
        } else {
          // 按 businessId 查不到用户，说明是无效上下文
          business = null;
        }
      } else {
        // 回退：从 token 解析
        const authHeader = c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const result = await verifyToken(token);
          
          if (result.valid && result.userId) {
            const userId = Number(result.userId);
            const bizId = Number(result.businessId);
            
            if (bizId !== undefined && bizId > 0) {
              business = await db.get(
                'SELECT id, business_name, business_slug, default_lang as lang, created_at, updated_at FROM staff_users WHERE id = ?',
                [bizId]
              );
            } else {
              business = await db.get(
                'SELECT id, business_name, business_slug, default_lang as lang, created_at, updated_at FROM staff_users WHERE id = ?',
                [userId]
              );
            }
          }
        }
      }
      
      // Fallback to default if no auth or not found
      if (!business) {
        business = await db.get(
          'SELECT id, business_name, business_slug, default_lang as lang, created_at, updated_at FROM staff_users WHERE business_slug = "default"'
        );
      }
    }

    if (!business) {
      return c.json({ success: false, error: 'Business not found' }, 404);
    }

    return c.json({ success: true, data: business });
  } catch (error) {
    console.error('Get business info error:', error);
    return c.json({ success: false, error: 'Failed to get business info' }, 500);
  }
});

businessRoutes.get('/settings', async (c) => {
  try {
    const db = getDb();
    const slug = c.req.query('slug');
    
    let settings;
    if (slug) {
      settings = await db.get(
        'SELECT enable_auto_trans, default_lang FROM staff_users WHERE business_slug = ?',
        [slug]
      );
    } else {
      // 从认证上下文中获取 businessId
      let businessId = c.get('businessId');
      
      // businessId 可能是 0（商家主账号使用旧 token），需要用 userId 替代
      if (businessId === 0) {
        const authHeader = c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const result = await verifyToken(token);
          if (result.valid && result.userId) {
            businessId = result.userId;
          }
        }
      }
      
      if (businessId !== undefined && businessId > 0) {
        settings = await db.get(
          'SELECT enable_auto_trans, default_lang FROM staff_users WHERE id = ?',
          [businessId]
        );
      }
      
      // 兜底
      if (!settings) {
        settings = await db.get(
          'SELECT enable_auto_trans, default_lang FROM staff_users WHERE business_slug = "default"'
        );
      }
    }

    if (!settings) {
      return c.json({ success: false, error: 'Business not found' }, 404);
    }

    return c.json({ success: true, data: {
      enable_auto_trans: settings.enable_auto_trans === 1,
      default_lang: settings.default_lang || 'zh-CN',
    }});
  } catch (error) {
    console.error('Get business settings error:', error);
    return c.json({ success: false, error: 'Failed to get settings' }, 500);
  }
});

businessRoutes.post('/info', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { business_name } = body;

    const db = getDb();
    let businessId = c.get('businessId');
    
    // 从 token 重新解析以获取完整信息（用于调试和准确判断）
    const authHeader = c.req.header('Authorization');
    let tokenPayload: any = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const result = await verifyToken(token);
      if (result.valid) {
        tokenPayload = result;
      }
    }
    
    console.log('[POST /info] businessId from context:', businessId, 'type:', typeof businessId);
    console.log('[POST /info] tokenPayload:', JSON.stringify(tokenPayload));
    console.log('[POST /info] business_name to set:', business_name);
    
    // 直接使用 token 中的 businessId 或 userId
    if (tokenPayload) {
      let effectiveId = tokenPayload.businessId;
      if (effectiveId === undefined || effectiveId === 0) {
        effectiveId = tokenPayload.userId;
      }
      
      if (effectiveId && effectiveId > 0) {
        await db.run(
          'UPDATE staff_users SET business_name = ?, updated_at = ? WHERE id = ?',
          [business_name, Date.now(), effectiveId]
        );
        // 返回实际修改的用户 ID，方便调试
        return c.json({ 
          success: true, 
          debug: { updatedUserId: effectiveId, businessName: business_name } 
        });
      }
    }

    return c.json({ success: false, error: '无法确定商家身份，请重新登录' }, 400);
  } catch (error) {
    console.error('Update business info error:', error);
    return c.json({ success: false, error: 'Failed to update business info' }, 500);
  }
});

businessRoutes.post('/settings', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { enable_auto_trans, default_lang, business_id, business_slug } = body;

    const db = getDb();
    
    let targetId: number | undefined;
    
    if (business_id !== undefined && business_id > 0) {
      targetId = business_id;
    } else if (business_slug) {
      const biz = await db.get<{ id: number, business_id: number }>(
        'SELECT id, business_id FROM staff_users WHERE business_slug = ?',
        [business_slug]
      );
      if (biz) targetId = biz.id;
    } else {
      let businessId = c.get('businessId');
      
      if (businessId === 0) {
        const authHeader = c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const result = await verifyToken(token);
          if (result.valid && result.userId) {
            businessId = result.userId;
          }
        }
      }
      
      if (businessId !== undefined && businessId > 0) {
        targetId = businessId;
      } else {
        const authHeader = c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const result = await verifyToken(token);
          if (result.valid && result.businessId !== undefined && result.businessId > 0) {
            targetId = result.businessId;
          } else {
            return c.json({ success: false, error: '无法确定商家身份，请重新登录' }, 400);
          }
        } else {
          return c.json({ success: false, error: '缺少认证信息' }, 401);
        }
      }
    }

    if (!targetId) {
      return c.json({ success: false, error: '无法确定商家身份' }, 400);
    }

    await db.run(
      'UPDATE staff_users SET enable_auto_trans = ?, default_lang = ?, updated_at = ? WHERE id = ?',
      [enable_auto_trans ? 1 : 0, default_lang, Date.now(), targetId]
    );
    console.log('[POST /settings] Updated settings for user:', targetId);

    return c.json({ success: true });
  } catch (error) {
    console.error('Update business settings error:', error);
    return c.json({ success: false, error: 'Failed to update settings' }, 500);
  }
});

businessRoutes.post('/create', async (c) => {
  try {
    const body = await c.req.json();
    const { name, description, username, password } = body;

    if (!name) {
      return c.json({ success: false, error: '商家名称是必填项' }, 400);
    }
    if (!username) {
      return c.json({ success: false, error: '用户名是必填项' }, 400);
    }
    if (!password) {
      return c.json({ success: false, error: '密码是必填项' }, 400);
    }

    const db = getDb();

    const generateSlug = (): string => {
      const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      let slug = '';
      for (let i = 0; i < 8; i++) {
        slug += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return slug;
    };

    let slug = generateSlug();
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      const existing = await db.get('SELECT id FROM staff_users WHERE business_slug = ?', [slug]);
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return c.json({ success: false, error: '无法生成唯一的商家标识' }, 500);
    }

    const existingUser = await db.get('SELECT id FROM staff_users WHERE username = ?', [username]);
    if (existingUser) {
      return c.json({ success: false, error: '用户名已存在' }, 400);
    }

    const passwordHash = await hashPassword(password);

    const result = await db.run(
      'INSERT INTO staff_users (username, password_hash, business_name, business_slug, description, business_id, role, status, enable_auto_trans, default_lang, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, passwordHash, name, slug, description || '', 0, 'admin', 'active', 1, 'zh-CN', Date.now(), Date.now()]
    );

    const newBusiness = await db.get('SELECT id, business_name as name, business_slug as slug, description, created_at FROM staff_users WHERE id = ?', [result.lastInsertRowid]);

    return c.json({ success: true, message: '商家创建成功', data: newBusiness }, 201);
  } catch (error) {
    console.error('Create business error:', error);
    return c.json({ success: false, error: '创建商家失败' }, 500);
  }
});

// 动态路由放在最后
businessRoutes.get('/:slug', async (c) => {
  try {
    const db = getDb();
    const slug = c.req.param('slug');
    
    let business = await db.get(
      'SELECT id, business_name as name, business_slug as slug FROM staff_users WHERE business_slug = ?',
      [slug]
    );
    
    if (!business) {
      const id = parseInt(slug, 10);
      if (!isNaN(id)) {
        business = await db.get(
          'SELECT id, business_name as name, business_slug as slug FROM staff_users WHERE id = ?',
          [id]
        );
      }
    }

    if (!business) {
      return c.json({ success: false, error: 'Business not found' }, 404);
    }

    return c.json({ success: true, data: business });
  } catch (error) {
    console.error('Get business error:', error);
    return c.json({ success: false, error: 'Failed to get business' }, 500);
  }
});

export { businessRoutes };