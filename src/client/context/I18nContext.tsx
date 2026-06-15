import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { locales, type LocaleCode, type LocaleKey, supportedLocales } from '@shared/i18n';

interface I18nContextType {
  locale: LocaleCode;
  setLocale: (locale: LocaleCode) => void;
  t: (key: LocaleKey) => string;
  supportedLocales: typeof supportedLocales;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>('zh-CN');

  useEffect(() => {
    const saved = localStorage.getItem('chat_locale');
    if (saved && (saved === 'zh-CN' || saved === 'en-US')) {
      setLocaleState(saved as LocaleCode);
    } else {
      const browserLang = navigator.language;
      if (browserLang.startsWith('en')) {
        setLocaleState('en-US');
      }
    }
  }, []);

  const setLocale = (newLocale: LocaleCode) => {
    setLocaleState(newLocale);
    localStorage.setItem('chat_locale', newLocale);
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