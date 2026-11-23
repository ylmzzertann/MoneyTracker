import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { LanguagePref, Region } from '@/store/settings';

import en from './locales/en.json';
import tr from './locales/tr.json';

export type AppLanguage = 'en' | 'tr';
export const APP_LANGUAGES: AppLanguage[] = ['en', 'tr'];

export function deviceLanguage(): AppLanguage {
  return getLocales()[0]?.languageCode === 'tr' ? 'tr' : 'en';
}

export function deviceRegion(): Region {
  const region = getLocales()[0]?.regionCode;
  if (region === 'TR') return 'TR';
  if (region === 'US') return 'US';
  return 'OTHER';
}

export function resolveLanguage(pref: LanguagePref): AppLanguage {
  return pref === 'system' ? deviceLanguage() : pref;
}

/** BCP-47 tag used for number/date formatting, e.g. "tr-TR" or "en-US". */
export function formattingLocale(language: AppLanguage, region: Region): string {
  if (region === 'OTHER') {
    const device = getLocales()[0];
    return device?.regionCode ? `${language}-${device.regionCode}` : language;
  }
  return `${language}-${region}`;
}

/** i18n key for a system category key ("utilities.gas" -> "categories.utilities-gas"). */
export function categoryKey(key: string): string {
  return `categories.${key.replace(/\./g, '-')}`;
}

/** Sets up i18next once, before the first render. */
export function initI18n(language: AppLanguage) {
  if (i18n.isInitialized) return i18n;
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, tr: { translation: tr } },
    lng: language,
    fallbackLng: 'en',
    initAsync: false,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return i18n;
}

/**
 * Switches the UI language. Call it from an effect, never during render:
 * every mounted `useTranslation` re-renders when the language changes.
 */
export function applyLanguage(language: AppLanguage) {
  if (i18n.language !== language) void i18n.changeLanguage(language);
}

export default i18n;
