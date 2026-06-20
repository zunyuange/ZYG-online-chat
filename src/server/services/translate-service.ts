/**
 * 百度翻译 API 服务
 * 参考 PHP 项目 application/admin/controller/Set.php 中的 isTrans() 方法
 */
import { getDb } from '@server/shared/db';

/** 我们的 locale 代码 → 百度翻译语言代码 映射 */
const LOCALE_TO_BAIDU: Record<string, string> = {
  'zh-CN': 'zh',
  'en-US': 'en',
  'tc': 'cht',
  'jp': 'jp',
  'kr': 'kor',
  'es': 'spa',
  'fr': 'fra',
  'it': 'it',
  'de': 'de',
  'pt': 'pt',
  'vi': 'vie',
  'ru': 'ru',
  'id': 'id',
  'th': 'th',
  'ar': 'ara',
  'el': 'el',
  'pl': 'pl',
  'da': 'dan',
  'nl': 'nl',
  'fi': 'fin',
};

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

/** 旧版 lang 字段（cn/en/jp等）→ 百度语言代码 */
const LEGACY_LANG_TO_BAIDU: Record<string, string> = {
  'cn': 'zh',
  'en': 'en',
  'tc': 'cht',
  'jp': 'jp',
  'kr': 'kor',
  'es': 'spa',
  'fr': 'fra',
  'it': 'it',
  'de': 'de',
  'pt': 'pt',
  'vie': 'vie',
  'ru': 'ru',
  'id': 'id',
  'th': 'th',
  'ara': 'ara',
  'el': 'el',
  'pl': 'pl',
  'dan': 'dan',
  'nl': 'nl',
  'fin': 'fin',
};

/**
 * BCP 47 标准语言标签 → 百度翻译语言代码
 * navigator.language 返回的是 BCP 47 标签如 "ja", "ko", "zh", "en" 等
 * 但百度翻译 API 使用自己的语言代码体系（如 jp, kor）
 */
const BCP47_TO_BAIDU: Record<string, string> = {
  'ja': 'jp',      // 日语: BCP 47 "ja" → 百度 "jp"
  'ko': 'kor',     // 韩语: BCP 47 "ko" → 百度 "kor"
  'zh': 'zh',      // 中文
  'zh-CN': 'zh',
  'zh-TW': 'cht',
  'zh-HK': 'cht',
  'en': 'en',      // 英语
  'en-US': 'en',
  'en-GB': 'en',
  'fr': 'fra',     // 法语
  'fr-FR': 'fra',
  'de': 'de',      // 德语
  'de-DE': 'de',
  'es': 'spa',     // 西班牙语
  'es-ES': 'spa',
  'pt': 'pt',      // 葡萄牙语
  'pt-BR': 'pt',
  'pt-PT': 'pt',
  'it': 'it',      // 意大利语
  'it-IT': 'it',
  'ru': 'ru',      // 俄语
  'ru-RU': 'ru',
  'vi': 'vie',     // 越南语
  'vi-VN': 'vie',
  'th': 'th',      // 泰语
  'th-TH': 'th',
  'id': 'id',      // 印尼语
  'id-ID': 'id',
  'ar': 'ara',     // 阿拉伯语
  'ar-SA': 'ara',
  'nl': 'nl',      // 荷兰语
  'nl-NL': 'nl',
  'pl': 'pl',      // 波兰语
  'pl-PL': 'pl',
  'da': 'dan',     // 丹麦语
  'da-DK': 'dan',
  'fi': 'fin',     // 芬兰语
  'fi-FI': 'fin',
  'el': 'el',      // 希腊语
  'el-GR': 'el',
};

/**
 * 获取某个 locale 对应的百度翻译语言代码
 * 优先级：LOCALE_TO_BAIDU > LEGACY_LANG_TO_BAIDU > BCP47_TO_BAIDU > 原值
 */
function toBaiduLang(localeCode: string): string {
  return LOCALE_TO_BAIDU[localeCode]
    || LEGACY_LANG_TO_BAIDU[localeCode]
    || BCP47_TO_BAIDU[localeCode]
    || localeCode;
}

