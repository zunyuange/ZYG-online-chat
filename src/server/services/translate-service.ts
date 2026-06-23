/**
 * 免费翻译 API 服务（无需任何 API Key）
 * 
 * 翻译引擎优先级:
 * 1. SimplyTranslate AI（首选推荐，免费 RESTful，196+ 语言，100次/分钟）
 * 2. Google Translate（免费稳定，CF Worker 上可靠）
 * 3. MyMemory（免费后备，每天 1000~10000 词）
 * 4. PearApi 万能翻译（免费，自动检测语言，支持13种翻译方向）
 * 5. PearApi AI万能翻译（免费，基于大模型，自定义源语言和目标语言）
 * 6. 返回原文（所有引擎均失败时降级）
 */
import { getDb } from '@server/shared/db';

/** 我们的 locale 代码 → ISO 639-1 语言代码 (用于 MyMemory API) */
const LOCALE_TO_ISO639: Record<string, string> = {
  'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW',
  'en-US': 'en', 'en-GB': 'en',
  'ja': 'ja', 'ko': 'ko',
  'fr': 'fr', 'de': 'de', 'es': 'es',
  'pt': 'pt', 'it': 'it', 'ru': 'ru',
  'vi': 'vi', 'th': 'th', 'id': 'id',
  'ar': 'ar', 'nl': 'nl', 'pl': 'pl',
  'da': 'da', 'fi': 'fi', 'el': 'el',
  'tc': 'zh-TW', 'jp': 'ja', 'kr': 'ko',
  'cn': 'zh-CN', 'en': 'en',
  'vie': 'vi', 'ara': 'ar',
  'dan': 'da', 'fin': 'fi',
  'cht': 'zh-TW', 'spa': 'es',
  'fra': 'fr', 'kor': 'ko',
};

/** 我们的 locale 代码 → Google Translate 语言代码（标准 BCP 47） */
const LOCALE_TO_GOOGLE: Record<string, string> = {
  'zh-CN': 'zh-CN', 'zh-TW': 'zh-TW',
  'en-US': 'en', 'en-GB': 'en',
  'ja': 'ja', 'jp': 'ja',
  'ko': 'ko', 'kr': 'ko',
  'fr': 'fr', 'de': 'de', 'es': 'es',
  'pt': 'pt', 'it': 'it', 'ru': 'ru',
  'vi': 'vi', 'th': 'th', 'id': 'id',
  'ar': 'ar', 'nl': 'nl', 'pl': 'pl',
  'da': 'da', 'fi': 'fi', 'el': 'el',
  'tc': 'zh-TW', 'cn': 'zh-CN',
  'en': 'en', 'vie': 'vi',
  'ara': 'ar', 'dan': 'da',
  'fin': 'fi', 'cht': 'zh-TW',
  'spa': 'es', 'fra': 'fr', 'kor': 'ko',
};

