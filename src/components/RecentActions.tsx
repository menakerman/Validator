import { useTranslation } from 'react-i18next';
import { useValidatorStore } from '../stores/validatorStore';
import type { HistoryEntry } from '../types';

function timeAgo(ts: number, t: (k: string, o?: Record<string, unknown>) => string): string {
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return t('recent.time.now');
  if (minutes < 60) return t('recent.time.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('recent.time.hours', { count: hours });
  return t('recent.time.days', { count: Math.floor(hours / 24) });
}

const KEHILANET_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
  </svg>
);
const VALIDATE_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

function RecentItem({ entry }: { entry: HistoryEntry }) {
  const { t } = useTranslation();
  const isKehilanet = entry.mode === 'kehilanet';

  return (
    <li className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5 hover:border-gray-300 transition-colors">
      <div
        className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
          isKehilanet ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {isKehilanet ? KEHILANET_ICON : VALIDATE_ICON}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-800 truncate">{entry.fileName}</span>
          <span
            className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full font-medium ${
              isKehilanet ? 'bg-primary-50 text-primary-700' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {isKehilanet ? t('recent.conversion') : t('recent.validation')}
          </span>
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          {timeAgo(entry.timestamp, t)} · {t('recent.rows', { count: entry.totalRows })}
        </div>
      </div>

      <div className="shrink-0 text-sm font-medium">
        {entry.errorRows > 0 ? (
          <span className="text-error-600">{t('recent.errors', { count: entry.errorRows })}</span>
        ) : (
          <span className="text-valid-600">{t('recent.allValid')}</span>
        )}
      </div>
    </li>
  );
}

export function RecentActions() {
  const { t } = useTranslation();
  const history = useValidatorStore((s) => s.history);
  const clearHistory = useValidatorStore((s) => s.clearHistory);

  if (history.length === 0) return null;

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-700">{t('recent.title')}</h3>
        <button
          onClick={clearHistory}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          {t('recent.clear')}
        </button>
      </div>
      <ul className="space-y-2">
        {history.map((entry) => (
          <RecentItem key={entry.id} entry={entry} />
        ))}
      </ul>
    </div>
  );
}
