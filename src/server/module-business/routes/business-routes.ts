import { Hono } from 'hono';
import { getDb } from '@server/shared/db';
import { verifyToken } from '@server/module-auth/services/auth-service';

const businessRoutes = new Hono();

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
    const { enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang } = body;

    const db = getDb();
    await db.run(
      'UPDATE businesses SET enable_auto_trans = ?, bd_trans_appid = ?, bd_trans_secret = ?, default_lang = ?, updated_at = ? WHERE id = 1',
      [enable_auto_trans ? 1 : 0, bd_trans_appid, bd_trans_secret, default_lang, Date.now()]
    );

    return c.json({ success: true });
  } catch (error) {
    console.error('Update business settings error:', error);
    return c.json({ success: false, error: 'Failed to update settings' }, 500);
  }
});

export { businessRoutes };