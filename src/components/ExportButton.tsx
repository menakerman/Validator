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

// Warning triangle — used for the error-report export.
const ERROR_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);

// Spinner shown while an export is running.
const SPINNER_ICON = (
  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const baseButton =
  'inline-flex items-center justify-center gap-2 px-6 py-2.5 text-white rounded-lg font-medium transition-colors disabled:opacity-50';
const greenButton = `${baseButton} bg-valid-600 hover:bg-valid-700`;
const blueButton = `${baseButton} bg-primary-600 hover:bg-primary-700`;
const redButton = `${baseButton} bg-error-600 hover:bg-error-700`;

// Which Kehilanet file the pending row-scope choice will produce.
type KehilanetTarget = 'mekome' | 'children';

export function ExportButton() {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  // When set, the "which rows?" dialog is open for the chosen output file.
  const [pending, setPending] = useState<KehilanetTarget | null>(null);
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

  // Plain (non-Kehilanet) validator export.
  const handleExportExcel = async () => {
    if (!parsedFile || !validationResult) return;
    setExporting(true);
    try {
      await exportValidatedExcel(parsedFile, columnMappings, validationResult, t);
    } finally {
      setExporting(false);
    }
  };

  // Run a Kehilanet export for the given target file and row scope.
  const runKehilanetExport = async (target: KehilanetTarget, scope: MekomeExportScope) => {
    if (!parsedFile || !validationResult) return;
    setPending(null);
    setExporting(true);
    try {
      if (target === 'children') {
        await exportChildrenFile(parsedFile, validationResult, scope);
      } else {
        await exportMekomeFile(parsedFile, validationResult, scope);
      }
    } finally {
      setExporting(false);
    }
  };

  // Error report: the error rows only, with the offending cells highlighted.
  const handleErrorReport = async () => {
    if (!parsedFile || !validationResult) return;
    setExporting(true);
    try {
      await exportMekomeFile(parsedFile, validationResult, 'errors');
    } finally {
      setExporting(false);
    }
  };

  if (mode !== 'kehilanet') {
    return (
      <button onClick={handleExportExcel} disabled={exporting} className={greenButton}>
        {exporting ? SPINNER_ICON : DOWNLOAD_ICON}
        {exporting ? t('results.exporting') : t('results.export')}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={() => setPending('mekome')} disabled={exporting} className={greenButton}>
        {exporting ? SPINNER_ICON : DOWNLOAD_ICON}
        {exporting ? t('results.exporting') : t('results.exportMekome')}
      </button>
      <button onClick={() => setPending('children')} disabled={exporting} className={blueButton}>
        {exporting ? SPINNER_ICON : CHILDREN_ICON}
        {exporting ? t('results.exporting') : t('results.exportChildren')}
      </button>
      <button
        onClick={handleErrorReport}
        disabled={exporting || counts.errors === 0}
        className={redButton}
        title={counts.errors === 0 ? t('results.exportErrors.none') : undefined}
      >
        {exporting ? SPINNER_ICON : ERROR_ICON}
        {t('results.exportErrors.button', { count: counts.errors })}
      </button>

      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPending(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-semibold text-gray-900">
              {t('results.exportChoice.title')}
            </h3>
            <p className="mb-5 text-sm text-gray-500">
              {t(
                pending === 'children'
                  ? 'results.exportChoice.descriptionChildren'
                  : 'results.exportChoice.descriptionMekome',
              )}
            </p>
            <div className="flex flex-col gap-2">
              <button className={greenButton} onClick={() => runKehilanetExport(pending, 'all')}>
                {t('results.exportChoice.all', { count: counts.total })}
              </button>
              <button
                className={`${baseButton} bg-primary-600 hover:bg-primary-700`}
                onClick={() => runKehilanetExport(pending, 'valid')}
              >
                {t('results.exportChoice.valid', { count: counts.valid })}
              </button>
              <button
                className="mt-1 py-1 text-sm text-gray-500 hover:text-gray-700"
                onClick={() => setPending(null)}
              >
                {t('results.exportChoice.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