/** 我们的 locale 代码 → SimplyTranslate AI 语言代码（小写 BCP 47） */
const LOCALE_TO_SIMPLY: Record<string, string> = {
  'zh-CN': 'zh-cn', 'zh-TW': 'zh-tw',
  'en-US': 'en', 'en-GB': 'en',
  'ja': 'ja', 'jp': 'ja',
  'ko': 'ko', 'kr': 'ko',
  'fr': 'fr', 'de': 'de', 'es': 'es',
  'pt': 'pt', 'it': 'it', 'ru': 'ru',
  'vi': 'vi', 'th': 'th', 'id': 'id',
  'ar': 'ar', 'nl': 'nl', 'pl': 'pl',
  'da': 'da', 'fi': 'fi', 'el': 'el',
  'tc': 'zh-tw', 'cn': 'zh-cn',
  'en': 'en', 'vie': 'vi',
  'ara': 'ar', 'dan': 'da',
  'fin': 'fi', 'cht': 'zh-tw',
  'spa': 'es', 'fra': 'fr', 'kor': 'ko',
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
  /** 成功的翻译引擎名称（如 'simplytranslate' | 'google' | 'mymemory'）；失败时为空字符串 */
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
 * 获取 SimplyTranslate AI 语言代码（小写 BCP 47）
 */
function toSimplyLang(localeCode: string): string {
  return LOCALE_TO_SIMPLY[localeCode] || localeCode.toLowerCase();
}

/**
 * 详细的文本语言检测：区分中文、日文、韩文、英文等
 * 用于决定是否需要跳过翻译（目标语言相同时节省 API 配额）
 */
export function detectSourceLanguage(text: string): string {
  let chineseCount = 0;   // CJK 统一表意文字（中文+日文汉字）
  let hiraganaCount = 0;  // 平假名（日语特有）
  let katakanaCount = 0;  // 片假名（日语特有）
  let koreanCount = 0;    // 韩文谚文
  let asciiCount = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x4E00 && code <= 0x9FFF) {
      chineseCount++;
    } else if (code >= 0x3040 && code <= 0x309F) {
      hiraganaCount++;
    } else if (code >= 0x30A0 && code <= 0x30FF) {
      katakanaCount++;
    } else if (code >= 0xAC00 && code <= 0xD7AF) {
      koreanCount++;
    } else if (code < 128) {
      asciiCount++;
    }
  }
  const total = chineseCount + hiraganaCount + katakanaCount + koreanCount + asciiCount;
  if (total === 0) return 'unknown';
  
  // 韩文：谚文字符占主导
  if (koreanCount > 0 && koreanCount >= total * 0.5) return 'ko';
  // 日语：假名占主导
  if ((hiraganaCount + katakanaCount) > 0 && (hiraganaCount + katakanaCount) >= total * 0.5) return 'ja';
  // 中文：CJK 汉字占主导
  if (chineseCount > asciiCount && chineseCount > 0) return 'zh-CN';
  // 英文/拉丁语系
  return 'en';
}

/**
 * 快速判断文本是否已经（很可能）是目标语言，无需翻译
 * 两个用途：
 * 1. 访客输入中文 → 客服也是中文 → 跳过翻译（节省配额）
 * 2. 访客输入韩文 → 客服是中文 → 仍需翻译（继续走引擎链）
 */
export function isLikelyAlreadyInTargetLang(text: string, targetLang: string): boolean {
  const targetBase = (targetLang || '').split('-')[0].toLowerCase();
  if (!targetBase) return false;
  
  const detected = detectSourceLanguage(text);
  // detected 可能是 'zh-CN', 'en', 'ko', 'ja', 'unknown'
  const detectedBase = (detected || 'unknown').split('-')[0].toLowerCase();
  
  if (detectedBase === targetBase) {
    console.log(`[TranslateService] 🔍 Text likely already in target language: detected=${detected}, target=${targetLang}`);
    return true;
  }
  return false;
}

// ==========================================
// 🔴 SimplyTranslate AI - 首选推荐
// 免注册、免费 RESTful 翻译接口，支持 196+ 语言
// 匿名频率限制: 100次/分钟（按 IP），每请求最高 5,000 字符
// ==========================================
async function callSimplyTranslate(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  // SimplyTranslate 使用 'auto' 作为源语言
  const from = sourceLang === 'auto' ? 'auto' : sourceLang;

  console.log(`[TranslateService-Simply] Calling: ${from}→${targetLang}, textLen=${text.length}`);

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    response = await fetch('https://api.simplytranslate.ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from, to: targetLang }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (fetchError: any) {
    console.error('[TranslateService-Simply] ❌ Network error:', fetchError?.name || 'Unknown', fetchError?.message || '');
    return text;
  }

  if (!response.ok) {
    console.error(`[TranslateService-Simply] ❌ HTTP error: ${response.status}`);
    return text;
  }

  try {
    const result: any = await response.json();
    if (result.result && typeof result.result === 'string') {
      const translated = result.result.trim();
      if (translated !== text.trim()) {
        console.log(`[TranslateService-Simply] ✅ Result: "${translated.substring(0, 50)}..."`);
        return translated;
      }
      console.warn('[TranslateService-Simply] ⚠️ Returned same text');
    } else {
      console.warn('[TranslateService-Simply] ⚠️ Unexpected response:', JSON.stringify(result).substring(0, 200));
    }
  } catch (parseError) {
    console.error('[TranslateService-Simply] ❌ JSON parse error:', parseError);
  }
  return text;
}

