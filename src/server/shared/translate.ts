import { getDb } from '@server/shared/db';

export interface TranslationResult {
  success: boolean;
  translatedText?: string;
  error?: string;
}

/**
 * Get business translation config by slug or id
 */
async function getBusinessTranslationConfig(businessSlug?: string): Promise<{
  enable_auto_trans: number;
  bd_trans_appid: string | null;
  bd_trans_secret: string | null;
  default_lang: string;
  lang: string;
} | null> {
  const db = getDb();
  
  if (!businessSlug) {
    // Return default business config
    return db.get(
      'SELECT enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang, lang FROM businesses WHERE slug = ?',
      ['default']
    );
  }
  
  // Try to find by slug first
  const business = await db.get(
    'SELECT enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang, lang FROM businesses WHERE slug = ? AND state = ?',
    [businessSlug, 'open']
  );
  
  if (business) {
    return business;
  }
  
  // Try by id
  const id = parseInt(businessSlug, 10);
  if (!isNaN(id)) {
    return db.get(
      'SELECT enable_auto_trans, bd_trans_appid, bd_trans_secret, default_lang, lang FROM businesses WHERE id = ? AND state = ?',
      [id, 'open']
    );
  }
  
  return null;
}

export async function translateText(text: string, targetLang: string = 'zh-CN', businessSlug?: string): Promise<TranslationResult> {
  try {
    const business = await getBusinessTranslationConfig(businessSlug);

    if (!business || business.enable_auto_trans !== 1) {
      return { success: false, error: 'Auto translation is not enabled' };
    }

    const { bd_trans_appid: appid, bd_trans_secret: secret } = business;
    
    if (!appid || !secret) {
      return { success: false, error: 'Translation API credentials not configured' };
    }

    const salt = Date.now().toString();
    const sign = md5(`${appid}${text}${salt}${secret}`);
    
    const query = new URLSearchParams({
      q: text,
      from: 'auto',
      to: targetLang,
      appid,
      salt,
      sign,
    });

    const response = await fetch(`http://api.fanyi.baidu.com/api/trans/vip/translate?${query.toString()}`);
    const result = await response.json();

    if (result.error_code) {
      return { success: false, error: result.error_msg || 'Translation failed' };
    }

    if (result.trans_result && result.trans_result[0] && result.trans_result[0].dst) {
      return { success: true, translatedText: result.trans_result[0].dst };
    }

    return { success: false, error: 'No translation result' };
  } catch (error) {
    console.error('[TranslateService] Translation error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Translation failed' };
  }
}

