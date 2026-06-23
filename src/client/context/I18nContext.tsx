import { createContext, useContext, useState, ReactNode } from 'react';
import { locales, type LocaleCode, type LocaleKey, supportedLocales } from '@shared/i18n';

interface I18nContextType {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: LocaleKey) => string;
  supportedLocales: typeof supportedLocales;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

/**
 * 将 URL lang 参数值映射到系统 LocaleCode
 * 支持常见格式: ko→kr, ja/jp→jp, en/en-US→en-US, zh-CN→zh-CN, zh-TW/tc→tc 等
 */
function mapLangToLocale(lang: string): LocaleCode | null {
  // 先尝试直接匹配
  const allLocaleCodes = supportedLocales.map(l => l.code);
  if (allLocaleCodes.includes(lang)) {
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

function getInitialLocale(): LocaleCode {
  if (typeof window === 'undefined') return 'zh-CN';
  
  // 1. 优先从 localStorage 读取用户手动选择的语言
  const saved = localStorage.getItem('chat_locale');
  const allLocaleCodes = supportedLocales.map(l => l.code);
  if (saved && allLocaleCodes.includes(saved)) {
    return saved as LocaleCode;
  }
  
  // 2. 从 URL 参数 lang 读取（专属链接预设语言）
  const urlParams = new URLSearchParams(window.location.search);
  const urlLang = urlParams.get('lang');
  if (urlLang) {
    const mapped = mapLangToLocale(urlLang);
    if (mapped) {
      // 保存到 localStorage，确保页面内刷新/重载后保持一致
      localStorage.setItem('chat_locale', mapped);
      return mapped;
    }
  }
  
  // 3. 首次访问：根据浏览器语言自动匹配
  const browserLang = navigator.language;
  if (browserLang.startsWith('en')) return 'en-US';
  if (browserLang.startsWith('zh')) {
    if (browserLang.includes('Hant') || browserLang.includes('HK') || browserLang.includes('TW')) {
      return 'tc';
    }
    return 'zh-CN';
  }
  if (browserLang.startsWith('ja')) return 'jp';
  if (browserLang.startsWith('ko')) return 'kr';
  if (browserLang.startsWith('es')) return 'es';
  if (browserLang.startsWith('fr')) return 'fr';
  if (browserLang.startsWith('it')) return 'it';
  if (browserLang.startsWith('de')) return 'de';
  if (browserLang.startsWith('pt')) return 'pt';
  if (browserLang.startsWith('vi')) return 'vi';
  if (browserLang.startsWith('ru')) return 'ru';
  if (browserLang.startsWith('id')) return 'id';
  if (browserLang.startsWith('th')) return 'th';
  if (browserLang.startsWith('ar')) return 'ar';
  if (browserLang.startsWith('el')) return 'el';
  if (browserLang.startsWith('pl')) return 'pl';
  if (browserLang.startsWith('da')) return 'da';
  if (browserLang.startsWith('nl')) return 'nl';
  if (browserLang.startsWith('fi')) return 'fi';
  
  // 4. 默认中文
  return 'zh-CN';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>(getInitialLocale);

  const setLocale = (newLocale: LocaleCode) => {
    setLocaleState(newLocale);
    localStorage.setItem('chat_locale', newLocale);
    window.location.reload();
  };

  const t = (key: LocaleKey): string => {
    const translations = locales[locale];
    const value = translations[key];
    
    if (Array.isArray(value)) {
      return value[Math.floor(Math.random() * value.length)];
    }
    
    return value || key;
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