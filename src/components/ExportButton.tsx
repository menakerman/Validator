import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useValidatorStore } from '../stores/validatorStore';
import { exportValidatedExcel } from '../utils/excelExporter';
import { exportMekomeFile, exportChildrenFile, type MekomeExportScope } from '../utils/kehilanet';

// Download / export (document with a down arrow) — used for the plain Excel and
// Mekome exports.
const DOWNLOAD_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
  </svg>
);

// Children (a group of people) — used for the children export.
const CHILDREN_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
  </svg>
);

// Spinner shown while an export is running.
const SPINNER_ICON = (
  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

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

  const baseButton =
    'inline-flex items-center justify-center gap-2 px-6 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-50';
  const greenButton = `${baseButton} bg-valid-600 hover:bg-valid-700`;
  const blueButton = `${baseButton} bg-primary-600 hover:bg-primary-700`;

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
        <button onClick={handleExport} disabled={exporting} className={greenButton}>
          {exporting ? SPINNER_ICON : DOWNLOAD_ICON}
          {exporting ? t('results.exporting') : t('results.exportMekome')}
        </button>
        <button onClick={handleExportChildren} disabled={exporting} className={blueButton}>
          {exporting ? SPINNER_ICON : CHILDREN_ICON}
          {exporting ? t('results.exporting') : t('results.exportChildren')}
        </button>
      </div>
    );
  }

  return (
    <button onClick={handleExport} disabled={exporting} className={greenButton}>
      {exporting ? SPINNER_ICON : DOWNLOAD_ICON}
      {exporting ? t('results.exporting') : t('results.export')}
    </button>
  );
}
