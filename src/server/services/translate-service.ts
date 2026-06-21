/**
 * 免费翻译 API 服务（无需任何 API Key）
 * 
 * 翻译引擎优先级:
 * 1. Google Translate（免费，稳定可靠）
 * 2. MyMemory（免费后备，每天 1000 词）
 * 3. 返回原文（所有引擎均失败时降级）
 */
import { getDb } from '@server/shared/db';

/** 我们的 locale 代码 → ISO 639-1 语言代码 (用于 MyMemory 等免费翻译 API) */
const LOCALE_TO_ISO639: Record<string, string> = {
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'en-US': 'en',
  'en-GB': 'en',
  'ja': 'ja',
  'ko': 'ko',
  'fr': 'fr',
  'de': 'de',
  'es': 'es',
  'pt': 'pt',
  'it': 'it',
  'ru': 'ru',
  'vi': 'vi',
  'th': 'th',
  'id': 'id',
  'ar': 'ar',
  'nl': 'nl',
  'pl': 'pl',
  'da': 'da',
  'fi': 'fi',
  'el': 'el',
  'tc': 'zh-TW',
  'jp': 'ja',
  'kr': 'ko',
  'cn': 'zh-CN',
  'en': 'en',
  'vie': 'vi',
  'ara': 'ar',
  'dan': 'da',
  'fin': 'fi',
  'cht': 'zh-TW',
  'spa': 'es',
  'fra': 'fr',
  'kor': 'ko',
};

/** 我们的 locale 代码 → Google Translate 语言代码（标准 BCP 47） */
const LOCALE_TO_GOOGLE: Record<string, string> = {
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'en-US': 'en',
  'en-GB': 'en',
  'ja': 'ja',
  'jp': 'ja',
  'ko': 'ko',
  'kr': 'ko',
  'fr': 'fr',
  'de': 'de',
  'es': 'es',
  'pt': 'pt',
  'it': 'it',
  'ru': 'ru',
  'vi': 'vi',
  'th': 'th',
  'id': 'id',
  'ar': 'ar',
  'nl': 'nl',
  'pl': 'pl',
  'da': 'da',
  'fi': 'fi',
  'el': 'el',
  'tc': 'zh-TW',
  'cn': 'zh-CN',
  'en': 'en',
  'vie': 'vi',
  'ara': 'ar',
  'dan': 'da',
  'fin': 'fi',
  'cht': 'zh-TW',
  'spa': 'es',
  'fra': 'fr',
  'kor': 'ko',
};

export interface TranslateOptions {
  text: string;
  to: string; // 目标语言（我们的 locale 代码）
  businessId?: number;
  businessSlug?: string;
}

/** 翻译结果详情 */
export interface TranslateResult {
  /** 翻译后的文本（失败时返回原文） */
  text: string;
  /** 成功的翻译引擎名称（如 'google' | 'mymemory'）；失败时为空字符串 */
  engine: string;
  /** 翻译是否成功（结果与原文不同） */
  success: boolean;
}

/**
 * 判断文本是否包含 HTML 标签（图片/视频/链接等，不需要翻译）
 */
function containsHtml(text: string): boolean {
  return /<(img|a|video|p|div|br|hr|source)\b/i.test(text);
}

/**
 * 获取 ISO 639-1 语言代码（用于 MyMemory 等免费 API）
 */
function toIso639Lang(localeCode: string): string {
  return LOCALE_TO_ISO639[localeCode] || localeCode;
}

/**
 * 获取 Google Translate 语言代码
 */
function toGoogleLang(localeCode: string): string {
  return LOCALE_TO_GOOGLE[localeCode] || localeCode;
}

/**
 * 简单的语言检测：根据文本字符特征判断源语言
 * 用于 MyMemory API（不支持 'auto' 源语言）
 */
export function detectSourceLanguage(text: string): string {
  // 统计各类字符
  let cjkCount = 0;
  let asciiCount = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if ((code >= 0x4E00 && code <= 0x9FFF) ||  // CJK 统一表意文字
        (code >= 0x3040 && code <= 0x309F) ||  // 平假名
        (code >= 0x30A0 && code <= 0x30FF) ||  // 片假名
        (code >= 0xAC00 && code <= 0xD7AF)) {   // 韩文
      cjkCount++;
    } else if (code < 128) {
      asciiCount++;
    }
  }
  // 如果 CJK 字符占比高，判断为中文；否则默认英文
  if (cjkCount > asciiCount && cjkCount > 0) {
    return 'zh-CN';
  }
  return 'en';
}

/**
 * 调用 Google Translate API（非官方免费接口，无需 API Key）
 * Cloudflare Worker 上非常稳定可靠
 */
