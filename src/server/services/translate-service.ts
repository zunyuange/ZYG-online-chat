/**
 * 免费翻译 API 服务（无需任何 API Key）
 * 
 * 翻译引擎优先级（自动翻译链）:
 * 1. Cloudflare Workers AI ⭐（内网直连，最稳定，零延迟，@cf/meta/m2m100-1.2b）
 * 2. PearApi 万能翻译（自动检测语言，支持多翻译方向，免费稳定）
 * 3. SimplyTranslate AI（免费 RESTful，196+ 语言，100次/分钟）
 * 4. Google Translate（免费稳定，CF Worker 上可靠）
 * 5. MyMemory（免费后备，每天 1000~10000 词）
 * 6. 返回原文（所有引擎均失败时降级）
 */
import { getDb } from '@server/shared/db';

// ==========================================
// Cloudflare Workers AI 模块级存储
// ==========================================
let cloudflareAiBinding: any = null;

/**
 * 初始化 Cloudflare Workers AI 绑定
 * 在 Worker 启动时由 index.worker.ts 调用
 */
export function initTranslateService(aiBinding: any): void {
  cloudflareAiBinding = aiBinding;
  console.log('[TranslateService] Cloudflare AI binding stored');
}

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
 * 
 * 检测策略（按信号强度排序）：
 * 1. 平假名 → 日语（平假名是日语独有，即使只有1个也是强信号）
 * 2. 片假名 > 15% → 日语（片假名占比高时才是日语）
 * 3. 韩文谚文 > 25% → 韩语
 * 4. CJK 汉字 > 30% 且无日语/韩语信号 → 中文
 * 5. ASCII 字母占主导 → 英文
 * 6. 否则 → 未知
 */
export function detectSourceLanguage(text: string): string {
  let cjkCount = 0;        // CJK 统一表意文字（中文汉字 / 日文汉字 / 韩文汉字）
  let hiraganaCount = 0;   // 平假名（日语独有）
  let katakanaCount = 0;   // 片假名（日语独有）
  let hangulCount = 0;     // 韩文谚文音节
  let latinCount = 0;       // 英文字母 (A-Z, a-z)
  let digitCount = 0;       // 数字
  let otherCount = 0;       // 其他符号/标点
  
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x3040 && code <= 0x309F) {
      hiraganaCount++;        // 平假名 → 日语独有
    } else if (code >= 0x30A0 && code <= 0x30FF) {
      katakanaCount++;        // 片假名 → 日语独有
    } else if (code >= 0xAC00 && code <= 0xD7AF) {
      hangulCount++;          // 韩文谚文 → 韩语独有
    } else if ((code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3400 && code <= 0x4DBF)) {
      cjkCount++;             // CJK 统一汉字 + 扩展A区
    } else if ((code >= 0x41 && code <= 0x5A) || (code >= 0x61 && code <= 0x7A)) {
      latinCount++;           // 英文字母
    } else if (code >= 0x30 && code <= 0x39) {
      digitCount++;
    } else if (code < 128) {
      otherCount++;           // ASCII 标点/符号
    }
  }
  
  // 有意义的字符总数（用于计算比例）
  const meaningfulTotal = cjkCount + hiraganaCount + katakanaCount + hangulCount + latinCount;
  if (meaningfulTotal === 0) {
    // 纯数字/符号/空文本 → 尝试推断
    if (digitCount > 0 && latinCount === 0 && cjkCount === 0) return 'en';
    return 'unknown';
  }
  
  // 🔴 日语检测：平假名是绝对信号
  if (hiraganaCount > 0) {
    console.log(`[detectSourceLanguage] 🇯🇵 Detected Japanese (hiragana: ${hiraganaCount}) | text: "${text.substring(0, 50)}"`);
    return 'ja';
  }
  
  // 🟠 日语检测：片假名占比高（避免误判含几个片假名的其他语言）
  if (katakanaCount > 0 && katakanaCount / meaningfulTotal >= 0.15) {
    console.log(`[detectSourceLanguage] 🇯🇵 Detected Japanese (katakana ratio: ${(katakanaCount / meaningfulTotal * 100).toFixed(1)}%) | text: "${text.substring(0, 50)}"`);
    return 'ja';
  }
  
  // 🔵 韩语检测：谚文占比高
  if (hangulCount > 0 && hangulCount / meaningfulTotal >= 0.25) {
    console.log(`[detectSourceLanguage] 🇰🇷 Detected Korean (hangul ratio: ${(hangulCount / meaningfulTotal * 100).toFixed(1)}%) | text: "${text.substring(0, 50)}"`);
    return 'ko';
  }
  
  // 🟢 中文检测：CJK 汉字占比 > 30%，且排除日语/韩语
  if (cjkCount > 0 && cjkCount / meaningfulTotal >= 0.30) {
    console.log(`[detectSourceLanguage] 🇨🇳 Detected Chinese (CJK ratio: ${(cjkCount / meaningfulTotal * 100).toFixed(1)}%) | text: "${text.substring(0, 50)}"`);
    return 'zh-CN';
  }
  
  // ⚪ 英文检测：拉丁字母占主导
  if (latinCount > 0 && latinCount / meaningfulTotal >= 0.40) {
    console.log(`[detectSourceLanguage] 🇬🇧 Detected English/Latin (latin ratio: ${(latinCount / meaningfulTotal * 100).toFixed(1)}%) | text: "${text.substring(0, 50)}"`);
    return 'en';
  }
  
  // 默认：比较拉丁字母和 CJK 汉字数量
  if (cjkCount > latinCount && cjkCount > 0) {
    console.log(`[detectSourceLanguage] 🇨🇳 Fallback Chinese (CJK:${cjkCount} > Latin:${latinCount}) | text: "${text.substring(0, 50)}"`);
    return 'zh-CN';
  }
  if (latinCount > cjkCount && latinCount > 0) {
    console.log(`[detectSourceLanguage] 🇬🇧 Fallback English (Latin:${latinCount} > CJK:${cjkCount}) | text: "${text.substring(0, 50)}"`);
    return 'en';
  }
  
  return 'unknown';
}

