import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { locales, type LocaleCode, type LocaleKey, supportedLocales } from '@shared/i18n';

type I18nParams = Record<string, string | number>;

interface I18nContextType {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: LocaleKey, params?: I18nParams) => string;
  supportedLocales: typeof supportedLocales;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

/** 所有支持的语言代码集合（用于快速查找） */
const ALL_LOCALE_CODES: readonly string[] = supportedLocales.map(l => l.code);

/**
 * 将浏览器语言标签映射到系统 LocaleCode
 * 支持常见格式: ko→kr, ja/jp→jp, en/en-US→en-US, zh-CN→zh-CN, zh-TW/tc→tc 等
 */
function mapLangToLocale(lang: string): LocaleCode | null {
  // 先尝试直接匹配
  if ((ALL_LOCALE_CODES as readonly string[]).includes(lang)) {
    return lang as LocaleCode;
  }
  // 映射常见 lang 值到 locale code
  const langMap: Record<string, LocaleCode> = {
    'ko': 'kr', 'ko-KR': 'kr',
    'ja': 'jp', 'ja-JP': 'jp',
    'en': 'en-US', 'en-US': 'en-US', 'en-GB': 'en-US',
    'zh': 'zh-CN', 'zh-CN': 'zh-CN', 'zh-Hans': 'zh-CN', 'zh-cn': 'zh-CN',
    'zh-TW': 'tc', 'zh-Hant': 'tc', 'zh-tw': 'tc', 'zh-HK': 'tc',
    'es': 'es', 'es-ES': 'es', 'es-MX': 'es',
    'fr': 'fr', 'fr-FR': 'fr',
    'it': 'it', 'it-IT': 'it',
    'de': 'de', 'de-DE': 'de',
    'pt': 'pt', 'pt-PT': 'pt', 'pt-BR': 'pt',
    'vi': 'vi', 'vi-VN': 'vi',
    'ru': 'ru', 'ru-RU': 'ru',
    'id': 'id', 'id-ID': 'id',
    'th': 'th', 'th-TH': 'th',
    'ar': 'ar', 'ar-SA': 'ar',
    'el': 'el', 'el-GR': 'el',
    'pl': 'pl', 'pl-PL': 'pl',
    'da': 'da', 'da-DK': 'da',
    'nl': 'nl', 'nl-NL': 'nl',
    'fi': 'fi', 'fi-FI': 'fi',
  };
  return langMap[lang] || null;
}

/**
 * 获取初始语言设置，按优先级:
 * 1. localStorage 中用户手动选择的语言
 * 2. URL 参数 ?lang=xxx
 * 3. 浏览器语言自动检测（优先 navigator.languages 完整列表）
 * 4. 兜底: 中文简体
 */
function getInitialLocale(): LocaleCode {
  if (typeof window === 'undefined') return 'zh-CN';

  // 1. 优先从 localStorage 读取用户手动选择的语言
  const saved = localStorage.getItem('chat_locale');
  if (saved && (ALL_LOCALE_CODES as readonly string[]).includes(saved)) {
    return saved as LocaleCode;
  }

  // 2. 从 URL 参数 lang 读取（专属链接预设语言）
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  if (urlLang) {
    const mapped = mapLangToLocale(urlLang);
    if (mapped) {
      localStorage.setItem('chat_locale', mapped);
      return mapped;
    }
  }

  // 3. 首次访问：根据浏览器语言自动匹配（遍历完整语言偏好列表）
  const browserLangs = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const lang of browserLangs) {
    const mapped = mapLangToLocale(lang);
    if (mapped) return mapped;
  }

  // 4. 兜底: 默认中文简体
  return 'zh-CN';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(getInitialLocale);

  // 同步 html[lang] 和 dir 属性（SEO / 无障碍 / RTL 支持）
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const setLocale = (newLocale: LocaleCode) => {
    setLocaleState(newLocale);
    localStorage.setItem('chat_locale', newLocale);
  };

  const t = (key: LocaleKey, params?: I18nParams): string => {
    const translations = locales[locale];
    const value = translations[key];
    
    let result: string;
    if (Array.isArray(value)) {
      result = value[Math.floor(Math.random() * value.length)];
    } else {
      result = (value as string) || key;
    }
    
    // 支持模板参数替换，如 {count}、{domain} 等
    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
      }
    }
    
    return result;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, supportedLocales }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}