// ==========================================
// 🟡 Google Translate - 备选方案
// ==========================================
async function callGoogleTranslate(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  const src = sourceLang === 'auto' ? '' : sourceLang;
  const encoded = encodeURIComponent(text);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src || 'auto'}&tl=${targetLang}&dt=t&q=${encoded}`;

  console.log(`[TranslateService-Google] Calling: ${src || 'auto'}→${targetLang}, textLen=${text.length}`);

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CloudflareWorker/1.0)',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (fetchError: any) {
    console.error('[TranslateService-Google] ❌ Network error:', fetchError?.name || 'Unknown', fetchError?.message || '');
    return text;
  }

  if (!response.ok) {
    console.error(`[TranslateService-Google] ❌ HTTP error: ${response.status}`);
    return text;
  }

  try {
    const result: any = await response.json();
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
  return text;
}

// ==========================================
// 🟢 MyMemory - 最后后备
// ==========================================
async function callMyMemoryTranslate(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  if (sourceLang === 'auto') {
    sourceLang = detectSourceLanguage(text);
    console.log(`[TranslateService-MyMemory] Auto-detected source language: ${sourceLang}`);
  }

  if (sourceLang === targetLang || sourceLang === targetLang.split('-')[0]) {
    console.log('[TranslateService-MyMemory] Source and target language match, skipping');
    return text;
  }

  const langpair = `${sourceLang}|${targetLang}`;
  const params = new URLSearchParams({
    q: text,
    langpair,
    de: 'zyg-online-chat@example.com',
  });

  const url = `https://api.mymemory.translated.net/get?${params.toString()}`;

  console.log(`[TranslateService-MyMemory] Calling: langpair=${langpair}, textLen=${text.length}`);

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
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
    console.log(`[TranslateService-MyMemory] ✅ Result: "${translated.substring(0, 50)}..."`);
    return translated;
  }

  console.warn('[TranslateService-MyMemory] ⚠️ Unexpected response:', JSON.stringify(result).substring(0, 200));
  return text;
}

// ==========================================
// 🟣 PearApi 万能翻译 - 第4级
// 免费，自动识别输入语言并进行翻译
// ==========================================

/** 将语言方向短语映射到 PearApi type 参数值 */
function toPearApiType(sourceLang: string, targetLang: string): string {
  const from = (sourceLang || 'auto').split('-')[0].toLowerCase();
  const to = (targetLang || 'en').split('-')[0].toLowerCase();
  
  const map: Record<string, Record<string, string>> = {
    'zh': { 'en': 'ZH_CN2EN', 'ja': 'ZH_CN2JA', 'ko': 'ZH_CN2KR', 'fr': 'ZH_CN2FR', 'ru': 'ZH_CN2RU', 'es': 'ZH_CN2SP' },
    'en': { 'zh': 'EN2ZH_CN' },
    'ja': { 'zh': 'JA2ZH_CN' },
    'ko': { 'zh': 'KR2ZH_CN' },
    'fr': { 'zh': 'FR2ZH_CN' },
    'ru': { 'zh': 'RU2ZH_CN' },
    'es': { 'zh': 'SP2ZH_CN' },
  };
  
  if (map[from]?.[to]) return map[from][to];
  return 'AUTO'; // fallback to auto-detect
}

async function callPearApiTranslate(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  const type = sourceLang === 'auto' ? 'AUTO' : toPearApiType(sourceLang, targetLang);
  const url = `https://api.pearapi.ai/api/translate/?text=${encodeURIComponent(text)}&type=${type}`;

  console.log(`[TranslateService-PearApi] Calling: type=${type}, textLen=${text.length}`);

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (fetchError: any) {
    console.error('[TranslateService-PearApi] ❌ Network error:', fetchError?.name || 'Unknown', fetchError?.message || '');
    return text;
  }

  if (!response.ok) {
    console.error(`[TranslateService-PearApi] ❌ HTTP error: ${response.status}`);
    return text;
  }

  try {
    const result: any = await response.json();
    // PearApi 万能翻译: code 是字符串 "200"
    if (String(result.code) === '200' && result.data?.translate) {
      const translated = result.data.translate;
      if (translated && translated.trim() !== text.trim()) {
        console.log(`[TranslateService-PearApi] ✅ Result: "${translated.substring(0, 50)}..."`);
        return translated;
      }
    }
    console.warn('[TranslateService-PearApi] ⚠️ Unexpected response:', JSON.stringify(result).substring(0, 200));
  } catch (parseError) {
    console.error('[TranslateService-PearApi] ❌ JSON parse error:', parseError);
  }
  return text;
}

