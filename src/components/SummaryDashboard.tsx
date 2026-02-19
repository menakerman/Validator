import { useTranslation } from 'react-i18next';
import { useValidatorStore } from '../stores/validatorStore';
import { StatCard } from './StatCard';

export function SummaryDashboard() {
  const { t } = useTranslation();
  const summary = useValidatorStore((s) => s.validationResult?.summary);

  if (!summary) return null;

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">{t('results.summary')}</h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label={t('results.totalCells')} value={summary.totalCells} color="blue" />
        <StatCard label={t('results.valid')} value={summary.validCount} color="green" />
        <StatCard label={t('results.warnings')} value={summary.warningCount} color="yellow" />
        <StatCard label={t('results.errors')} value={summary.errorCount} color="red" />
      </div>

      {summary.perColumn.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-600 mb-3">{t('results.perColumn')}</h4>
          <div className="space-y-3">
            {summary.perColumn.map((col) => {
              const validPct = col.total > 0 ? (col.valid / col.total) * 100 : 0;
              const warnPct = col.total > 0 ? (col.warnings / col.total) * 100 : 0;
              const errPct = col.total > 0 ? (col.errors / col.total) * 100 : 0;

              return (
                <div key={col.columnIndex} className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{col.headerName}</span>
                    <span className="text-xs text-gray-500">
                      {t(`mapping.types.${col.type}`)}
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
                    <div className="bg-valid-500 h-full" style={{ width: `${validPct}%` }} />
                    <div className="bg-warning-400 h-full" style={{ width: `${warnPct}%` }} />
                    <div className="bg-error-500 h-full" style={{ width: `${errPct}%` }} />
                  </div>
                  <div className="flex justify-between mt-1 text-xs text-gray-500">
                    <span>{col.valid} {t('results.valid')}</span>
                    <span>{col.warnings} {t('results.warnings')}</span>
                    <span>{col.errors} {t('results.errors')}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