/**
 * 快速判断文本是否已经（很可能）是目标语言，无需翻译
 * 
 * 策略：
 * 1. 文本过短（<3个有意义的字符）→ 不确定，仍走翻译链
 * 2. 源语言检测结果与目标语言基础相同 → 跳过翻译
 * 3. 检测结果为 unknown → 不走翻译链（可能是纯数字/表情）
 */
export function isLikelyAlreadyInTargetLang(text: string, targetLang: string): boolean {
  const targetBase = (targetLang || '').split('-')[0].toLowerCase();
  if (!targetBase) return false;
  
  // ★ 短文本优化：对极短文本（1-2个有意义字符），仍先尝试检测
  //   若检测结果明确且与目标语言匹配 → 跳过翻译（节省额度）
  //   若检测失败（unknown）→ 才进入翻译链（老逻辑）
  const stripped = text.replace(/[\s\d\p{P}\p{S}]/gu, '');
  const isShortText = stripped.length < 3;
  
  const detected = detectSourceLanguage(text);
  const detectedBase = (detected || 'unknown').split('-')[0].toLowerCase();
  
  if (detected === 'unknown') {
    console.log(`[TranslateService] 🔍 Unknown language detected, skipping translation${isShortText ? ' (short text)' : ''} | text: "${text.substring(0, 50)}"`);
    return true; // 未知语言跳过翻译
  }
  
  if (detectedBase === targetBase) {
    console.log(`[TranslateService] 🔍 Text already in target language: detected=${detected}, target=${targetLang}${isShortText ? ' (short text but script match is reliable)' : ''} | text: "${text.substring(0, 50)}"`);
    return true;
  }
  
  // 短文本但检测结果与目标语言不匹配 → 让翻译引擎自行判断（可能是混合语言等边缘情况）
  if (isShortText) {
    console.log(`[TranslateService] 🔍 Short text (${stripped.length} chars), detection=${detected} ≠ target=${targetLang}, will let engines decide | text: "${text.substring(0, 50)}"`);
    return false;
  }
  
  console.log(`[TranslateService] 🔍 Text needs translation: detected=${detected}, target=${targetLang} | text: "${text.substring(0, 50)}"`);
  return false;
}