async function callGoogleTranslate(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  const src = sourceLang === 'auto' ? '' : sourceLang;
  const encoded = encodeURIComponent(text);
  // Google 非官方接口: client=gtx 无需密钥
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src || 'auto'}&tl=${targetLang}&dt=t&q=${encoded}`;
  
  console.log(`[TranslateService-Google] Calling: ${src || 'auto'}→${targetLang}, textLen=${text.length}`);
  
  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时
    response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CloudflareWorker/1.0)',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (fetchError: any) {
    console.error('[TranslateService-Google] ❌ Network error:', fetchError?.name || 'Unknown', fetchError?.message || '');
    return text; // 返回原文，让上层调用者尝试其他方案
  }

  if (!response.ok) {
    console.error(`[TranslateService-Google] ❌ HTTP error: ${response.status}`);
    return text;
  }

  try {
    const result: any = await response.json();
    // Google 返回格式: [[["translated text","original",null,null,1]],null,"en"]
    if (Array.isArray(result) && result[0] && Array.isArray(result[0])) {
      const translated = result[0]
        .filter((item: any) => Array.isArray(item) && item[0])
        .map((item: any[]) => item[0])
        .join('');
      if (translated && translated.trim() !== text.trim()) {
        console.log(`[TranslateService-Google] ✅ Result: "${translated.substring(0, 50)}..."`);
        return translated;
      }
    }
    console.warn('[TranslateService-Google] ⚠️ Unexpected response:', JSON.stringify(result).substring(0, 200));
  } catch (parseError) {
    console.error('[TranslateService-Google] ❌ JSON parse error:', parseError);
  }
  return text; // 返回原文，让上层回退到下一个引擎
}

/**
 * 调用 MyMemory 免费翻译 API（无 API Key 限制，每天 1000 词免费）
 * 文档: https://mymemory.translated.net/doc/spec.php
 */
async function callMyMemoryTranslate(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  // MyMemory 不支持 'auto'，自动检测源语言
  if (sourceLang === 'auto') {
    sourceLang = detectSourceLanguage(text);
    console.log(`[TranslateService-MyMemory] Auto-detected source language: ${sourceLang}`);
  }

  // 源语言和目标语言相同则跳过
  if (sourceLang === targetLang || sourceLang === targetLang.split('-')[0]) {
    console.log('[TranslateService-MyMemory] Source and target language match, skipping');
    return text;
  }
  
  const langpair = `${sourceLang}|${targetLang}`;
  const params = new URLSearchParams({
    q: text,
    langpair,
    de: 'zyg-online-chat@example.com', // 用于免费 API 请求去重
  });

  const url = `https://api.mymemory.translated.net/get?${params.toString()}`;
  
  console.log(`[TranslateService-MyMemory] Calling: langpair=${langpair}, textLen=${text.length}`);
  
  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时
    response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (fetchError: any) {
    console.error('[TranslateService-MyMemory] ❌ Network error:', fetchError?.name || 'Unknown', fetchError?.message || '');
    return text;
  }

  if (!response.ok) {
    console.error(`[TranslateService-MyMemory] ❌ HTTP error: ${response.status}`);
    return text;
  }

  const result: any = await response.json();
  
  if (result.responseStatus && result.responseStatus !== 200) {
    console.error('[TranslateService-MyMemory] ❌ API error:', result.responseStatus, result.responseDetails);
    return text;
  }

  if (result.responseData && result.responseData.translatedText) {
    const translated = result.responseData.translatedText;
    console.log(`[TranslateService-MyMemory] ✅ Translation result: "${translated.substring(0, 50)}..."`);
    return translated;
  }

  console.warn('[TranslateService-MyMemory] ⚠️ Unexpected response:', JSON.stringify(result).substring(0, 200));
  return text;
}

/**
 * 翻译设置返回值（纯免费引擎，无需任何 API Key）
 */
export interface TranslationSettings {
  enabled: boolean;
  defaultLang: string;
}

/**
 * 获取商家的翻译设置
 * 支持多层级：下级客服继承上级商家的启用状态
 */
export async function getTranslationSettings(businessId?: number, businessSlug?: string): Promise<TranslationSettings | null> {
  const db = getDb();
  
  let settings;
  if (businessId !== undefined && businessId > 0) {
    // 商家/客服：按 staff_users.id 查询
    settings = await db.get<{
      enable_auto_trans: number;
      default_lang: string;
      business_id: number;
    }>(
      'SELECT enable_auto_trans, default_lang, business_id FROM staff_users WHERE id = ?',
      [businessId]
    );
  } else if (businessSlug) {
    // 超管(businessId=0)或无 businessId：按 business_slug 查询
    settings = await db.get<{
      enable_auto_trans: number;
      default_lang: string;
      business_id: number;
    }>(
      'SELECT enable_auto_trans, default_lang, business_id FROM staff_users WHERE business_slug = ? AND business_id = 0',
      [businessSlug]
    );
  } else {
    // businessId=0 且没有 businessSlug：尝试用 businessId=0 的 admin 账号
    settings = await db.get<{
      enable_auto_trans: number;
      default_lang: string;
      business_id: number;
    }>(
      'SELECT enable_auto_trans, default_lang, business_id FROM staff_users WHERE id = ?',
      [businessId]
    );
  }
  
  console.log('[TranslateService] getTranslationSettings: businessId=', businessId, 'businessSlug=', businessSlug,
    'found:', !!settings, '| raw enabled:', settings?.enable_auto_trans);

  if (!settings) return null;

  let enabled = settings.enable_auto_trans === 1;

  // 下级客服（business_id > 0）：从上级商家继承启用状态
  if (settings.business_id > 0 && !enabled) {
    const parent = await db.get<{ enable_auto_trans: number }>(
      'SELECT enable_auto_trans FROM staff_users WHERE id = ?',
      [settings.business_id]
    );
    if (parent?.enable_auto_trans === 1) {
      enabled = true;
      console.log('[TranslateService] Parent inheritance for staff', businessId,
        '| parent enabled:', true, '| final enabled:', true);
    }
  }

  return {
    enabled,
    defaultLang: settings.default_lang,
  };
}

