import { getDb } from '@server/shared/db';

export interface RobotKnowledge {
  id: number;
  keyword: string;
  question: string;
  answer: string;
  sort: number;
  status: number;
  lang: string;
  created_at: number;
}

export interface CreateKnowledgeInput {
  keyword: string;
  question: string;
  answer: string;
  sort?: number;
  lang?: string;
}

export interface UpdateKnowledgeInput {
  keyword?: string;
  question?: string;
  answer?: string;
  sort?: number;
  status?: number;
}

export async function searchKnowledge(query: string, lang: string = 'zh-CN'): Promise<RobotKnowledge | null> {
  const db = getDb();
  
  const keywords = query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(k => k.length >= 2);

  if (keywords.length === 0) {
    return null;
  }

  const results = await db.all<RobotKnowledge>(
    'SELECT * FROM robot_knowledge WHERE status = 1 AND lang = ? ORDER BY sort ASC',
    [lang]
  );

  for (const knowledge of results) {
    const keywordLower = knowledge.keyword.toLowerCase();
    const questionLower = knowledge.question.toLowerCase();
    const queryLower = query.toLowerCase();

    if (
      queryLower.includes(keywordLower) ||
      keywords.some(k => keywordLower.includes(k) || questionLower.includes(k))
    ) {
      return knowledge;
    }
  }

  return null;
}

export async function createKnowledge(input: CreateKnowledgeInput): Promise<{ success: boolean; error?: string; id?: number }> {
  const db = getDb();
  
  try {
    const result = await db.run(
      'INSERT INTO robot_knowledge (keyword, question, answer, sort, lang) VALUES (?, ?, ?, ?, ?)',
      [input.keyword, input.question, input.answer, input.sort || 0, input.lang || 'zh-CN']
    );

    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error('[RobotService] Create knowledge error:', error);
    return { success: false, error: '创建失败' };
  }
}

export async function getKnowledgeById(id: number): Promise<RobotKnowledge | null> {
  const db = getDb();
  return db.get<RobotKnowledge>('SELECT * FROM robot_knowledge WHERE id = ?', [id]);
}

export async function listKnowledge(lang: string = 'zh-CN'): Promise<RobotKnowledge[]> {
  const db = getDb();
  return db.all<RobotKnowledge>(
    'SELECT * FROM robot_knowledge WHERE status = 1 AND lang = ? ORDER BY sort ASC',
    [lang]
  );
}

export async function updateKnowledge(id: number, input: UpdateKnowledgeInput): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  
  try {
    const updates: string[] = [];
    const params: unknown[] = [];

    if (input.keyword !== undefined) {
      updates.push('keyword = ?');
      params.push(input.keyword);
    }
    if (input.question !== undefined) {
      updates.push('question = ?');
      params.push(input.question);
    }
    if (input.answer !== undefined) {
      updates.push('answer = ?');
      params.push(input.answer);
    }
    if (input.sort !== undefined) {
      updates.push('sort = ?');
      params.push(input.sort);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      params.push(input.status);
    }

    if (updates.length === 0) {
      return { success: true };
    }

    params.push(id);

    await db.run(`UPDATE robot_knowledge SET ${updates.join(', ')} WHERE id = ?`, params);
    return { success: true };
  } catch (error) {
    console.error('[RobotService] Update knowledge error:', error);
    return { success: false, error: '更新失败' };
  }
}

export async function deleteKnowledge(id: number): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  
  try {
    await db.run('DELETE FROM robot_knowledge WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('[RobotService] Delete knowledge error:', error);
    return { success: false, error: '删除失败' };
  }
}