// ==========================================
// 我们的 locale 代码 → M2M100 模型语言代码（ISO 639-1 两字母）
// @cf/meta/m2m100-1.2b 支持 100+ 语言互译
// ==========================================
const LOCALE_TO_M2M100: Record<string, string> = {
  'zh-CN': 'zh', 'zh-TW': 'zh',
  'en-US': 'en', 'en-GB': 'en',
  'ja': 'ja', 'jp': 'ja',
  'ko': 'ko', 'kr': 'ko',
  'fr': 'fr', 'de': 'de', 'es': 'es',
  'pt': 'pt', 'it': 'it', 'ru': 'ru',
  'vi': 'vi', 'th': 'th', 'id': 'id',
  'ar': 'ar', 'nl': 'nl', 'pl': 'pl',
  'da': 'da', 'fi': 'fi', 'el': 'el',
  'tc': 'zh', 'cn': 'zh',
  'en': 'en', 'vie': 'vi',
  'ara': 'ar', 'dan': 'da',
  'fin': 'fi', 'cht': 'zh',
  'spa': 'es', 'fra': 'fr', 'kor': 'ko',
};

function toM2M100Lang(localeCode: string): string {
  return LOCALE_TO_M2M100[localeCode] || localeCode.split('-')[0] || 'en';
}

// ==========================================
// ⭐ Cloudflare Workers AI - 内置翻译（最高优先级）
// 使用 @cf/meta/m2m100-1.2b 模型，Cloudflare 内网直连
// 完全免费、零延迟、绝对稳定，无需任何 API Key
// ==========================================
async function callCloudflareAITranslate(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  if (!cloudflareAiBinding) {
    console.warn('[TranslateService-CF_AI] ⚠️ AI binding not initialized, skipping');
    return text;
  }

  const src = sourceLang === 'auto' ? detectSourceLanguage(text) : sourceLang;
  const tgt = toM2M100Lang(targetLang);
  
  // M2M100 模型对中文使用 "zh" 代码
  const sourceCode = src.startsWith('zh') ? 'zh' : src.split('-')[0];
  
  // 源语言和目标语言相同，跳过
  if (sourceCode === tgt || (sourceCode === 'zh' && tgt === 'zh')) {
    console.log(`[TranslateService-CF_AI] ⏭️ Source and target language match (${sourceCode}→${tgt}), skipping`);
    return text;
  }

  console.log(`[TranslateService-CF_AI] Calling: ${sourceCode}→${tgt}, textLen=${text.length}, text="${text.substring(0, 40)}"`);

  try {
    const result = await cloudflareAiBinding.run('@cf/meta/m2m100-1.2b', {
      text,
      source_lang: sourceCode,
      target_lang: tgt,
    });

    if (result?.translated_text && typeof result.translated_text === 'string') {
      const translated = result.translated_text.trim();
      if (translated !== text.trim()) {
        console.log(`[TranslateService-CF_AI] ✅ Result: "${translated.substring(0, 50)}..."`);
        return translated;
      }
      console.warn('[TranslateService-CF_AI] ⚠️ Returned same text');
    } else {
      console.warn('[TranslateService-CF_AI] ⚠️ Unexpected response:', JSON.stringify(result).substring(0, 200));
    }
  } catch (error: any) {
    console.error('[TranslateService-CF_AI] ❌ Error:', error?.message || error);
  }

  return text;
}

