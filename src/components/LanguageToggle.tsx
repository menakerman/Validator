import { useTranslation } from 'react-i18next';

export function LanguageToggle() {
  const { i18n } = useTranslation();
  const isHebrew = i18n.language === 'he';

  const toggle = () => {
    const newLang = isHebrew ? 'en' : 'he';
    i18n.changeLanguage(newLang);
    document.documentElement.lang = newLang;
    document.documentElement.dir = newLang === 'he' ? 'rtl' : 'ltr';
  };

  return (
    <button
      onClick={toggle}
      className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
    >
      {isHebrew ? 'English' : 'עברית'}
    </button>
  );
}
