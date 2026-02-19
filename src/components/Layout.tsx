import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from './LanguageToggle';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/validator.svg" alt="" className="w-9 h-9" />
            <div>
              <h1 className="text-xl font-bold text-primary-700">{t('app.title')}</h1>
              <p className="text-sm text-gray-500">{t('app.subtitle')} <span className="text-gray-400">v{__APP_VERSION__}</span></p>
            </div>
          </div>
          <LanguageToggle />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