// ==========================================
// 🔴 SimplyTranslate AI - 免费 RESTful
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
// 🟡 Google Translate - 备选方案（双URL容灾）
// ==========================================
async function callGoogleTranslate(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  const src = sourceLang === 'auto' ? '' : sourceLang;
  const encoded = encodeURIComponent(text);

  // ★ 双URL容灾：gtx 客户端为主，m 客户端为备
  const urls = [
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${src || 'auto'}&tl=${targetLang}&dt=t&q=${encoded}`,
    `https://translate.google.com/translate_a/single?client=dict-chrome-ex&sl=${src || 'auto'}&tl=${targetLang}&dt=t&q=${encoded}`,
  ];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`[TranslateService-Google] 🔄 Attempt ${i + 1}/${urls.length}: ${src || 'auto'}→${targetLang}, textLen=${text.length}`);

    let response: Response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (fetchError: any) {
      console.error(`[TranslateService-Google] ❌ Attempt ${i + 1} network error:`, fetchError?.name || 'Unknown', fetchError?.message || '');
      continue; // 尝试下一个URL
    }

    if (!response.ok) {
      console.error(`[TranslateService-Google] ❌ Attempt ${i + 1} HTTP error: ${response.status}`);
      continue;
    }

    try {
      const result: any = await response.json();
      if (Array.isArray(result) && result[0] && Array.isArray(result[0])) {
        const translated = result[0]
          .filter((item: any) => Array.isArray(item) && item[0])
          .map((item: any[]) => item[0])
          .join('');
        if (translated && translated.trim() !== text.trim()) {
          console.log(`[TranslateService-Google] ✅ Attempt ${i + 1} Result: "${translated.substring(0, 50)}..."`);
          return translated;
        }
      }
      console.warn(`[TranslateService-Google] ⚠️ Attempt ${i + 1} same text or unexpected response`);
    } catch (parseError) {
      console.error(`[TranslateService-Google] ❌ Attempt ${i + 1} JSON parse error:`, parseError);
    }
  }

  console.error('[TranslateService-Google] 🚫 All attempts failed, returning original text');
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
// 🟣 PearApi 万能翻译 - 第1级·免费稳定
// 免费，自动识别输入语言并进行翻译
// ==========================================

/** 将语言方向映射到 PearApi type 参数值（支持更精准的翻译方向） */
function toPearApiType(sourceLang: string, targetLang: string): string {
  const from = (sourceLang || 'auto').split('-')[0].toLowerCase();
  const to = (targetLang || 'en').split('-')[0].toLowerCase();
  
  // 如果源和目标相同，返回原文
  if (from === to) return 'AUTO';
  
  const map: Record<string, Record<string, string>> = {
    'zh': { 'en': 'ZH_CN2EN', 'ja': 'ZH_CN2JA', 'ko': 'ZH_CN2KR', 'fr': 'ZH_CN2FR', 'ru': 'ZH_CN2RU', 'es': 'ZH_CN2SP', 'de': 'ZH_CN2DE', 'pt': 'ZH_CN2PT', 'it': 'ZH_CN2IT', 'vi': 'ZH_CN2VI', 'th': 'ZH_CN2TH', 'id': 'ZH_CN2ID', 'ar': 'ZH_CN2AR' },
    'en': { 'zh': 'EN2ZH_CN', 'ja': 'EN2JA', 'ko': 'EN2KO', 'fr': 'EN2FR', 'ru': 'EN2RU', 'es': 'EN2ES', 'de': 'EN2DE', 'pt': 'EN2PT', 'it': 'EN2IT' },
    'ja': { 'zh': 'JA2ZH_CN', 'en': 'JA2EN' },
    'ko': { 'zh': 'KR2ZH_CN', 'en': 'KR2EN' },
    'fr': { 'zh': 'FR2ZH_CN', 'en': 'FR2EN' },
    'ru': { 'zh': 'RU2ZH_CN', 'en': 'RU2EN' },
    'es': { 'zh': 'SP2ZH_CN', 'en': 'SP2EN' },
    'de': { 'zh': 'DE2ZH_CN', 'en': 'DE2EN' },
    'pt': { 'zh': 'PT2ZH_CN', 'en': 'PT2EN' },
    'it': { 'zh': 'IT2ZH_CN', 'en': 'IT2EN' },
    'vi': { 'zh': 'VI2ZH_CN' },
    'th': { 'zh': 'TH2ZH_CN' },
    'id': { 'zh': 'ID2ZH_CN' },
    'ar': { 'zh': 'AR2ZH_CN' },
  };
  
  if (map[from]?.[to]) {
    console.log(`[toPearApiType] ✅ Mapped ${from}→${to} as type=${map[from][to]}`);
    return map[from][to];
  }
  
  // fallback: 使用 AUTO 让 PearApi 自动检测
  console.log(`[toPearApiType] ⚠️ No mapping for ${from}→${to}, using AUTO`);
  return 'AUTO';
}

