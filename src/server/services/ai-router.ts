/**
 * AI 路由决策层
 * 根据商家配置选择合适的 AI 后端
 *
 * 模式:
 *   - 'platform': 使用平台 Workers AI binding（默认，所有商家共享）
 *   - 'own_cf':   使用商家自己的 Cloudflare Workers AI（REST API 调用）
 */

import { getDb } from '@server/shared/db';
import { decryptToken } from '@server/shared/token-crypto';

export type AIMode = 'platform' | 'own_cf';

export interface TranslateResult {
  translatedText: string;
  engine: string;
}

export interface BusinessAIConfig {
  businessId: number;
  aiMode: AIMode;
  cfAccountId: string | null;
  cfAiTokenEncrypted: string | null;
  monthlyTranslateCount: number;
  monthlyTranslateLimit: number;
  resetDay: number;
}

export class AIRouter {
  private platformAI: any; // Workers AI binding

  constructor(platformAI?: any) {
    this.platformAI = platformAI;
  }

  /**
   * 设置平台 AI binding
   */
  setPlatformAI(ai: any): void {
    this.platformAI = ai;
  }

  /**
   * 翻译文本（自动选择AI后端）
   */
  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    businessId: number
  ): Promise<TranslateResult> {
    // 1. 查询商家AI配置
    const aiConfig = await this.getBusinessAIConfig(businessId);

    // 2. 如果商家使用自有AI
    if (
      aiConfig?.aiMode === 'own_cf' &&
      aiConfig.cfAccountId &&
      aiConfig.cfAiTokenEncrypted
    ) {
      // 检查配额
      if (aiConfig.monthlyTranslateCount >= aiConfig.monthlyTranslateLimit) {
        console.warn(`[AIRouter] Business ${businessId} AI quota exceeded, falling back to platform AI`);
      } else {
        try {
          const apiToken = await decryptToken(aiConfig.cfAiTokenEncrypted);
          const result = await this.callOwnAccountAI(
            aiConfig.cfAccountId,
            apiToken,
            text,
            sourceLang,
            targetLang
          );

          // 更新用量统计
          await this.incrementUsage(businessId);
          return { translatedText: result, engine: 'own_cloudflare' };
        } catch (error) {
          console.warn('[AIRouter] Own account AI failed, falling back to platform AI:', error);
          // 降级到平台AI
        }
      }
    }

    // 3. 使用平台AI（默认）
    return this.callPlatformAI(text, sourceLang, targetLang);
  }

  /**
   * 获取商家AI配置
   */
  async getBusinessAIConfig(businessId: number): Promise<BusinessAIConfig | null> {
    const db = getDb();
    return db.get<{
      business_id: number;
      ai_mode: string;
      cf_account_id: string | null;
      cf_ai_token_encrypted: string | null;
      monthly_translate_count: number;
      monthly_translate_limit: number;
      reset_day: number;
    }>(
      `SELECT business_id, ai_mode, cf_account_id, cf_ai_token_encrypted,
              monthly_translate_count, monthly_translate_limit, reset_day
       FROM business_ai_config
       WHERE business_id = ? AND status = 'active'`,
      [businessId]
    ).then(row => {
      if (!row) return null;
      return {
        businessId: row.business_id,
        aiMode: row.ai_mode as AIMode,
        cfAccountId: row.cf_account_id,
        cfAiTokenEncrypted: row.cf_ai_token_encrypted,
        monthlyTranslateCount: row.monthly_translate_count,
        monthlyTranslateLimit: row.monthly_translate_limit,
        resetDay: row.reset_day,
      };
    });
  }

  /**
   * 更新/创建商家AI配置
   */
  async upsertBusinessAIConfig(
    businessId: number,
    config: {
      aiMode?: AIMode;
      cfAccountId?: string;
      cfAiToken?: string;
      monthlyTranslateLimit?: number;
    }
  ): Promise<void> {
    const db = getDb();

    const existing = await db.get<{ id: number }>(
      'SELECT id FROM business_ai_config WHERE business_id = ?',
      [businessId]
    );

    const now = Math.floor(Date.now() / 1000);

    if (existing) {
      const updates: string[] = [];
      const values: unknown[] = [];

      if (config.aiMode !== undefined) {
        updates.push('ai_mode = ?');
        values.push(config.aiMode);
      }
      if (config.cfAccountId !== undefined) {
        updates.push('cf_account_id = ?');
        values.push(config.cfAccountId);
      }
      if (config.cfAiToken) {
        const encrypted = await import('@server/shared/token-crypto').then(m => m.encryptToken(config.cfAiToken!));
        updates.push('cf_ai_token_encrypted = ?');
        values.push(encrypted);
      }
      if (config.monthlyTranslateLimit !== undefined) {
        updates.push('monthly_translate_limit = ?');
        values.push(config.monthlyTranslateLimit);
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        values.push(now);
        values.push(businessId);
        await db.run(`UPDATE business_ai_config SET ${updates.join(', ')} WHERE business_id = ?`, values);
      }
    } else {
      const encryptedToken = config.cfAiToken ? await import('@server/shared/token-crypto').then(m => m.encryptToken(config.cfAiToken!)) : null;

      await db.run(
        `INSERT INTO business_ai_config
         (business_id, ai_mode, cf_account_id, cf_ai_token_encrypted,
          monthly_translate_limit, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`,
        [
          businessId,
          config.aiMode || 'platform',
          config.cfAccountId || null,
          encryptedToken,
          config.monthlyTranslateLimit || 10000,
          now,
          now,
        ]
      );
    }
  }

  /**
   * 通过 REST API 调用商家自己的 Workers AI
   */
  private async callOwnAccountAI(
    accountId: string,
    apiToken: string,
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/m2m100-1.2b`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          source_lang: sourceLang,
          target_lang: targetLang,
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`CF AI API error [${response.status}]: ${errorBody}`);
    }

    const data = await response.json() as any;
    if (!data.success) {
      throw new Error(`CF AI API error: ${data.errors?.[0]?.message || 'Unknown'}`);
    }

    return data.result?.translated_text || text;
  }

  /**
   * 使用平台 Workers AI binding 翻译
   */
  private async callPlatformAI(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<TranslateResult> {
    if (!this.platformAI) {
      return { translatedText: text, engine: 'none' };
    }

    try {
      const result = await this.platformAI.run('@cf/meta/m2m100-1.2b', {
        text,
        source_lang: sourceLang,
        target_lang: targetLang,
      });
      return {
        translatedText: result.translated_text || text,
        engine: 'platform_cloudflare',
      };
    } catch {
      return { translatedText: text, engine: 'none' };
    }
  }

  /**
   * 更新用量统计
   */
  private async incrementUsage(businessId: number): Promise<void> {
    try {
      const db = getDb();
      const now = Math.floor(Date.now() / 1000);
      await db.run(
        `UPDATE business_ai_config
         SET monthly_translate_count = monthly_translate_count + 1,
             total_translate_count = COALESCE(total_translate_count, 0) + 1,
             updated_at = ?
         WHERE business_id = ?`,
        [now, businessId]
      );
    } catch (error) {
      console.error('[AIRouter] Failed to update usage:', error);
    }
  }
}

// ==========================================
// 单例
// ==========================================

let aiRouterInstance: AIRouter | null = null;

export function initAIRouter(platformAI?: any): AIRouter {
  aiRouterInstance = new AIRouter(platformAI);
  return aiRouterInstance;
}

export function getAIRouter(): AIRouter {
  if (!aiRouterInstance) {
    aiRouterInstance = new AIRouter();
  }
  return aiRouterInstance;
}
