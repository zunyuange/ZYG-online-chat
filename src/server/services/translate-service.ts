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
 * 获取某个 locale 对应的百度翻译语言代码
 */
function toBaiduLang(localeCode: string): string {
  return LOCALE_TO_BAIDU[localeCode] || LEGACY_LANG_TO_BAIDU[localeCode] || localeCode;
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

  const url = `http://api.fanyi.baidu.com/api/trans/vip/translate?${params.toString()}`;
  
  const response = await fetch(url);
  const result: any = await response.json();

  if (result.error_code) {
    console.error('[TranslateService] Baidu API error:', result.error_code, result.error_msg);
    return text; // 翻译失败，返回原文
  }

  if (result.trans_result && result.trans_result[0] && result.trans_result[0].dst) {
    return result.trans_result[0].dst;
  }

  return text; // 降级返回原文
}

/**
 * 获取商家的翻译设置
 */
async function getTranslationSettings(businessId?: number, businessSlug?: string) {
  const db = getDb();
  
  let settings;
  if (businessId && businessId > 0) {
    settings = await db.get<{
      enable_auto_trans: number;
      bd_trans_appid: string | null;
      bd_trans_secret: string | null;
      default_lang: string;
    }>(
      'SELECT enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang FROM staff_users WHERE id = ?',
      [businessId]
    );
  } else if (businessSlug) {
    settings = await db.get<{
      enable_auto_trans: number;
      bd_trans_appid: string | null;
      bd_trans_secret: string | null;
      default_lang: string;
    }>(
      'SELECT enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang FROM staff_users WHERE business_slug = ?',
      [businessSlug]
    );
  }

  if (!settings) return null;
  return {
    enabled: settings.enable_auto_trans === 1,
    appid: settings.bd_trans_appid,
    secret: settings.bd_trans_secret,
    defaultLang: settings.default_lang,
  };
}

/**
 * 自动翻译文本
 * 如果目标语言与当前文本语言相同，或文本包含HTML，或翻译未启用，则返回原文
 */
export async function translateText(options: TranslateOptions): Promise<string> {
  const { text, to } = options;

  // 如果目标语言是中文，不需要翻译
  if (to === 'zh-CN' || to === 'cn') return text;

  // 如果文本包含 HTML 标签，不翻译
  if (containsHtml(text)) return text;

  // 获取翻译设置
  const settings = await getTranslationSettings(options.businessId, options.businessSlug);
  if (!settings || !settings.enabled || !settings.appid || !settings.secret) {
    return text; // 翻译未启用或配置不完整
  }

  const targetBaiduLang = toBaiduLang(to);
  if (targetBaiduLang === 'zh') return text; // 不翻译成中文（但保留逻辑）

  try {
    console.log(`[TranslateService] Translating to ${targetBaiduLang}: "${text.substring(0, 50)}..."`);
    const translated = await callBaiduTranslate(text, targetBaiduLang, settings.appid, settings.secret);
    if (translated !== text) {
      console.log(`[TranslateService] Translation result: "${translated.substring(0, 50)}..."`);
    }
    return translated;
  } catch (error) {
    console.error('[TranslateService] Translation failed:', error);
    return text; // 翻译异常，返回原文
  }
}

/**
 * 判断是否需要翻译（文本不是目标语言或翻译后不同）
 */
export function isTranslationUseful(original: string, translated: string): boolean {
  return original.trim() !== translated.trim();
}
