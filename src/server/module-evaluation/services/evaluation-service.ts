import { getDb } from '@server/shared/db';

export interface Evaluation {
  id: number;
  session_id: string;
  visitor_name: string | null;
  score: number;
  comment: string | null;
  created_at: number;
}

export interface CreateEvaluationInput {
  session_id: string;
  visitor_name?: string;
  score: number;
  comment?: string;
}

export async function createEvaluation(input: CreateEvaluationInput): Promise<{ success: boolean; error?: string; id?: number }> {
  const db = getDb();
  
  try {
    const existing = await db.get<Evaluation>(
      'SELECT id FROM evaluations WHERE session_id = ?',
      [input.session_id]
    );
    
    if (existing) {
      return { success: false, error: '该会话已评价过' };
    }

    const result = await db.run(
      'INSERT INTO evaluations (session_id, visitor_name, score, comment) VALUES (?, ?, ?, ?)',
      [input.session_id, input.visitor_name || null, input.score, input.comment || null]
    );

    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error('[EvaluationService] Create evaluation error:', error);
    return { success: false, error: '评价失败' };
  }
}

export async function getEvaluationBySession(sessionId: string): Promise<Evaluation | null> {
  const db = getDb();
  return db.get<Evaluation>('SELECT * FROM evaluations WHERE session_id = ?', [sessionId]);
}

export async function listEvaluations(page: number = 1, limit: number = 20): Promise<{ data: Evaluation[]; total: number }> {
  const db = getDb();
  
  const offset = (page - 1) * limit;
  const data = await db.all<Evaluation>(
    'SELECT * FROM evaluations ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [limit, offset]
  );
  
  const totalResult = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM evaluations'
  );
  
  return {
    data,
    total: totalResult?.count || 0,
  };
}

export async function getStatistics(): Promise<{
  total: number;
  avgScore: number;
  scoreDistribution: Record<number, number>;
}> {
  const db = getDb();
  
  const totalResult = await db.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM evaluations'
  );
  
  const avgResult = await db.get<{ avg: number }>(
    'SELECT AVG(score) as avg FROM evaluations'
  );
  
  const distribution = await db.all<{ score: number; count: number }>(
    'SELECT score, COUNT(*) as count FROM evaluations GROUP BY score'
  );
  
  const scoreDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const item of distribution) {
    scoreDistribution[item.score] = item.count;
  }
  
  return {
    total: totalResult?.count || 0,
    avgScore: Math.round((avgResult?.avg || 0) * 100) / 100,
    scoreDistribution,
  };
}