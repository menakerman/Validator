import { useTranslation } from 'react-i18next';
import { useValidatorStore } from '../stores/validatorStore';
import type { ColumnType } from '../types';

const COLUMN_TYPES: ColumnType[] = ['id', 'phone', 'landline', 'email', 'ignore'];

export function ColumnMapping() {
  const { t } = useTranslation();
  const mappings = useValidatorStore((s) => s.columnMappings);
  const setColumnType = useValidatorStore((s) => s.setColumnType);
  const setColumnMandatory = useValidatorStore((s) => s.setColumnMandatory);
  const runValidation = useValidatorStore((s) => s.runValidation);
  const reset = useValidatorStore((s) => s.reset);

  const hasActiveColumns = mappings.some((m) => m.type !== 'ignore');

  return (
    <div>
      <h2 className="text-2xl font-semibold text-center mb-2">{t('mapping.title')}</h2>
      <p className="text-center text-gray-500 mb-6">{t('mapping.description')}</p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-start text-sm font-semibold text-gray-600">{t('mapping.column')}</th>
                <th className="px-4 py-3 text-start text-sm font-semibold text-gray-600">{t('mapping.type')}</th>
                <th className="px-4 py-3 text-start text-sm font-semibold text-gray-600">{t('mapping.mandatory')}</th>
                <th className="px-4 py-3 text-start text-sm font-semibold text-gray-600">{t('mapping.confidence')}</th>
                <th className="px-4 py-3 text-start text-sm font-semibold text-gray-600">{t('mapping.sampleValues')}</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((mapping) => (
                <tr key={mapping.columnIndex} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {mapping.headerName || `Column ${mapping.columnIndex + 1}`}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={mapping.type}
                      onChange={(e) => setColumnType(mapping.columnIndex, e.target.value as ColumnType)}
                      className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                    >
                      {COLUMN_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`mapping.types.${type}`)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {mapping.type !== 'ignore' && (
                      <input
                        type="checkbox"
                        checked={mapping.mandatory}
                        onChange={(e) => setColumnMandatory(mapping.columnIndex, e.target.checked)}
                        className="w-4 h-4 accent-primary-600 cursor-pointer"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {mapping.type !== 'ignore' && (
                      <span className={`
                        inline-block px-2 py-0.5 rounded-full text-xs font-medium
                        ${mapping.confidence >= 0.8
                          ? 'bg-valid-100 text-valid-700'
                          : mapping.confidence >= 0.5
                            ? 'bg-warning-100 text-warning-700'
                            : 'bg-gray-100 text-gray-600'
                        }
                      `}>
                        {Math.round(mapping.confidence * 100)}%
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                    {mapping.sampleValues.slice(0, 3).join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          {t('mapping.back')}
        </button>
        {!hasActiveColumns && (
          <p className="text-warning-600 text-sm">{t('mapping.noColumns')}</p>
        )}
        <button
          onClick={runValidation}
          disabled={!hasActiveColumns}
          className="px-8 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('mapping.startValidation')}
        </button>
      </div>
    </div>
  );
}
