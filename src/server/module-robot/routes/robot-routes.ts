import { Hono } from 'hono';
import * as robotService from '../services/robot-service';
import { verifyToken } from '@server/module-auth/services/auth-service';

export const robotRoutes = new Hono();

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

robotRoutes.get('/search', async (c) => {
  try {
    const query = c.req.query('q');
    const lang = c.req.query('lang') || 'zh-CN';

    if (!query) {
      return c.json({ success: false, error: '请输入查询内容' }, 400);
    }

    const result = await robotService.searchKnowledge(query, lang);
    
    if (result) {
      return c.json({
        success: true,
        data: {
          answer: result.answer,
          question: result.question,
        },
      });
    } else {
      return c.json({ success: false, error: '未找到匹配的答案' }, 404);
    }
  } catch (error) {
    console.error('[Robot] Search error:', error);
    return c.json({ success: false, error: '搜索失败' }, 500);
  }
});

robotRoutes.use('/knowledge', requireAuth);

robotRoutes.post('/knowledge', async (c) => {
  try {
    const body = await c.req.json();
    const { keyword, question, answer, sort, lang } = body;

    if (!keyword || !question || !answer) {
      return c.json({ success: false, error: '关键词、问题和答案不能为空' }, 400);
    }

    const result = await robotService.createKnowledge({ keyword, question, answer, sort, lang });
    
    if (result.success) {
      return c.json({ success: true, message: '创建成功', id: result.id }, 201);
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[Robot] Create knowledge error:', error);
    return c.json({ success: false, error: '创建失败' }, 500);
  }
});

robotRoutes.get('/knowledge', async (c) => {
  try {
    const lang = c.req.query('lang') || 'zh-CN';
    const knowledge = await robotService.listKnowledge(lang);
    return c.json({ success: true, data: knowledge });
  } catch (error) {
    console.error('[Robot] List knowledge error:', error);
    return c.json({ success: false, error: '获取列表失败' }, 500);
  }
});

robotRoutes.get('/knowledge/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的ID' }, 400);
    }

    const knowledge = await robotService.getKnowledgeById(id);
    if (!knowledge) {
      return c.json({ success: false, error: '不存在' }, 404);
    }

    return c.json({ success: true, data: knowledge });
  } catch (error) {
    console.error('[Robot] Get knowledge error:', error);
    return c.json({ success: false, error: '获取失败' }, 500);
  }
});

robotRoutes.put('/knowledge/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的ID' }, 400);
    }

    const body = await c.req.json();
    const result = await robotService.updateKnowledge(id, body);
    
    if (result.success) {
      return c.json({ success: true, message: '更新成功' });
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[Robot] Update knowledge error:', error);
    return c.json({ success: false, error: '更新失败' }, 500);
  }
});

robotRoutes.delete('/knowledge/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'), 10);
    if (isNaN(id)) {
      return c.json({ success: false, error: '无效的ID' }, 400);
    }

    const result = await robotService.deleteKnowledge(id);
    
    if (result.success) {
      return c.json({ success: true, message: '删除成功' });
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[Robot] Delete knowledge error:', error);
    return c.json({ success: false, error: '删除失败' }, 500);
  }
});