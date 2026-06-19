import { zhCN } from './locales/zh-CN';
import { enUS } from './locales/en-US';
import tc from './locales/tc';
import jp from './locales/jp';
import kr from './locales/kr';
import es from './locales/es';
import fr from './locales/fr';
import it from './locales/it';
import de from './locales/de';
import pt from './locales/pt';
import vi from './locales/vi';
import ru from './locales/ru';
import id from './locales/id';
import th from './locales/th';
import ar from './locales/ar';
import el from './locales/el';
import pl from './locales/pl';
import da from './locales/da';
import nl from './locales/nl';
import fi from './locales/fi';

export type LocaleKey = keyof typeof zhCN;
export type LocaleCode = 'zh-CN' | 'en-US' | 'tc' | 'jp' | 'kr' | 'es' | 'fr' | 'it' | 'de' | 'pt' | 'vi' | 'ru' | 'id' | 'th' | 'ar' | 'el' | 'pl' | 'da' | 'nl' | 'fi';

// Use a relaxed type for locales to allow partial translations during incremental development
export const locales: Record<LocaleCode, Record<string, string | string[]>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'tc': tc,
  'jp': jp,
  'kr': kr,
  'es': es,
  'fr': fr,
  'it': it,
  'de': de,
  'pt': pt,
  'vi': vi,
  'ru': ru,
  'id': id,
  'th': th,
  'ar': ar,
  'el': el,
  'pl': pl,
  'da': da,
  'nl': nl,
  'fi': fi,
};

export function getLocale(locale: LocaleCode): Record<string, string | string[]> {
  return (locales[locale] as any) || zhCN;
}

export function translate(key: LocaleKey, locale: LocaleCode = 'zh-CN'): string {
  const translations: any = locales[locale] || {};
  const value = translations[key];
  if (Array.isArray(value)) {
    return value[Math.floor(Math.random() * value.length)];
  }
  return (value as string) || key;
}

export const supportedLocales: { code: LocaleCode; name: string; nativeName: string }[] = [
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '中文' },
  { code: 'en-US', name: 'English', nativeName: 'English' },
  { code: 'tc', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
  { code: 'jp', name: 'Japanese', nativeName: '日本語' },
  { code: 'kr', name: 'Korean', nativeName: '한국어' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'el', name: 'Greek', nativeName: 'Ελληνικά' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski' },
  { code: 'da', name: 'Danish', nativeName: 'Dansk' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
];