// ==========================================
// 🟠 PearApi AI万能翻译 - 第5级
// 免费，基于大模型的智能翻译
// ==========================================
async function callPearApiAITranslate(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  const sl = sourceLang === 'auto' ? '' : sourceLang.split('-')[0].toLowerCase();
  const tl = targetLang.split('-')[0].toLowerCase();
  
  let url = `https://api.pearapi.ai/api/translate/ai/?text=${encodeURIComponent(text)}&target_lang=${tl}`;
  if (sl) url += `&source_lang=${sl}`;

  console.log(`[TranslateService-PearApiAI] Calling: ${sl || 'auto'}→${tl}, textLen=${text.length}`);

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (fetchError: any) {
    console.error('[TranslateService-PearApiAI] ❌ Network error:', fetchError?.name || 'Unknown', fetchError?.message || '');
    return text;
  }

  if (!response.ok) {
    console.error(`[TranslateService-PearApiAI] ❌ HTTP error: ${response.status}`);
    return text;
  }

  try {
    const result: any = await response.json();
    // PearApi AI: code 是整数 200
    if (result.code === 200 && result.data) {
      const translated = typeof result.data === 'string' ? result.data : (result.data.translate || '');
      if (translated && translated.trim() !== text.trim()) {
        console.log(`[TranslateService-PearApiAI] ✅ Result: "${translated.substring(0, 50)}..."`);
        return translated;
      }
    }
    console.warn('[TranslateService-PearApiAI] ⚠️ Unexpected response:', JSON.stringify(result).substring(0, 200));
  } catch (parseError) {
    console.error('[TranslateService-PearApiAI] ❌ JSON parse error:', parseError);
  }
  return text;
}

/** 所有支持的翻译引擎列表（用于前端下拉菜单） */
export const ALL_TRANSLATE_ENGINES = [
  { key: 'simplytranslate', label: 'SimplyTranslate AI' },
  { key: 'google', label: 'Google Translate' },
  { key: 'mymemory', label: 'MyMemory' },
  { key: 'pearapi', label: 'PearApi 万能翻译' },
  { key: 'pearapi_ai', label: 'PearApi AI万能翻译' },
] as const;

export type TranslateEngineKey = typeof ALL_TRANSLATE_ENGINES[number]['key'];

/**
 * 使用指定翻译引擎进行单次翻译（用于客服手动切换引擎重新翻译）
 */
