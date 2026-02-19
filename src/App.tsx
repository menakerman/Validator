import { useTranslation } from 'react-i18next';
import { Layout } from './components/Layout';
import { FileUpload } from './components/FileUpload';
import { ColumnMapping } from './components/ColumnMapping';
import { ValidationProgress } from './components/ValidationProgress';
import { SummaryDashboard } from './components/SummaryDashboard';
import { ResultsTable } from './components/ResultsTable';
import { ExportButton } from './components/ExportButton';
import { useValidatorStore } from './stores/validatorStore';

function App() {
  const { t } = useTranslation();
  const step = useValidatorStore((s) => s.step);
  const reset = useValidatorStore((s) => s.reset);
  const applyAllSuggestions = useValidatorStore((s) => s.applyAllSuggestions);
  const fixableCount = useValidatorStore((s) =>
    s.validationResult?.cells.filter((c) => c.suggestion).length ?? 0,
  );

  return (
    <Layout>
      {step === 'upload' && <FileUpload />}

      {step === 'mapping' && <ColumnMapping />}

      {step === 'validating' && <ValidationProgress />}

      {step === 'results' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold">{t('results.title')}</h2>
            <div className="flex gap-3">
              {fixableCount > 0 && (
                <button
                  onClick={applyAllSuggestions}
                  className="px-4 py-2 bg-warning-500 text-white rounded-lg text-sm font-medium hover:bg-warning-600 transition-colors"
                >
                  {t('results.fixAll', { count: fixableCount })}
                </button>
              )}
              <button
                onClick={reset}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                {t('results.newFile')}
              </button>
              <ExportButton />
            </div>
          </div>
          <SummaryDashboard />
          <ResultsTable />
        </div>
      )}
    </Layout>
  );
}

export default App;
