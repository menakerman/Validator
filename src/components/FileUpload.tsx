import { useTranslation } from 'react-i18next';
import { useFileUpload } from '../hooks/useFileUpload';
import { useValidatorStore } from '../stores/validatorStore';

export function FileUpload() {
  const { t } = useTranslation();
  const parseFile = useValidatorStore((s) => s.parseFile);
  const storeError = useValidatorStore((s) => s.error);

  const {
    isDragging,
    error: uploadError,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    inputRef,
    openFilePicker,
  } = useFileUpload((file) => parseFile(file));

  const error = uploadError || storeError;

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-semibold text-center mb-6">{t('upload.title')}</h2>

      <div
        role="button"
        tabIndex={0}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={openFilePicker}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openFilePicker(); }}
        className={`
          relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-primary-500 bg-primary-50 scale-[1.02]'
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }
        `}
      >
        <div className="mb-4">
          <svg className="w-16 h-16 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>

        <p className="text-lg font-medium text-gray-700 mb-2">
          {t('upload.dropzone')}
        </p>
        <p className="text-gray-400 mb-4">{t('upload.or')}</p>
        <span className="inline-block px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
          {t('upload.browse')}
        </span>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="mt-4 text-center text-sm text-gray-500 space-y-1">
        <p>{t('upload.formats')}</p>
        <p>{t('upload.maxSize')}</p>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-error-50 border border-error-200 rounded-lg text-error-700 text-center text-sm">
          {t(error)}
        </div>
      )}
    </div>
  );
}
