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

  // businessId 可能是 0（超级管理员），需要用 !== undefined 判断
  if (result.businessId !== undefined) {
    c.set('businessId', result.businessId);
  }

  await next();
}

businessRoutes.use('/settings', (c, next) => {
  if (c.req.method === 'POST' || c.req.method === 'GET') {
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
      // Get business from authenticated user
      const authHeader = c.req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const result = await verifyToken(token);
        
        if (result.valid && result.userId) {
          // For business owners (business_id = 0), use their own id
          // For staff (business_id > 0), use business_id to find the business
          const userId = Number(result.userId);
          const businessId = Number(result.businessId);
          
          if (businessId && businessId > 0) {
            // This is a staff user, get business info from business_id
            business = await db.get(
              'SELECT id, business_name, business_slug, default_lang as lang, created_at, updated_at FROM staff_users WHERE id = ?',
              [businessId]
            );
          } else {
            // This is a business owner (business_id = 0), get their own info
            business = await db.get(
              'SELECT id, business_name, business_slug, default_lang as lang, created_at, updated_at FROM staff_users WHERE id = ?',
              [userId]
            );
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
        'SELECT enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang FROM staff_users WHERE business_slug = ?',
        [slug]
      );
    } else {
      // 从认证上下文中获取 businessId
      const businessId = c.get('businessId');
      if (businessId) {
        settings = await db.get(
          'SELECT enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang FROM staff_users WHERE id = ?',
          [businessId]
        );
      }
      
      // 兜底
      if (!settings) {
        settings = await db.get(
          'SELECT enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang FROM staff_users WHERE business_slug = "default"'
        );
      }
    }

    if (!settings) {
      return c.json({ success: false, error: 'Business not found' }, 404);
    }

    return c.json({ success: true, data: {
      enable_auto_trans: settings.enable_auto_trans === 1,
      bd_trans_appid: settings.bd_trans_appid || '',
      bd_trans_secret: settings.bd_trans_secret || '',
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
    const businessId = c.get('businessId');
    
    let query = 'UPDATE staff_users SET business_name = ?, updated_at = ? WHERE ';
    let params: unknown[] = [business_name, Date.now()];
    
    if (businessId) {
      query += 'id = ?';
      params.push(businessId);
    } else {
      // 从 token 中获取 businessId
      const authHeader = c.req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const result = await verifyToken(token);
        if (result.valid && result.businessId) {
          query += 'id = ?';
          params.push(result.businessId);
        } else {
          query += 'business_slug = "default"';
        }
      } else {
        query += 'business_slug = "default"';
      }
    }

    await db.run(query, params);

    return c.json({ success: true });
  } catch (error) {
    console.error('Update business info error:', error);
    return c.json({ success: false, error: 'Failed to update business info' }, 500);
  }
});

businessRoutes.post('/settings', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang, business_id, business_slug } = body;

    const db = getDb();
    
    let query = 'UPDATE staff_users SET enable_auto_trans = ?, bd_trans_appid = ?, bd_trans_secret = ?, default_lang = ?, updated_at = ? WHERE ';
    let params: unknown[] = [enable_auto_trans ? 1 : 0, bd_trans_appid, bd_trans_secret, default_lang, Date.now()];
    
    if (business_id) {
      query += 'id = ?';
      params.push(business_id);
    } else if (business_slug) {
      query += 'business_slug = ?';
      params.push(business_slug);
    } else {
      const businessId = c.get('businessId');
      if (businessId) {
        query += 'id = ?';
        params.push(businessId);
      } else {
        // 没有 business context，回退到从 token 解析
        const authHeader = c.req.header('Authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const result = await verifyToken(token);
          if (result.valid && result.businessId) {
            query += 'id = ?';
            params.push(result.businessId);
          } else {
            return c.json({ success: false, error: '无法确定商家身份' }, 400);
          }
        } else {
          return c.json({ success: false, error: '缺少认证信息' }, 401);
        }
      }
    }

    await db.run(query, params);

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
      'INSERT INTO staff_users (username, password_hash, business_name, business_slug, description, business_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, passwordHash, name, slug, description || '', 0, 'admin', 'active', Date.now(), Date.now()]
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