/**
 * 翻译文本选项
 */
interface TranslateOptionsInternal extends TranslateOptions {
  /** 预取的翻译设置，避免 translateText 内部重复查询数据库 */
  _settings?: TranslationSettings | null;
}

/**
 * 自动翻译文本
 * 
 * 优先级链（纯免费，无需任何 API 密钥）:
 * 1. Google Translate（免费稳定，CF Worker 上非常可靠）
 * 2. MyMemory 免费翻译（后备，每天 1000 词免费）
 * 3. 返回原文（所有方案都不可用时降级）
 *
 * 【重要】如果返回原文（翻译未生效），查看服务端日志了解具体跳过的原因：
 *   - "Translation not configured" → 商家未配置翻译设置
 *   - "Translation disabled" → enable_auto_trans = 0
 *   - "Translation failed" → API 调用异常
 */
export async function translateText(options: TranslateOptions): Promise<TranslateResult> {
  const { text, to } = options;
  const opts = options as TranslateOptionsInternal;

  const makeResult = (engine: string): TranslateResult => ({
    text,
    engine,
    success: false,
  });

  // 如果文本包含 HTML 标签，不翻译
  if (containsHtml(text)) {
    console.log('[TranslateService] Skipped: text contains HTML');
    return makeResult('');
  }

  // 如果文本为空，不翻译
  if (!text || !text.trim()) {
    console.log('[TranslateService] Skipped: empty text');
    return makeResult('');
  }

  // 获取翻译设置（优先使用预取的，避免重复查询）
  const settings = opts._settings ?? (await getTranslationSettings(options.businessId, options.businessSlug));

  if (!settings) {
    console.warn('[TranslateService] ⚠️ Translation skipped: No settings found for businessId:', options.businessId,
      '| businessSlug:', options.businessSlug);
    return makeResult('');
  }

  if (!settings.enabled) {
    console.warn('[TranslateService] ⚠️ Translation skipped: enable_auto_trans is OFF',
      '| businessId:', options.businessId,
      '| defaultLang:', settings.defaultLang);
    return makeResult('');
  }

  // 【🧠 智能选择翻译提供商 - 优先级链】
  // 1. Google Translate（免费稳定）→ 2. MyMemory（免费后备）→ 3. 返回原文
  const targetGoogle = toGoogleLang(to);
  const targetIso = toIso639Lang(to);
  
  // 🔴 Google Translate（非官方免费接口，CF Worker 上非常稳定）
  console.log(`[TranslateService] 🔴 Using Google Translate: "${text.substring(0, 50)}..." → ${targetGoogle}`);
  try {
    const translated = await callGoogleTranslate(text, targetGoogle, 'auto');
    if (translated !== text) {
      console.log(`[TranslateService] ✅ Google result: "${translated.substring(0, 50)}..."`);
      return { text: translated, engine: 'google', success: true };
    }
    console.log('[TranslateService] ⚡ Google returned same text, falling back to MyMemory...');
  } catch (error) {
    console.error('[TranslateService] ❌ Google failed, falling back to MyMemory:', error);
  }
  
  // 🟢 MyMemory 免费后备
  console.log(`[TranslateService] 🟢 Using MyMemory (last resort): "${text.substring(0, 50)}..." → ${targetIso}`);
  
  try {
    const translated = await callMyMemoryTranslate(text, targetIso, 'auto');
    if (translated !== text) {
      console.log(`[TranslateService] ✅ MyMemory result: "${translated.substring(0, 50)}..."`);
      return { text: translated, engine: 'mymemory', success: true };
    }
    console.log('[TranslateService] ⚡ MyMemory returned same text - ALL engines failed');
  } catch (error) {
    console.error('[TranslateService] ❌ ALL translation engines failed:', error);
  }
  
  // 所有引擎都失败：记录详细信息以便诊断
  console.error('[TranslateService] 🚫 TRANSLATION FAILURE SUMMARY:',
    '| businessId:', options.businessId,
    '| to:', to,
    '| textLen:', text.length,
    '| text:', text.substring(0, 60));
  return makeResult('');
}

/**
 * 判断是否需要翻译（文本不是目标语言或翻译后不同）
 */
export function isTranslationUseful(original: string, translated: string): boolean {
  return original.trim() !== translated.trim();
}
