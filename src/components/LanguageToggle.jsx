import { useTranslation } from 'react-i18next';
import { LANG_KEY } from '../i18n';

/** EN | BM switch for the navbar; the choice is remembered on this device. */
export default function LanguageToggle({ className = '' }) {
  const { i18n } = useTranslation();
  const lang = i18n.resolvedLanguage;

  function choose(code) {
    i18n.changeLanguage(code);
    try {
      localStorage.setItem(LANG_KEY, code);
    } catch {
      // not saved; still switches for this visit
    }
  }

  const btn = (code, label) => (
    <button
      type="button"
      onClick={() => choose(code)}
      aria-pressed={lang === code}
      className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors ${
        lang === code ? 'bg-violet-500/20 text-violet-200' : 'text-slate-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-lg border border-white/10 p-0.5 ${className}`}
      role="group"
      aria-label="Language / Bahasa"
    >
      {btn('en', 'EN')}
      {btn('ms', 'BM')}
    </div>
  );
}
