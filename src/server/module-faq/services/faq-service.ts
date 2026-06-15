import { getDb } from '@server/shared/db';

export interface FAQ {
  id: number;
  question: string;
  answer: string;
  sort: number;
  status: number;
  lang: string;
  created_at: number;
}

export interface CreateFAQInput {
  question: string;
  answer: string;
  sort?: number;
  lang?: string;
}

export interface UpdateFAQInput {
  question?: string;
  answer?: string;
  sort?: number;
  status?: number;
}

export async function listFAQ(lang: string = 'zh-CN'): Promise<FAQ[]> {
  const db = getDb();
  return db.all<FAQ>(
    'SELECT * FROM faq WHERE status = 1 AND lang = ? ORDER BY sort ASC',
    [lang]
  );
}

export async function createFAQ(input: CreateFAQInput): Promise<{ success: boolean; error?: string; id?: number }> {
  const db = getDb();
  
  try {
    const result = await db.run(
      'INSERT INTO faq (question, answer, sort, lang) VALUES (?, ?, ?, ?)',
      [input.question, input.answer, input.sort || 0, input.lang || 'zh-CN']
    );

    return { success: true, id: result.lastInsertRowid };
  } catch (error) {
    console.error('[FAQService] Create FAQ error:', error);
    return { success: false, error: '创建失败' };
  }
}

export async function getFAQById(id: number): Promise<FAQ | null> {
  const db = getDb();
  return db.get<FAQ>('SELECT * FROM faq WHERE id = ?', [id]);
}

export async function updateFAQ(id: number, input: UpdateFAQInput): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  
  try {
    const updates: string[] = [];
    const params: unknown[] = [];

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

    await db.run(`UPDATE faq SET ${updates.join(', ')} WHERE id = ?`, params);
    return { success: true };
  } catch (error) {
    console.error('[FAQService] Update FAQ error:', error);
    return { success: false, error: '更新失败' };
  }
}

export async function deleteFAQ(id: number): Promise<{ success: boolean; error?: string }> {
  const db = getDb();
  
  try {
    await db.run('DELETE FROM faq WHERE id = ?', [id]);
    return { success: true };
  } catch (error) {
    console.error('[FAQService] Delete FAQ error:', error);
    return { success: false, error: '删除失败' };
  }
}