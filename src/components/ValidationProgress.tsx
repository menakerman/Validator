import { useTranslation } from 'react-i18next';
import { useValidatorStore } from '../stores/validatorStore';

export function ValidationProgress() {
  const { t } = useTranslation();
  const progress = useValidatorStore((s) => s.validationProgress);
  const parsedFile = useValidatorStore((s) => s.parsedFile);

  const currentRow = parsedFile
    ? Math.round((progress / 100) * parsedFile.totalRows)
    : 0;

  return (
    <div className="max-w-md mx-auto text-center">
      <h2 className="text-2xl font-semibold mb-6">{t('validation.title')}</h2>

      <div className="w-full bg-gray-200 rounded-full h-4 mb-4 overflow-hidden">
        <div
          className="bg-primary-600 h-4 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-lg font-medium text-primary-700">
        {t('validation.progress', { percent: progress })}
      </p>

      {parsedFile && (
        <p className="text-sm text-gray-500 mt-1">
          {t('validation.processing', {
            current: currentRow.toLocaleString(),
            total: parsedFile.totalRows.toLocaleString(),
          })}
        </p>
      )}
    </div>
  );
}
