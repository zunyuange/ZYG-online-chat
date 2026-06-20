import { createContext, useContext, useState, ReactNode } from 'react';
import { locales, type LocaleCode, type LocaleKey, supportedLocales } from '@shared/i18n';

interface I18nContextType {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: LocaleKey) => string;
  supportedLocales: typeof supportedLocales;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function getInitialLocale(): LocaleCode {
  if (typeof window === 'undefined') return 'zh-CN';
  // 1. 优先从 localStorage 读取用户手动选择的语言
  const saved = localStorage.getItem('chat_locale');
  const allLocaleCodes = supportedLocales.map(l => l.code);
  if (saved && allLocaleCodes.includes(saved)) {
    return saved as LocaleCode;
  }
  // 2. 首次访问：根据浏览器语言自动匹配
  const browserLang = navigator.language;
  if (browserLang.startsWith('en')) return 'en-US';
  if (browserLang.startsWith('zh')) {
    // 根据浏览器语言细粒度匹配
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
  // 3. 默认中文
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