import { zhCN } from './locales/zh-CN';
import { enUS } from './locales/en-US';

export type LocaleKey = keyof typeof zhCN;
export type LocaleCode = 'zh-CN' | 'en-US';

export const locales: Record<LocaleCode, typeof zhCN> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

export function getLocale(locale: LocaleCode): typeof zhCN {
  return locales[locale] || zhCN;
}

export function translate(key: LocaleKey, locale: LocaleCode = 'zh-CN'): string {
  const translations = locales[locale];
  const value = translations[key];
  
  if (Array.isArray(value)) {
    return value[Math.floor(Math.random() * value.length)];
  }
  
  return value || key;
}

export const supportedLocales: { code: LocaleCode; name: string; nativeName: string }[] = [
  { code: 'zh-CN', name: 'Chinese', nativeName: '中文' },
  { code: 'en-US', name: 'English', nativeName: 'English' },
];