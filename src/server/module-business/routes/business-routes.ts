import { Hono } from 'hono';
import { getDb } from '@server/shared/db';
import { verifyToken } from '@server/module-auth/services/auth-service';

const businessRoutes = new Hono();

businessRoutes.get('/info', async (c) => {
  try {
    const db = getDb();
    const business = await db.get(
      'SELECT id, name, slug, logo, description, theme, state, max_staff_count, lang FROM businesses WHERE id = 1'
    );

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
    const settings = await db.get(
      'SELECT enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang FROM businesses WHERE id = 1'
    );

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