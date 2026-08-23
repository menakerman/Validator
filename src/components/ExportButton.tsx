import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useValidatorStore } from '../stores/validatorStore';
import { exportValidatedExcel } from '../utils/excelExporter';
import { exportMekomeFile, exportChildrenFile, type MekomeExportScope } from '../utils/kehilanet';

export function ExportButton() {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const [scope, setScope] = useState<MekomeExportScope>('all');
  const mode = useValidatorStore((s) => s.mode);
  const parsedFile = useValidatorStore((s) => s.parsedFile);
  const columnMappings = useValidatorStore((s) => s.columnMappings);
  const validationResult = useValidatorStore((s) => s.validationResult);

  // Row-level counts for the Kehilanet export options.
  const counts = useMemo(() => {
    const total = parsedFile?.data.length ?? 0;
    const errorRows = new Set<number>();
    for (const cell of validationResult?.cells ?? []) {
      if (cell.status === 'error') errorRows.add(cell.row);
    }
    return { total, errors: errorRows.size, valid: total - errorRows.size };
  }, [parsedFile, validationResult]);

  const handleExport = async () => {
    if (!parsedFile || !validationResult) return;
    setExporting(true);
    try {
      if (mode === 'kehilanet') {
        await exportMekomeFile(parsedFile, validationResult, scope);
      } else {
        await exportValidatedExcel(parsedFile, columnMappings, validationResult, t);
      }
    } finally {
      setExporting(false);
    }
  };

  const handleExportChildren = async () => {
    if (!parsedFile || !validationResult) return;
    setExporting(true);
    try {
      await exportChildrenFile(parsedFile, validationResult, scope);
    } finally {
      setExporting(false);
    }
  };

  const buttonClass =
    'px-6 py-2.5 bg-valid-600 text-white rounded-lg font-medium hover:bg-valid-700 transition-colors disabled:opacity-50';

  if (mode === 'kehilanet') {
    return (
      <div className="flex items-center gap-2">
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as MekomeExportScope)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="all">{t('results.mekomeScope.all', { count: counts.total })}</option>
          <option value="valid">{t('results.mekomeScope.valid', { count: counts.valid })}</option>
          <option value="errors">{t('results.mekomeScope.errors', { count: counts.errors })}</option>
        </select>
        <button onClick={handleExport} disabled={exporting} className={buttonClass}>
          {exporting ? t('results.exporting') : t('results.exportMekome')}
        </button>
        <button onClick={handleExportChildren} disabled={exporting} className={buttonClass}>
          {exporting ? t('results.exporting') : t('results.exportChildren')}
        </button>
      </div>
    );
  }

  return (
    <button onClick={handleExport} disabled={exporting} className={buttonClass}>
      {exporting ? t('results.exporting') : t('results.export')}
    </button>
  );
}
