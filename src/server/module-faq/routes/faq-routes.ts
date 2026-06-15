import { Hono } from 'hono';
import * as faqService from '../services/faq-service';
import { verifyToken } from '@server/module-auth/services/auth-service';

export const faqRoutes = new Hono();

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

  await next();
}

faqRoutes.get('/', async (c) => {
  try {
    const lang = c.req.query('lang') || 'zh-CN';
    const faqs = await faqService.listFAQ(lang);
    return c.json({ success: true, data: faqs });
  } catch (error) {
    console.error('[FAQ] List error:', error);
    return c.json({ success: false, error: '获取列表失败' }, 500);
  }
});

faqRoutes.use('/', requireAuth);

faqRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { question, answer, sort, lang } = body;

    if (!question || !answer) {
      return c.json({ success: false, error: '问题和答案不能为空' }, 400);
    }

    const result = await faqService.createFAQ({ question, answer, sort, lang });
    
    if (result.success) {
      return c.json({ success: true, message: '创建成功', id: result.id }, 201);
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[FAQ] Create error:', error);
    return c.json({ success: false, error: '创建失败' }, 500);
  }
});

faqRoutes.get('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的ID' }, 400);
    }

    const faq = await faqService.getFAQById(id);
    if (!faq) {
      return c.json({ success: false, error: '不存在' }, 404);
    }

    return c.json({ success: true, data: faq });
  } catch (error) {
    console.error('[FAQ] Get error:', error);
    return c.json({ success: false, error: '获取失败' }, 500);
  }
});

faqRoutes.put('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的ID' }, 400);
    }

    const body = await c.req.json();
    const result = await faqService.updateFAQ(id, body);
    
    if (result.success) {
      return c.json({ success: true, message: '更新成功' });
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[FAQ] Update error:', error);
    return c.json({ success: false, error: '更新失败' }, 500);
  }
});

faqRoutes.delete('/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的ID' }, 400);
    }

    const result = await faqService.deleteFAQ(id);
    
    if (result.success) {
      return c.json({ success: true, message: '删除成功' });
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[FAQ] Delete error:', error);
    return c.json({ success: false, error: '删除失败' }, 500);
  }
});