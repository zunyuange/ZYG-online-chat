import { Hono } from 'hono';
import * as evaluationService from '../services/evaluation-service';
import { verifyToken } from '@server/module-auth/services/auth-service';

export const evaluationRoutes = new Hono();

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

evaluationRoutes.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { session_id, visitor_name, score, comment } = body;

    if (!session_id || score === undefined) {
      return c.json({ success: false, error: '会话ID和评分不能为空' }, 400);
    }

    if (score < 1 || score > 5) {
      return c.json({ success: false, error: '评分必须在1-5之间' }, 400);
    }

    const result = await evaluationService.createEvaluation({ session_id, visitor_name, score, comment });
    
    if (result.success) {
      return c.json({ success: true, message: '评价成功' });
    } else {
      return c.json({ success: false, error: result.error }, 400);
    }
  } catch (error) {
    console.error('[Evaluation] Create error:', error);
    return c.json({ success: false, error: '评价失败' }, 500);
  }
});

evaluationRoutes.get('/session/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    
    const evaluation = await evaluationService.getEvaluationBySession(sessionId);
    
    if (evaluation) {
      return c.json({ success: true, data: evaluation });
    } else {
      return c.json({ success: false, error: '暂无评价' }, 404);
    }
  } catch (error) {
    console.error('[Evaluation] Get by session error:', error);
    return c.json({ success: false, error: '获取失败' }, 500);
  }
});

evaluationRoutes.use('/list', requireAuth);

evaluationRoutes.get('/list', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '20', 10);
    
    const result = await evaluationService.listEvaluations(page, limit);
    return c.json({ success: true, data: result.data, total: result.total });
  } catch (error) {
    console.error('[Evaluation] List error:', error);
    return c.json({ success: false, error: '获取列表失败' }, 500);
  }
});

evaluationRoutes.use('/statistics', requireAuth);

evaluationRoutes.get('/statistics', async (c) => {
  try {
    const stats = await evaluationService.getStatistics();
    return c.json({ success: true, data: stats });
  } catch (error) {
    console.error('[Evaluation] Statistics error:', error);
    return c.json({ success: false, error: '获取统计失败' }, 500);
  }
});