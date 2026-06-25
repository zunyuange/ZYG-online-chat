/**
 * 商家域名管理 API 路由
 *
 * 接口:
 *   GET    /api/business/domains              - 获取域名列表
 *   POST   /api/business/domains/bind-cf      - CF一键绑定
 *   POST   /api/business/domains/bind-manual  - 手动绑定
 *   POST   /api/business/domains/:id/verify   - 验证DNS
 *   PUT    /api/business/domains/:id/primary  - 设为主域名
 *   DELETE /api/business/domains/:id          - 删除域名
 */

import { Hono } from 'hono';
import { getDomainService } from '@server/services/domain-service';
import { verifyToken } from '@server/module-auth/services/auth-service';
import { verifyAdminToken } from '@server/module-admin/routes/admin-auth-routes';

const businessDomainRoutes = new Hono();

// ==========================================
// 认证中间件
// ==========================================

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
      c.set('businessId', adminResult.userId || 1);
      c.set('userId', adminResult.userId || 1);
      await next();
      return;
    }
    return c.json({ success: false, error: 'Token 无效' }, 401);
  }

  let businessId = result.businessId;
  if (businessId === 0 && result.userId && result.businessSlug !== 'default') {
    businessId = result.userId;
  }

  c.set('businessId', businessId);
  c.set('userId', result.userId || businessId);

  await next();
}

// 所有域名管理接口都需要认证
businessDomainRoutes.use('*', requireAuth);

// ==========================================
// GET / - 获取域名列表
// ==========================================

businessDomainRoutes.get('/', async (c) => {
  try {
    const businessId = c.get('businessId');
    if (!businessId || businessId <= 0) {
      return c.json({ success: false, error: '无法确定商家身份' }, 400);
    }

    const domainService = getDomainService();
    const domains = await domainService.getBusinessDomains(businessId);

    return c.json({ success: true, data: domains });
  } catch (error) {
    console.error('[DomainRoutes] List domains error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '获取域名列表失败',
    }, 500);
  }
});

// ==========================================
// POST /bind-cf - CF一键绑定自定义域名
// ==========================================

businessDomainRoutes.post('/bind-cf', async (c) => {
  try {
    const businessId = c.get('businessId');
    const userId = c.get('userId');

    if (!businessId || businessId <= 0) {
      return c.json({ success: false, error: '无法确定商家身份' }, 400);
    }

    const body = await c.req.json();
    const { domain, cfApiToken } = body;

    if (!domain) {
      return c.json({ success: false, error: '请输入要绑定的域名' }, 400);
    }
    if (!cfApiToken) {
      return c.json({ success: false, error: '请提供 Cloudflare API Token' }, 400);
    }

    // 基本域名格式验证
    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return c.json({ success: false, error: '域名格式不正确' }, 400);
    }

    const domainService = getDomainService();
    const result = await domainService.bindCFDomain({
      businessId,
      staffUserId: userId || businessId,
      domain: domain.toLowerCase(),
      platform: 'cloudflare',
      cfApiToken,
    });

    if (!result.success) {
      // 翻译 CF 错误码为友好提示
      const errMap: Record<string, string> = {
        'cf_token_invalid': 'Cloudflare API Token 无效，请检查 Token 是否正确',
        'cf_token_expired': 'Cloudflare API Token 已过期或未激活',
        'cf_token_no_permission': 'Cloudflare API Token 权限不足，需要 Zone:DNS:Edit 和 Account:Read 权限',
      };
      const friendlyError = errMap[result.error as string] || result.error;
      return c.json({ success: false, error: friendlyError }, 400);
    }

    return c.json({
      success: true,
      data: {
        id: result.domainId,
        domain: result.domain,
        domainType: 'custom_cf',
        verificationStatus: result.verificationStatus,
        dnsRecord: {
          type: 'CNAME',
          name: domain,
          value: 'zygonlinechat.zygmail.icu',
        },
      },
    });
  } catch (error) {
    console.error('[DomainRoutes] Bind CF domain error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '域名绑定失败',
    }, 500);
  }
});

