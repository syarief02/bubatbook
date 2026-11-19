import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import ms from './ms.json';

// The customer pages in English or Bahasa Melayu, with react-i18next.
// The English text is the key: t('Book This Car') shows "Tempah Kereta Ini" in BM,
// from ms.json. A text missing from ms.json shows in English.
// en.json only holds English singular forms ("{{count}} days_one": "{{count}} day").
// The choice is remembered on this device (LanguageToggle); the first visit follows
// the browser's language. Admin pages stay English.

export const LANG_KEY = 'rent2go.lang';

function initialLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'ms') return saved;
  } catch {
    // storage blocked: fall through
  }
  const nav = (typeof navigator !== 'undefined' && navigator.language) || '';
  return /^(ms|id)\b/i.test(nav) ? 'ms' : 'en';
}

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ms: { translation: ms } },
  lng: initialLang(),
  fallbackLng: 'en',
  supportedLngs: ['en', 'ms'],
  // English sentences are keys, so "." and ":" are plain text
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false },
  returnEmptyString: false,
  initAsync: false,
  react: { useSuspense: false },
});

function markPage(lng) {
  if (typeof document !== 'undefined') document.documentElement.lang = lng === 'ms' ? 'ms' : 'en';
}
markPage(i18n.language);
i18n.on('languageChanged', markPage);

export default i18n;
