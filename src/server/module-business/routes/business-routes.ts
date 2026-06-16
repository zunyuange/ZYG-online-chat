import { Hono } from 'hono';
import { getDb } from '@server/shared/db';
import { verifyToken } from '@server/module-auth/services/auth-service';
import { verifyAdminToken } from '@server/module-admin/routes/admin-auth-routes';

const businessRoutes = new Hono();

// Authentication middleware for protected routes
async function requireAuth(c: any, next: any) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: '未提供认证令牌' }, 401);
  }

  const token = authHeader.substring(7);
  
  // Try staff token first
  let result = await verifyToken(token);
  
  // If staff token fails, try admin token
  if (!result.valid) {
    const adminResult = await verifyAdminToken(token);
    if (adminResult.valid) {
      // Admin token is valid, set businessId from admin's business (default to 1)
      c.set('businessId', 1);
      await next();
      return;
    }
    return c.json({ success: false, error: 'Token 无效' }, 401);
  }

  // Attach businessId to context for downstream use
  if (result.businessId) {
    c.set('businessId', result.businessId);
  }

  await next();
}

// Apply auth middleware to POST /settings
businessRoutes.use('/settings', (c, next) => {
  if (c.req.method === 'POST') {
    return requireAuth(c, next);
  }
  return next();
});

// Get business by slug or id (public endpoint for chat page)
businessRoutes.get('/:slug', async (c) => {
  try {
    const db = getDb();
    const slug = c.req.param('slug');
    
    // Try to find by slug first
    let business = await db.get(
      'SELECT id, name, slug, logo, description, theme, state, max_staff_count, lang FROM businesses WHERE slug = ?',
      [slug]
    );
    
    // If not found, try by id
    if (!business) {
      const id = parseInt(slug, 10);
      if (!isNaN(id)) {
        business = await db.get(
          'SELECT id, name, slug, logo, description, theme, state, max_staff_count, lang FROM businesses WHERE id = ?',
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

// Get business info (default)
businessRoutes.get('/info', async (c) => {
  try {
    const db = getDb();
    const slug = c.req.query('slug');
    
    let business;
    if (slug) {
      // Get by slug
      business = await db.get(
        'SELECT id, name, slug, logo, description, theme, state, max_staff_count, lang FROM businesses WHERE slug = ?',
        [slug]
      );
    } else {
      // Get default business
      business = await db.get(
        'SELECT id, name, slug, logo, description, theme, state, max_staff_count, lang FROM businesses WHERE id = 1'
      );
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
        'SELECT enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang FROM businesses WHERE slug = ?',
        [slug]
      );
    } else {
      settings = await db.get(
        'SELECT enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang FROM businesses WHERE id = 1'
      );
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

businessRoutes.post('/settings', async (c) => {
  try {
    const body = await c.req.json();
    const { enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang, business_id, business_slug } = body;

    const db = getDb();
    
    // Determine which business to update
    let query = 'UPDATE businesses SET enable_auto_trans = ?, bd_trans_appid = ?, bd_trans_secret = ?, default_lang = ?, updated_at = ? WHERE ';
    let params: unknown[] = [enable_auto_trans ? 1 : 0, bd_trans_appid, bd_trans_secret, default_lang, Date.now()];
    
    if (business_id) {
      query += 'id = ?';
      params.push(business_id);
    } else if (business_slug) {
      query += 'slug = ?';
      params.push(business_slug);
    } else {
      // Fallback to business from authenticated user or default
      const businessId = c.get('businessId');
      if (businessId) {
        query += 'id = ?';
        params.push(businessId);
      } else {
        query += 'id = 1';
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
    const { name, description, max_staff_count = 10 } = body;

    if (!name) {
      return c.json({ success: false, error: '商家名称是必填项' }, 400);
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
      const existing = await db.get('SELECT id FROM businesses WHERE slug = ?', [slug]);
      if (!existing) break;
      slug = generateSlug();
      attempts++;
    }

    if (attempts >= maxAttempts) {
      return c.json({ success: false, error: '无法生成唯一的商家标识' }, 500);
    }

    const result = await db.run(
      'INSERT INTO businesses (name, slug, description, max_staff_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [name, slug, description || '', max_staff_count, Date.now(), Date.now()]
    );

    const newBusiness = await db.get('SELECT * FROM businesses WHERE id = ?', [result.lastInsertRowid]);

    return c.json({ success: true, message: '商家创建成功', data: newBusiness }, 201);
  } catch (error) {
    console.error('Create business error:', error);
    return c.json({ success: false, error: '创建商家失败' }, 500);
  }
});

export { businessRoutes };