import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useValidatorStore } from '../stores/validatorStore';
import { exportValidatedExcel } from '../utils/excelExporter';

export function ExportButton() {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const parsedFile = useValidatorStore((s) => s.parsedFile);
  const columnMappings = useValidatorStore((s) => s.columnMappings);
  const validationResult = useValidatorStore((s) => s.validationResult);

  const handleExport = async () => {
    if (!parsedFile || !validationResult) return;
    setExporting(true);
    try {
      await exportValidatedExcel(parsedFile, columnMappings, validationResult, t);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="px-6 py-2.5 bg-valid-600 text-white rounded-lg font-medium hover:bg-valid-700 transition-colors disabled:opacity-50"
    >
      {exporting ? t('results.exporting') : t('results.export')}
    </button>
  );
}