function md5(str: string): string {
  const hexDigits = '0123456789abcdef';
  let md5State = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  
  const padding = (str: string): string => {
    let bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
      bytes.push(str.charCodeAt(i));
    }
    bytes.push(0x80);
    while ((bytes.length % 64) !== 56) {
      bytes.push(0);
    }
    const bitLength = str.length * 8;
    bytes.push((bitLength >> 24) & 0xff);
    bytes.push((bitLength >> 16) & 0xff);
    bytes.push((bitLength >> 8) & 0xff);
    bytes.push(bitLength & 0xff);
    return bytes.map(b => String.fromCharCode(b)).join('');
  };

  const rotateLeft = (n: number, s: number): number => {
    return (n << s) | (n >>> (32 - s));
  };

  const FF = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number => {
    const temp = a + ((b & c) | (~b & d)) + x + ac;
    return rotateLeft(temp, s) + b;
  };

  const GG = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number => {
    const temp = a + ((b & d) | (c & ~d)) + x + ac;
    return rotateLeft(temp, s) + b;
  };

  const HH = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number => {
    const temp = a + (b ^ c ^ d) + x + ac;
    return rotateLeft(temp, s) + b;
  };

  const II = (a: number, b: number, c: number, d: number, x: number, s: number, ac: number): number => {
    const temp = a + (c ^ (b | ~d)) + x + ac;
    return rotateLeft(temp, s) + b;
  };

  const processBlock = (state: number[], block: string) => {
    const M: number[] = [];
    for (let i = 0; i < 16; i++) {
      M[i] = 0;
      for (let j = 0; j < 4; j++) {
        M[i] |= block.charCodeAt(i * 4 + j) << (24 - j * 8);
      }
    }

    let [A, B, C, D] = state;

    A = FF(A, B, C, D, M[0], 7, 0xd76aa478);
    D = FF(D, A, B, C, M[1], 12, 0xe8c7b756);
    C = FF(C, D, A, B, M[2], 17, 0x242070db);
    B = FF(B, C, D, A, M[3], 22, 0xc1bdceee);
    A = FF(A, B, C, D, M[4], 7, 0xf57c0faf);
    D = FF(D, A, B, C, M[5], 12, 0x4787c62a);
    C = FF(C, D, A, B, M[6], 17, 0xa8304613);
    B = FF(B, C, D, A, M[7], 22, 0xfd469501);
    A = FF(A, B, C, D, M[8], 7, 0x698098d8);
    D = FF(D, A, B, C, M[9], 12, 0x8b44f7af);
    C = FF(C, D, A, B, M[10], 17, 0xffff5bb1);
    B = FF(B, C, D, A, M[11], 22, 0x895cd7be);
    A = FF(A, B, C, D, M[12], 7, 0x6b901122);
    D = FF(D, A, B, C, M[13], 12, 0xfd987193);
    C = FF(C, D, A, B, M[14], 17, 0xa679438e);
    B = FF(B, C, D, A, M[15], 22, 0x49b40821);

    A = GG(A, B, C, D, M[1], 5, 0xf61e2562);
    D = GG(D, A, B, C, M[6], 9, 0xc040b340);
    C = GG(C, D, A, B, M[11], 14, 0x265e5a51);
    B = GG(B, C, D, A, M[0], 20, 0xe9b6c7aa);
    A = GG(A, B, C, D, M[5], 5, 0xd62f105d);
    D = GG(D, A, B, C, M[10], 9, 0x02441453);
    C = GG(C, D, A, B, M[15], 14, 0xd8a1e681);
    B = GG(B, C, D, A, M[4], 20, 0xe7d3fbc8);
    A = GG(A, B, C, D, M[9], 5, 0x21e1cde6);
    D = GG(D, A, B, C, M[14], 9, 0xc33707d6);
    C = GG(C, D, A, B, M[3], 14, 0xf4d50d87);
    B = GG(B, C, D, A, M[8], 20, 0x455a14ed);
    A = GG(A, B, C, D, M[13], 5, 0xa9e3e905);
    D = GG(D, A, B, C, M[2], 9, 0xfcefa3f8);
    C = GG(C, D, A, B, M[7], 14, 0x676f02d9);
    B = GG(B, C, D, A, M[12], 20, 0x8d2a4c8a);

    A = HH(A, B, C, D, M[5], 4, 0xfffa3942);
    D = HH(D, A, B, C, M[8], 11, 0x8771f681);
    C = HH(C, D, A, B, M[11], 16, 0x6d9d6122);
    B = HH(B, C, D, A, M[14], 23, 0xfde5380c);
    A = HH(A, B, C, D, M[1], 4, 0xa4beea44);
    D = HH(D, A, B, C, M[4], 11, 0x4bdecfa9);
    C = HH(C, D, A, B, M[7], 16, 0xf6bb4b60);
    B = HH(B, C, D, A, M[10], 23, 0xbebfbc70);
    A = HH(A, B, C, D, M[13], 4, 0x289b7ec6);
    D = HH(D, A, B, C, M[0], 11, 0xeaa127fa);
    C = HH(C, D, A, B, M[3], 16, 0xd4ef3085);
    B = HH(B, C, D, A, M[6], 23, 0x04881d05);
    A = HH(A, B, C, D, M[9], 4, 0xd9d4d039);
    D = HH(D, A, B, C, M[12], 11, 0xe6db99e5);
    C = HH(C, D, A, B, M[15], 16, 0x1fa27cf8);
    B = HH(B, C, D, A, M[2], 23, 0xc4ac5665);

    A = II(A, B, C, D, M[0], 6, 0xf4292244);
    D = II(D, A, B, C, M[7], 10, 0x432aff97);
    C = II(C, D, A, B, M[14], 15, 0xab9423a7);
    B = II(B, C, D, A, M[5], 21, 0xfc93a039);
    A = II(A, B, C, D, M[12], 6, 0x655b59c3);
    D = II(D, A, B, C, M[3], 10, 0x8f0ccc92);
    C = II(C, D, A, B, M[10], 15, 0xffeff47d);
    B = II(B, C, D, A, M[1], 21, 0x85845dd1);
    A = II(A, B, C, D, M[8], 6, 0x6fa87e4f);
    D = II(D, A, B, C, M[15], 10, 0xfe2ce6e0);
    C = II(C, D, A, B, M[6], 15, 0xa3014314);
    B = II(B, C, D, A, M[13], 21, 0x4e0811a1);
    A = II(A, B, C, D, M[4], 6, 0xf7537e82);
    D = II(D, A, B, C, M[11], 10, 0xbd3af235);
    C = II(C, D, A, B, M[2], 15, 0x2ad7d2bb);
    B = II(B, C, D, A, M[9], 21, 0xeb86d391);

    state[0] = (state[0] + A) >>> 0;
    state[1] = (state[1] + B) >>> 0;
    state[2] = (state[2] + C) >>> 0;
    state[3] = (state[3] + D) >>> 0;
  };

  const padded = padding(str);
  for (let i = 0; i < padded.length; i += 64) {
    processBlock(md5State, padded.substr(i, 64));
  }

  let result = '';
  for (let i = 0; i < 4; i++) {
    for (let j = 3; j >= 0; j--) {
      result += hexDigits[(md5State[i] >> (j * 8)) & 0xf];
      result += hexDigits[((md5State[i] >> (j * 8)) >> 4) & 0xf];
    }
  }

  return result;
}