export async function translateWithEngine(
  text: string,
  to: string,
  engine: TranslateEngineKey
): Promise<TranslateResult> {
  const makeResult = (e: string): TranslateResult => ({ text, engine: e, success: false });
  if (!text?.trim()) return makeResult('');
  
  const targetSimply = toSimplyLang(to);
  const targetGoogle = toGoogleLang(to);
  const targetIso = toIso639Lang(to);
  
  console.log(`[TranslateService] 🎯 Specific engine request: ${engine} | "${text.substring(0, 50)}..."`);

  try {
    let translated: string;
    switch (engine) {
      case 'simplytranslate':
        translated = await callSimplyTranslate(text, targetSimply, 'auto');
        break;
      case 'google':
        translated = await callGoogleTranslate(text, targetGoogle, 'auto');
        break;
      case 'mymemory':
        translated = await callMyMemoryTranslate(text, targetIso, 'auto');
        break;
      case 'pearapi':
        translated = await callPearApiTranslate(text, targetIso, 'auto');
        break;
      case 'pearapi_ai':
        translated = await callPearApiAITranslate(text, targetIso, 'auto');
        break;
      default:
        return makeResult('');
    }
    
    if (translated !== text && translated.trim() !== text.trim()) {
      console.log(`[TranslateService] ✅ ${engine} success: "${translated.substring(0, 50)}..."`);
      return { text: translated, engine, success: true };
    }
    console.log(`[TranslateService] ⚡ ${engine} returned same text`);
    return makeResult(engine);
  } catch (error) {
    console.error(`[TranslateService] ❌ ${engine} exception:`, error);
    return makeResult(engine);
  }
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
  
  // 系统管理员 (businessId = 0) 或未指定商家时，使用默认商家设置
  if (businessId === 0 || (businessId === undefined && !businessSlug)) {
    settings = await db.get<{
      enable_auto_trans: number;
      default_lang: string;
      business_id: number;
    }>(
      'SELECT enable_auto_trans, default_lang, business_id FROM staff_users WHERE business_slug = ? AND business_id = 0',
      ['default']
    );
  } else if (businessId !== undefined && businessId > 0) {
    // 先尝试按 id 查询（可能是客服账号或商家主账号）
    settings = await db.get<{
      enable_auto_trans: number;
      default_lang: string;
      business_id: number;
    }>(
      'SELECT enable_auto_trans, default_lang, business_id FROM staff_users WHERE id = ?',
      [businessId]
    );
    // 如果没找到，尝试按 business_id 查询商家主账号
    if (!settings) {
      settings = await db.get<{
        enable_auto_trans: number;
        default_lang: string;
        business_id: number;
      }>(
        'SELECT enable_auto_trans, default_lang, business_id FROM staff_users WHERE id = ? AND business_id = 0',
        [businessId]
      );
    }
  } else if (businessSlug) {
    settings = await db.get<{
      enable_auto_trans: number;
      default_lang: string;
      business_id: number;
    }>(
      'SELECT enable_auto_trans, default_lang, business_id FROM staff_users WHERE business_slug = ? AND business_id = 0',
      [businessSlug]
    );
  } else {
    // 兜底：查询默认商家设置
    settings = await db.get<{
      enable_auto_trans: number;
      default_lang: string;
      business_id: number;
    }>(
      'SELECT enable_auto_trans, default_lang, business_id FROM staff_users WHERE business_slug = ? AND business_id = 0',
      ['default']
    );
  }

  console.log('[TranslateService] getTranslationSettings: businessId=', businessId, 'businessSlug=', businessSlug,
    'found:', !!settings, '| raw enabled:', settings?.enable_auto_trans);

  if (!settings) {
    // 如果找不到设置，返回默认启用翻译的配置
    console.warn('[TranslateService] No settings found, using default (enabled=true, zh-CN)');
    return {
      enabled: true,
      defaultLang: 'zh-CN',
    };
  }

  let enabled = settings.enable_auto_trans === 1;
  let defaultLang = settings.default_lang || 'zh-CN';

  // 下级客服（business_id > 0）：从上级商家继承启用状态
  if (settings.business_id > 0) {
    const parent = await db.get<{ enable_auto_trans: number; default_lang: string }>(
      'SELECT enable_auto_trans, default_lang FROM staff_users WHERE id = ?',
      [settings.business_id]
    );
    if (parent) {
      // 继承上级的启用状态（如果下级未禁用）
      if (!enabled && parent.enable_auto_trans === 1) {
        enabled = true;
        console.log('[TranslateService] Parent inheritance for staff', businessId,
          '| parent enabled:', true, '| final enabled:', true);
      }
      // 继承上级的默认语言（如果下级未设置）
      if (!defaultLang && parent.default_lang) {
        defaultLang = parent.default_lang;
        console.log('[TranslateService] Inherited default_lang from parent:', defaultLang);
      }
    }
  }

  return {
    enabled,
    defaultLang,
  };
}

/**
 * 翻译文本选项（内部使用）
 */
interface TranslateOptionsInternal extends TranslateOptions {
  _settings?: TranslationSettings | null;
}

