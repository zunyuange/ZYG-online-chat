import { Hono } from 'hono';
import { getDb } from '@server/shared/db';
import { verifyToken } from '@server/module-auth/services/auth-service';
import { verifyAdminToken } from '@server/module-admin/routes/admin-auth-routes';
import { hashPassword } from '@server/shared/crypto';
import { getDomainService } from '@server/services/domain-service';
import { getAIRouter } from '@server/services/ai-router';

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
      // ★ 管理员 Token：查找平台默认商家 ID
      const db = getDb();
      const defaultBiz = await db.get<{ id: number }>(
        "SELECT id FROM staff_users WHERE business_slug = 'default' AND business_id = 0 LIMIT 1"
      );
      const resolvedBusinessId = defaultBiz?.id || 1;
      c.set('businessId', resolvedBusinessId);
      c.set('userId', adminResult.userId || 1);
      c.set('isPlatformAdmin', true);
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
  
  c.set('businessId', businessId);
  c.set('userId', result.userId || businessId);

  await next();
}

// ===== 公开端点：根据 Host 头识别商家（无需认证）=====
// 用于子域名/自定义域名访问时，前端自动识别商家归属
businessRoutes.get('/resolve-by-host', async (c) => {
  const businessId = c.get('businessId');
  const businessSlug = c.get('businessSlug');
  const businessName = c.get('businessName');
  const viaDomain = c.get('viaDomain');

  if (businessId && businessSlug) {
    return c.json({
      success: true,
      data: {
        id: businessId,
        slug: businessSlug,
        name: businessName || '',
        viaDomain: viaDomain || 'unknown',
      },
    });
  }

  return c.json({ success: false, error: '无法从域名识别商家' }, 404);
});

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
    console.log('[BusinessRoutes] Querying business list...');
    const businesses = await db.all(
      'SELECT id, business_name as name, business_slug as slug, created_at FROM staff_users WHERE business_id = 0 ORDER BY created_at DESC'
    );
    console.log('[BusinessRoutes] Found', businesses.length, 'businesses');
    return c.json({ success: true, data: businesses });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : '';
    console.error('[BusinessRoutes] Get business list error:', errMsg, errStack);
    return c.json({ success: false, error: `Failed to get business list: ${errMsg}` }, 500);
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
        business = await db.get(
          'SELECT id, business_name, business_slug, default_lang as lang, created_at, updated_at FROM staff_users WHERE id = ?',
          [businessId]
        );
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
      'INSERT INTO staff_users (username, password_hash, business_name, business_slug, business_id, role, status, enable_auto_trans, default_lang, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, passwordHash, name, slug, 0, 'admin', 'active', 1, 'zh-CN', Date.now(), Date.now()]
    );

    const newBusiness = await db.get('SELECT id, business_name as name, business_slug as slug, created_at FROM staff_users WHERE id = ?', [result.lastInsertRowid]);

    // 🆕 自动生成三级子域名
    let chatUrl = `https://zygonlinechat.zygmail.icu/chat?business=${slug}`;
    let autoDomain = null;
    let autoDomainError: string | null = null;
    try {
      const domainService = getDomainService();
      const domainResult = await domainService.createAutoSubdomain(
        Number(result.lastInsertRowid),
        slug
      );
      if (domainResult.success && domainResult.domain) {
        autoDomain = domainResult.domain;
        chatUrl = `https://${autoDomain}`;
        console.log(`[BusinessRoutes] ✅ Auto-generated domain for business ${slug}: ${autoDomain}`);
      } else {
        autoDomainError = domainResult.error || '子域名创建失败';
        console.warn(`[BusinessRoutes] ⚠️ Auto-subdomain creation unsuccessful for ${slug}:`, autoDomainError);
      }
    } catch (err) {
      autoDomainError = err instanceof Error ? err.message : String(err);
      console.error(`[BusinessRoutes] ❌ Auto-subdomain creation failed for ${slug}:`, autoDomainError);
    }

    return c.json({
      success: true,
      message: '商家创建成功' + (autoDomainError ? ` (但自动生成三级域名失败: ${autoDomainError})` : ''),
      data: {
        ...newBusiness,
        chatUrl,
        autoDomain,
        autoDomainError,
        legacyChatUrl: `https://zygonlinechat.zygmail.icu/chat?business=${slug}`,
        workersDevUrl: `https://zyg-online-chat.linzihai.workers.dev/chat?business=${slug}`,
      },
    }, 201);
  } catch (error) {
    console.error('Create business error:', error);
    return c.json({ success: false, error: '创建商家失败' }, 500);
  }
});

// 🆕 AI配置中间件（需要认证）
businessRoutes.use('/ai-config', requireAuth);

// 🆕 GET /api/business/ai-config - 获取商家AI配置
businessRoutes.get('/ai-config', async (c) => {
  try {
    const businessId = c.get('businessId');
    if (!businessId) {
      return c.json({ success: false, error: '未找到商家ID' }, 400);
    }

    const aiRouter = getAIRouter();
    const config = await aiRouter.getBusinessAIConfig(businessId);

    return c.json({
      success: true,
      data: config ? {
        businessId: config.businessId,
        aiMode: config.aiMode,
        cfAccountId: config.cfAccountId,
        // 不返回加密token
        hasToken: !!config.cfAiTokenEncrypted,
        monthlyTranslateCount: config.monthlyTranslateCount,
        monthlyTranslateLimit: config.monthlyTranslateLimit,
        resetDay: config.resetDay,
      } : {
        businessId,
        aiMode: 'platform',
        cfAccountId: null,
        hasToken: false,
        monthlyTranslateCount: 0,
        monthlyTranslateLimit: 10000,
        resetDay: 1,
      },
    });
  } catch (error) {
    console.error('Get AI config error:', error);
    return c.json({ success: false, error: '获取AI配置失败' }, 500);
  }
});

// 🆕 PUT /api/business/ai-config - 更新商家AI配置
businessRoutes.put('/ai-config', async (c) => {
  try {
    const businessId = c.get('businessId');
    if (!businessId) {
      return c.json({ success: false, error: '未找到商家ID' }, 400);
    }

    const body = await c.req.json();
    const { aiMode, cfAccountId, cfAiToken, monthlyTranslateLimit } = body;

    // 验证
    if (aiMode && !['platform', 'own_cf'].includes(aiMode)) {
      return c.json({ success: false, error: '无效的AI模式' }, 400);
    }

    if (aiMode === 'own_cf') {
      if (!cfAccountId) {
        return c.json({ success: false, error: '使用自有CF AI需要提供Account ID' }, 400);
      }
      if (!cfAiToken) {
        return c.json({ success: false, error: '使用自有CF AI需要提供API Token' }, 400);
      }
    }

    const aiRouter = getAIRouter();
    await aiRouter.upsertBusinessAIConfig(businessId, {
      aiMode: aiMode || 'platform',
      cfAccountId,
      cfAiToken,
      monthlyTranslateLimit: monthlyTranslateLimit || 10000,
    });

    console.log(`[BusinessRoutes] AI config updated for business ${businessId}: mode=${aiMode}`);

    return c.json({ success: true, message: 'AI配置更新成功' });
  } catch (error) {
    console.error('Update AI config error:', error);
    return c.json({ success: false, error: '更新AI配置失败' }, 500);
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