// ==========================================
// POST /bind-manual - 手动绑定第三方域名
// ==========================================

businessDomainRoutes.post('/bind-manual', async (c) => {
  try {
    const businessId = c.get('businessId');
    const userId = c.get('userId');

    if (!businessId || businessId <= 0) {
      return c.json({ success: false, error: '无法确定商家身份' }, 400);
    }

    const body = await c.req.json();
    const { domain, platform } = body;

    if (!domain) {
      return c.json({ success: false, error: '请输入要绑定的域名' }, 400);
    }

    const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return c.json({ success: false, error: '域名格式不正确' }, 400);
    }

    const domainService = getDomainService();
    const result = await domainService.bindManualDomain({
      businessId,
      staffUserId: userId || businessId,
      domain: domain.toLowerCase(),
      platform: platform || 'other',
    });

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }

    return c.json({
      success: true,
      data: {
        id: result.domainId,
        domain: result.domain,
        domainType: 'custom_external',
        verificationStatus: result.verificationStatus,
        dnsConfigGuide: result.dnsRecord
          ? {
              recordType: result.dnsRecord.type,
              hostRecord: result.dnsRecord.name,
              recordValue: result.dnsRecord.value,
              ttl: 600,
              instruction: '请前往您的DNS管理后台，添加以上CNAME记录，配置完成后点击验证按钮',
            }
          : null,
      },
    });
  } catch (error) {
    console.error('[DomainRoutes] Bind manual domain error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '域名绑定失败',
    }, 500);
  }
});

// ==========================================
// POST /:id/verify - 验证手动绑定的域名DNS
// ==========================================

businessDomainRoutes.post('/:id/verify', async (c) => {
  try {
    const businessId = c.get('businessId');
    const domainId = parseInt(c.req.param('id'), 10);

    if (!businessId || businessId <= 0) {
      return c.json({ success: false, error: '无法确定商家身份' }, 400);
    }
    if (isNaN(domainId)) {
      return c.json({ success: false, error: '无效的域名ID' }, 400);
    }

    const domainService = getDomainService();
    const result = await domainService.verifyManualDomain(domainId);

    return c.json({
      success: true,
      data: {
        verified: result.verified,
        message: result.message,
        status: result.status,
      },
    });
  } catch (error) {
    console.error('[DomainRoutes] Verify domain error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'DNS验证失败',
    }, 500);
  }
});

// ==========================================
// PUT /:id/primary - 设为主域名
// ==========================================

businessDomainRoutes.put('/:id/primary', async (c) => {
  try {
    const businessId = c.get('businessId');
    const domainId = parseInt(c.req.param('id'), 10);

    if (!businessId || businessId <= 0) {
      return c.json({ success: false, error: '无法确定商家身份' }, 400);
    }
    if (isNaN(domainId)) {
      return c.json({ success: false, error: '无效的域名ID' }, 400);
    }

    const domainService = getDomainService();
    const updated = await domainService.setPrimaryDomain(businessId, domainId);

    if (!updated) {
      return c.json({ success: false, error: '域名记录不存在' }, 404);
    }

    return c.json({ success: true, message: '主域名设置成功' });
  } catch (error) {
    console.error('[DomainRoutes] Set primary domain error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '设置失败',
    }, 500);
  }
});

// ==========================================
// DELETE /:id - 删除域名绑定
// ==========================================

businessDomainRoutes.delete('/:id', async (c) => {
  try {
    const businessId = c.get('businessId');
    const domainId = parseInt(c.req.param('id'), 10);

    if (!businessId || businessId <= 0) {
      return c.json({ success: false, error: '无法确定商家身份' }, 400);
    }
    if (isNaN(domainId)) {
      return c.json({ success: false, error: '无效的域名ID' }, 400);
    }

    const domainService = getDomainService();
    const result = await domainService.deleteDomain(businessId, domainId);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }

    return c.json({ success: true, message: '域名已删除' });
  } catch (error) {
    console.error('[DomainRoutes] Delete domain error:', error);
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : '删除失败',
    }, 500);
  }
});

export { businessDomainRoutes };