async function callPearApiTranslate(
  text: string,
  targetLang: string,
  sourceLang: string = 'auto'
): Promise<string> {
  // 尝试本地检测源语言，匹配更精准的翻译方向（而非使用 AUTO 让后端猜）
  let type: string;
  if (sourceLang !== 'auto') {
    type = toPearApiType(sourceLang, targetLang);
  } else {
    const detectedSource = detectSourceLanguage(text);
    type = toPearApiType(detectedSource, targetLang);
  }
  
  const url = `https://api.pearapi.ai/api/translate/?text=${encodeURIComponent(text)}&type=${type}`;

  console.log(`[TranslateService-PearApi] Calling: type=${type}, detectedSource=${sourceLang === 'auto' ? 'auto→' + type : sourceLang}, textLen=${text.length}`);

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

/** 所有支持的翻译引擎列表（按推荐优先级排序，用于前端下拉菜单） */
export const ALL_TRANSLATE_ENGINES = [
  { key: 'cloudflare', label: 'Cloudflare AI 翻译' },
  { key: 'pearapi', label: 'PearApi 万能翻译' },
  { key: 'simplytranslate', label: 'SimplyTranslate AI' },
  { key: 'google', label: 'Google Translate' },
  { key: 'mymemory', label: 'MyMemory' },
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
      case 'cloudflare':
        translated = await callCloudflareAITranslate(text, targetIso, 'auto');
        break;
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
 * 1. Cloudflare Workers AI ⭐（内网直连，最稳定，@cf/meta/m2m100-1.2b）
 * 2. PearApi 万能翻译（自动检测语言，支持多翻译方向）
 * 3. SimplyTranslate AI（免费 RESTful，196+ 语言）
 * 4. Google Translate（免费稳定，CF Worker 上可靠）
 * 5. MyMemory（免费后备）
 * 6. 返回原文（所有方案都不可用时降级）
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
  // ⭐ 第0级：Cloudflare Workers AI（内网直连，最稳定，零延迟）
  // ==========================================
  if (cloudflareAiBinding) {
    console.log(`[TranslateService] ⭐ Trying Cloudflare AI: "${text.substring(0, 50)}..." → ${targetIso}`);
    try {
      const translated = await callCloudflareAITranslate(text, targetIso, 'auto');
      if (translated !== text && translated.trim() !== text.trim()) {
        console.log(`[TranslateService] ✅ Cloudflare AI success: "${translated.substring(0, 50)}..."`);
        return { text: translated, engine: 'cloudflare', success: true };
      }
      console.log('[TranslateService] ⚡ Cloudflare AI returned same text, falling back...');
    } catch (error) {
      console.error('[TranslateService] ❌ Cloudflare AI exception, falling back:', error);
    }
  } else {
    console.log('[TranslateService] ⚠️ Cloudflare AI binding not available, skipping to next engine');
  }

  // ==========================================
  // 🥇 第1级：PearApi 万能翻译 ⭐（自动检测语言+精确翻译方向）
  // ==========================================
  console.log(`[TranslateService] 🥇 Trying PearApi: "${text.substring(0, 50)}..." → ${targetIso}`);
  try {
    const translated = await callPearApiTranslate(text, targetIso, 'auto');
    if (translated !== text && translated.trim() !== text.trim()) {
      console.log(`[TranslateService] ✅ PearApi success: "${translated.substring(0, 50)}..."`);
      return { text: translated, engine: 'pearapi', success: true };
    }
    console.log('[TranslateService] ⚡ PearApi returned same text, falling back...');
  } catch (error) {
    console.error('[TranslateService] ❌ PearApi exception, falling back:', error);
  }

  // ==========================================
  // 🥈 第2级：SimplyTranslate AI
  // ==========================================
  console.log(`[TranslateService] 🥈 Trying SimplyTranslate AI: "${text.substring(0, 50)}..." → ${targetSimply}`);
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
  // 🥉 第3级：Google Translate
  // ==========================================
  console.log(`[TranslateService] 🥉 Trying Google Translate: "${text.substring(0, 50)}..." → ${targetGoogle}`);
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
  // 🏅 第4级：MyMemory（最后后备）
  // ==========================================
  console.log(`[TranslateService] 🏅 Trying MyMemory: "${text.substring(0, 50)}..." → ${targetIso}`);
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