export interface TranslateOptions {
  text: string;
  to: string; // 目标语言（我们的 locale 代码）
  businessId?: number;
  businessSlug?: string;
}

/**
 * 判断文本是否包含 HTML 标签（图片/视频/链接等，不需要翻译）
 */
function containsHtml(text: string): boolean {
  return /<(img|a|video|p|div|br|hr|source)\b/i.test(text);
}

/**
 * 纯 JavaScript MD5 实现（兼容 Cloudflare Workers）
 * Cloudflare Workers 的 crypto.subtle.digest 不支持 MD5
 */
function md5(str: string): string {
  function rotateLeft(lValue: number, iShiftBits: number): number {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function addUnsigned(lX: number, lY: number): number {
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) return lResult ^ 0x40000000 ? lResult ^ 0xc0000000 ^ lX8 ^ lY8 : lResult ^ 0x40000000;
    return lResult ^ lX8 ^ lY8;
  }
  function F(x: number, y: number, z: number): number { return (x & y) | ((~x) & z); }
  function G(x: number, y: number, z: number): number { return (x & z) | (y & (~z)); }
  function H(x: number, y: number, z: number): number { return x ^ y ^ z; }
  function I(x: number, y: number, z: number): number { return y ^ (x | (~z)); }
  function FF(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function GG(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function HH(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function II(a: number, b: number, c: number, d: number, x: number, s: number, ac: number) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function convertToWordArray(str: string): number[] {
    const lWordCount = (((str.length + 8 - 1) / 64) | 0 + 1) * 16;
    const lByteCount = lWordCount * 4;
    const lMessage = new Array(lByteCount - 1);
    for (let i = 0; i < str.length; i++) {
      lMessage[i >> 2] |= str.charCodeAt(i) << (24 - (i % 4) * 8);
    }
    lMessage[str.length >> 2] |= 0x80 << (24 - (str.length % 4) * 8);
    lMessage[lByteCount - 2] = str.length << 3;
    lMessage[lByteCount - 1] = str.length >>> 29;
    return lMessage;
  }
  function wordToHex(lValue: number): string {
    let wordToHexValue = '';
    let wordToHexValueTemp = '';
    for (let lCount = 0; lCount <= 3; lCount++) {
      wordToHexValueTemp = (lValue >>> (lCount * 8)) & 255;
      wordToHexValue += ('0' + wordToHexValueTemp.toString(16)).slice(-2);
    }
    return wordToHexValue;
  }

  const x = convertToWordArray(str);
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

  for (let k = 0; k < x.length; k += 16) {
    const aa = a, bb = b, cc = c, dd = d;
    a = FF(a, b, c, d, x[k], S11, 0xd76aa478); d = FF(d, a, b, c, x[k + 1], S12, 0xe8c7b756);
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070db); b = FF(b, c, d, a, x[k + 3], S14, 0xc1bdceee);
    a = FF(a, b, c, d, x[k + 4], S11, 0xf57c0faf); d = FF(d, a, b, c, x[k + 5], S12, 0x4787c62a);
    c = FF(c, d, a, b, x[k + 6], S13, 0xa8304613); b = FF(b, c, d, a, x[k + 7], S14, 0xfd469501);
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098d8); d = FF(d, a, b, c, x[k + 9], S12, 0x8b44f7af);
    c = FF(c, d, a, b, x[k + 10], S13, 0xffff5bb1); b = FF(b, c, d, a, x[k + 11], S14, 0x895cd7be);
    a = FF(a, b, c, d, x[k + 12], S11, 0x6b901122); d = FF(d, a, b, c, x[k + 13], S12, 0xfd987193);
    c = FF(c, d, a, b, x[k + 14], S13, 0xa679438e); b = FF(b, c, d, a, x[k + 15], S14, 0x49b40821);
    a = GG(a, b, c, d, x[k + 1], S21, 0xf61e2562); d = GG(d, a, b, c, x[k + 6], S22, 0xc040b340);
    c = GG(c, d, a, b, x[k + 11], S23, 0x265e5a51); b = GG(b, c, d, a, x[k], S24, 0xe9b6c7aa);
    a = GG(a, b, c, d, x[k + 5], S21, 0xd62f105d); d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
    c = GG(c, d, a, b, x[k + 15], S23, 0xd8a1e681); b = GG(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8);
    a = GG(a, b, c, d, x[k + 9], S21, 0x21e1cde6); d = GG(d, a, b, c, x[k + 14], S22, 0xc33707d6);
    c = GG(c, d, a, b, x[k + 3], S23, 0xf4d50d87); b = GG(b, c, d, a, x[k + 8], S24, 0x455a14ed);
    a = GG(a, b, c, d, x[k + 13], S21, 0xa9e3e905); d = GG(d, a, b, c, x[k + 2], S22, 0xfcefa3f8);
    c = GG(c, d, a, b, x[k + 7], S23, 0x676f02d9); b = GG(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a);
    a = HH(a, b, c, d, x[k + 5], S31, 0xfffa3942); d = HH(d, a, b, c, x[k + 8], S32, 0x8771f681);
    c = HH(c, d, a, b, x[k + 11], S33, 0x6d9d6122); b = HH(b, c, d, a, x[k + 14], S34, 0xfde5380c);
    a = HH(a, b, c, d, x[k + 1], S31, 0xa4beea44); d = HH(d, a, b, c, x[k + 4], S32, 0x4bdecfa9);
    c = HH(c, d, a, b, x[k + 7], S33, 0xf6bb4b60); b = HH(b, c, d, a, x[k + 10], S34, 0xbebfbc70);
    a = HH(a, b, c, d, x[k + 13], S31, 0x289b7ec6); d = HH(d, a, b, c, x[k], S32, 0xeaa127fa);
    c = HH(c, d, a, b, x[k + 3], S33, 0xd4ef3085); b = HH(b, c, d, a, x[k + 6], S34, 0x4881d05);
    a = HH(a, b, c, d, x[k + 9], S31, 0xd9d4d039); d = HH(d, a, b, c, x[k + 12], S32, 0xe6db99e5);
    c = HH(c, d, a, b, x[k + 15], S33, 0x1fa27cf8); b = HH(b, c, d, a, x[k + 2], S34, 0xc4ac5665);
    a = II(a, b, c, d, x[k], S41, 0xf4292244); d = II(d, a, b, c, x[k + 7], S42, 0x432aff97);
    c = II(c, d, a, b, x[k + 14], S43, 0xab9423a7); b = II(b, c, d, a, x[k + 5], S44, 0xfc93a039);
    a = II(a, b, c, d, x[k + 12], S41, 0x655b59c3); d = II(d, a, b, c, x[k + 3], S42, 0x8f0ccc92);
    c = II(c, d, a, b, x[k + 10], S43, 0xffeff47d); b = II(b, c, d, a, x[k + 1], S44, 0x85845dd1);
    a = II(a, b, c, d, x[k + 8], S41, 0x6fa87e4f); d = II(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0);
    c = II(c, d, a, b, x[k + 6], S43, 0xa3014314); b = II(b, c, d, a, x[k + 13], S44, 0x4e0811a1);
    a = II(a, b, c, d, x[k + 4], S41, 0xf7537e82); d = II(d, a, b, c, x[k + 11], S42, 0xbd3af235);
    c = II(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb); b = II(b, c, d, a, x[k + 9], S44, 0xeb86d391);
    a = addUnsigned(a, aa); b = addUnsigned(b, bb); c = addUnsigned(c, cc); d = addUnsigned(d, dd);
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

/**
 * 调用百度翻译 API
 * 参考 PHP: http://api.fanyi.baidu.com/api/trans/vip/translate
 * MD5签名: md5(appid + text + salt + secret)
 */
async function callBaiduTranslate(
  text: string,
  targetBaiduLang: string,
  appid: string,
  secret: string
): Promise<string> {
  const salt = String(Date.now());
  const signStr = appid + text + salt + secret;
  const sign = md5(signStr);

  const params = new URLSearchParams({
    q: text,
    from: 'auto',
    to: targetBaiduLang,
    appid: appid,
    salt: salt,
    sign: sign,
  });

  const url = `https://api.fanyi.baidu.com/api/trans/vip/translate?${params.toString()}`;
  
  console.log(`[TranslateService] Calling Baidu API: to=${targetBaiduLang}, textLen=${text.length}`);
  
  let response: Response;
  try {
    response = await fetch(url);
  } catch (fetchError) {
    console.error('[TranslateService] ❌ Network error calling Baidu API:', fetchError);
    return text;
  }

  if (!response.ok) {
    console.error(`[TranslateService] ❌ Baidu API HTTP error: ${response.status} ${response.statusText}`);
    return text;
  }

  const result: any = await response.json();

  if (result.error_code) {
    console.error('[TranslateService] ❌ Baidu API error:', result.error_code, result.error_msg);
    return text; // 翻译失败，返回原文
  }

  if (result.trans_result && result.trans_result[0] && result.trans_result[0].dst) {
    return result.trans_result[0].dst;
  }

  console.warn('[TranslateService] ⚠️ Unexpected Baidu API response (no trans_result):', JSON.stringify(result).substring(0, 200));
  return text; // 降级返回原文
}

/**
 * 获取 ISO 639-1 语言代码（用于 MyMemory 等免费 API）
 */
function toIso639Lang(localeCode: string): string {
  return LOCALE_TO_ISO639[localeCode] || localeCode;
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
    response = await fetch(url);
  } catch (fetchError) {
    console.error('[TranslateService-MyMemory] ❌ Network error:', fetchError);
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
 * 翻译设置返回值
 */
export interface TranslationSettings {
  enabled: boolean;
  appid: string | null;
  secret: string | null;
  defaultLang: string;
}

/**
 * 获取商家的翻译设置
 * 支持多层级：下级客服继承上级商家的翻译凭据（appid/secret），但使用自己的语言偏好
 */
export async function getTranslationSettings(businessId?: number, businessSlug?: string): Promise<TranslationSettings | null> {
  const db = getDb();
  
  let settings;
  if (businessId !== undefined && businessId > 0) {
    // 商家/客服：按 staff_users.id 查询
    settings = await db.get<{
      enable_auto_trans: number;
      bd_trans_appid: string | null;
      bd_trans_secret: string | null;
      default_lang: string;
      business_id: number;
    }>(
      'SELECT enable_auto_trans, bd_trans_appid, COALESCE(bd_trans_secret, bd_trans_token) as bd_trans_secret, default_lang, business_id FROM staff_users WHERE id = ?',
      [businessId]
    );
  } else if (businessSlug) {
    // 超管(businessId=0)或无 businessId：按 business_slug 查询
    settings = await db.get<{
      enable_auto_trans: number;
      bd_trans_appid: string | null;
      bd_trans_secret: string | null;
      default_lang: string;
      business_id: number;
    }>(
      'SELECT enable_auto_trans, bd_trans_appid, COALESCE(bd_trans_secret, bd_trans_token) as bd_trans_secret, default_lang, business_id FROM staff_users WHERE business_slug = ? AND business_id = 0',
      [businessSlug]
    );
  } else {
    // businessId=0 且没有 businessSlug：尝试用 businessId=0 的 admin 账号
    settings = await db.get<{
      enable_auto_trans: number;
      bd_trans_appid: string | null;
      bd_trans_secret: string | null;
      default_lang: string;
      business_id: number;
    }>(
      'SELECT enable_auto_trans, bd_trans_appid, COALESCE(bd_trans_secret, bd_trans_token) as bd_trans_secret, default_lang, business_id FROM staff_users WHERE id = ?',
      [businessId]
    );
  }
  
  console.log('[TranslateService] getTranslationSettings: businessId=', businessId, 'businessSlug=', businessSlug,
    'found:', !!settings);

  if (!settings) return null;

  // 如果当前用户没有翻译凭据（下级客服），从上级商家继承
  let appid = settings.bd_trans_appid;
  let secret = settings.bd_trans_secret;
  let enabled = settings.enable_auto_trans === 1;

  if ((!appid || !secret) && settings.business_id > 0) {
    // 下级客服：从上级商家账号获取翻译凭据
    const parent = await db.get<{
      enable_auto_trans: number;
      bd_trans_appid: string | null;
      bd_trans_secret: string | null;
    }>(
      'SELECT enable_auto_trans, bd_trans_appid, COALESCE(bd_trans_secret, bd_trans_token) as bd_trans_secret FROM staff_users WHERE id = ?',
      [settings.business_id]
    );
    if (parent) {
      enabled = parent.enable_auto_trans === 1;
      appid = parent.bd_trans_appid;
      secret = parent.bd_trans_secret;
      console.log('[TranslateService] Using parent business credentials for staff user:', businessId);
    }
  }

  return {
    enabled,
    appid,
    secret,
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
 * 优先级链:
 * 1. 百度翻译 API（需配置 appid + secret）
 * 2. MyMemory 免费翻译（后备，无需凭据，每天 1000 词免费）
 * 3. 返回原文（所有方案都不可用时降级）
 *
 * 【重要】如果返回原文（翻译未生效），查看服务端日志了解具体跳过的原因：
 *   - "Translation not configured" → 商家未配置翻译设置
 *   - "Translation disabled" → enable_auto_trans = 0
 *   - "Translation failed" → API 调用异常
 */
export async function translateText(options: TranslateOptions): Promise<string> {
  const { text, to } = options;
  const opts = options as TranslateOptionsInternal;

  // 如果文本包含 HTML 标签，不翻译
  if (containsHtml(text)) {
    console.log('[TranslateService] Skipped: text contains HTML');
    return text;
  }

  // 如果文本为空，不翻译
  if (!text || !text.trim()) {
    console.log('[TranslateService] Skipped: empty text');
    return text;
  }

  // 获取翻译设置（优先使用预取的，避免重复查询）
  const settings = opts._settings ?? (await getTranslationSettings(options.businessId, options.businessSlug));

  if (!settings) {
    console.warn('[TranslateService] ⚠️ Translation skipped: No settings found for businessId:', options.businessId);
    return text;
  }

  if (!settings.enabled) {
    console.warn('[TranslateService] ⚠️ Translation skipped: enable_auto_trans is OFF for businessId:', options.businessId);
    return text;
  }

  // 【🧠 智能选择翻译提供商】
  const hasBaidu = !!(settings.appid && settings.secret);
  
  if (hasBaidu) {
    // 百度翻译（需要 API 凭据）
    const targetBaiduLang = toBaiduLang(to);
    console.log(`[TranslateService] 🔵 Using Baidu Translate: "${text.substring(0, 50)}..." → ${targetBaiduLang}`);
    try {
      const translated = await callBaiduTranslate(text, targetBaiduLang, settings.appid!, settings.secret!);
      if (translated !== text) {
        console.log(`[TranslateService] ✅ Baidu result: "${translated.substring(0, 50)}..."`);
      } else {
        console.log(`[TranslateService] ⚡ Baidu returned same text (already in target language?)`);
      }
      return translated;
    } catch (error) {
      console.error('[TranslateService] ❌ Baidu API call failed, falling back to MyMemory:', error);
      // 百度失败后尝试 MyMemory
      const targetIso = toIso639Lang(to);
      return await callMyMemoryTranslate(text, targetIso);
    }
  }
  
  // 📦 免费后备：使用 MyMemory 翻译（无需 API Key）
  const targetIso = toIso639Lang(to);
  const sourceIso = 'auto';
  console.log(`[TranslateService] 🟢 Using MyMemory (free fallback): "${text.substring(0, 50)}..." → ${targetIso}`);
  
  try {
    const translated = await callMyMemoryTranslate(text, targetIso, sourceIso);
    if (translated !== text) {
      console.log(`[TranslateService] ✅ MyMemory result: "${translated.substring(0, 50)}..."`);
    } else {
      console.log(`[TranslateService] ⚡ MyMemory returned same text (already in target language?)`);
    }
    return translated;
  } catch (error) {
    console.error('[TranslateService] ❌ MyMemory also failed:', error);
    return text;
  }
}

/**
 * 判断是否需要翻译（文本不是目标语言或翻译后不同）
 */
export function isTranslationUseful(original: string, translated: string): boolean {
  return original.trim() !== translated.trim();
}