/**
 * 自动翻译文本
 * 
 * 优先级链（纯免费，无需任何 API 密钥）:
 * 1. SimplyTranslate AI（首选推荐，196+ 语言，100次/分钟免费）
 * 2. Google Translate（免费稳定，CF Worker 上可靠）
 * 3. MyMemory 免费翻译（后备，每天 1000~10000 词免费）
 * 4. 返回原文（所有方案都不可用时降级）
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

  // 获取翻译设置
  const settings = opts._settings ?? (await getTranslationSettings(options.businessId, options.businessSlug));

  if (!settings) {
    console.warn('[TranslateService] ⚠️ No settings found for businessId:', options.businessId);
    return makeResult('');
  }

  if (!settings.enabled) {
    console.warn('[TranslateService] ⚠️ Translation disabled | businessId:', options.businessId);
    return makeResult('');
  }

  // ==========================================
  // 🔍 早期语言检测：如果文本已经大概率是目标语言，直接跳过翻译（节省费率）
  // ==========================================
  if (isLikelyAlreadyInTargetLang(text, to)) {
    console.log(`[TranslateService] ⏭️ Text already in target language (${to}), skipping all engines to save quota | text: "${text.substring(0, 50)}"`);
    return { text, engine: 'same_language', success: false };
  }

  // 语言代码映射
  const targetSimply = toSimplyLang(to);
  const targetGoogle = toGoogleLang(to);
  const targetIso = toIso639Lang(to);

  // ==========================================
  // 🥇 第1级：SimplyTranslate AI（首选推荐）
  // ==========================================
  console.log(`[TranslateService] 🥇 Trying SimplyTranslate AI: "${text.substring(0, 50)}..." → ${targetSimply}`);
  try {
    const translated = await callSimplyTranslate(text, targetSimply, 'auto');
    if (translated !== text && translated.trim() !== text.trim()) {
      console.log(`[TranslateService] ✅ SimplyTranslate success: "${translated.substring(0, 50)}..."`);
      return { text: translated, engine: 'simplytranslate', success: true };
    }
    console.log('[TranslateService] ⚡ SimplyTranslate returned same text, falling back...');
  } catch (error) {
    console.error('[TranslateService] ❌ SimplyTranslate exception, falling back:', error);
  }

  // ==========================================
  // 🥈 第2级：Google Translate（备选）
  // ==========================================
  console.log(`[TranslateService] 🥈 Trying Google Translate: "${text.substring(0, 50)}..." → ${targetGoogle}`);
  try {
    const translated = await callGoogleTranslate(text, targetGoogle, 'auto');
    if (translated !== text && translated.trim() !== text.trim()) {
      console.log(`[TranslateService] ✅ Google success: "${translated.substring(0, 50)}..."`);
      return { text: translated, engine: 'google', success: true };
    }
    console.log('[TranslateService] ⚡ Google returned same text, falling back...');
  } catch (error) {
    console.error('[TranslateService] ❌ Google exception, falling back:', error);
  }

  // ==========================================
  // 🥉 第3级：MyMemory（最后后备）
  // ==========================================
  console.log(`[TranslateService] 🥉 Trying MyMemory: "${text.substring(0, 50)}..." → ${targetIso}`);
  try {
    const translated = await callMyMemoryTranslate(text, targetIso, 'auto');
    if (translated !== text && translated.trim() !== text.trim()) {
      console.log(`[TranslateService] ✅ MyMemory success: "${translated.substring(0, 50)}..."`);
      return { text: translated, engine: 'mymemory', success: true };
    }
    console.log('[TranslateService] ⚡ MyMemory returned same text - ALL engines exhausted');
  } catch (error) {
    console.error('[TranslateService] ❌ MyMemory exception - ALL engines failed:', error);
  }

  // 所有引擎都失败
  console.error('[TranslateService] 🚫 ALL TRANSLATION ENGINES FAILED:',
    '| businessId:', options.businessId,
    '| to:', to,
    '| textLen:', text.length,
    '| text:', text.substring(0, 60));
  return makeResult('');
}

/**
 * 判断翻译是否有效（翻译结果与原文不同）
 */
export function isTranslationUseful(original: string, translated: string): boolean {
  return original.trim() !== translated.trim();
}
