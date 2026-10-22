import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useFileUpload } from '../hooks/useFileUpload';
import { useValidatorStore } from '../stores/validatorStore';
import { RecentActions } from './RecentActions';

interface DropCardProps {
  variant: 'validate' | 'kehilanet' | 'importLog';
  title: string;
  description: string;
  icon: ReactNode;
  badge?: string;
  onFile: (file: File) => void;
}

function DropCard({ variant, title, description, icon, badge, onFile }: DropCardProps) {
  const { t } = useTranslation();
  const {
    isDragging,
    error,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    inputRef,
    openFilePicker,
  } = useFileUpload(onFile);

  const emphasized = variant === 'kehilanet';

  return (
    <div
      role="button"
      tabIndex={0}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={openFilePicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') openFilePicker();
      }}
      className={`
        group relative flex flex-col items-center text-center rounded-2xl border-2 border-dashed
        p-8 cursor-pointer transition-all duration-200
        ${isDragging
          ? 'border-primary-500 bg-primary-50 scale-[1.02] shadow-lg'
          : emphasized
            ? 'border-primary-300 bg-gradient-to-b from-primary-50/70 to-white hover:border-primary-400 hover:shadow-md'
            : 'border-gray-300 bg-white hover:border-primary-400 hover:bg-gray-50'
        }
      `}
    >
      {badge && (
        <span className="absolute top-3 end-3 bg-primary-600 text-white text-[11px] font-medium px-2.5 py-1 rounded-full">
          {badge}
        </span>
      )}

      <div
        className={`mb-4 w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
          emphasized
            ? 'bg-primary-100 text-primary-600 group-hover:bg-primary-600 group-hover:text-white'
            : 'bg-slate-100 text-slate-500 group-hover:bg-primary-100 group-hover:text-primary-600'
        }`}
      >
        {icon}
      </div>

      <h3 className="text-lg font-semibold text-gray-800 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-xs leading-relaxed">{description}</p>

      <span
        className={`inline-block px-5 py-2.5 rounded-lg font-medium text-sm transition-colors ${
          emphasized
            ? 'bg-primary-600 text-white group-hover:bg-primary-700'
            : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
        }`}
      >
        {t('upload.browse')}
      </span>
      <p className="mt-3 text-xs text-gray-400">{t('upload.dropHint')}</p>

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      {error && (
        <p className="mt-3 text-xs text-error-600">{t(error)}</p>
      )}
    </div>
  );
}

interface ToolCardProps {
  title: string;
  description: string;
  action: string;
  hint?: string;
  icon: ReactNode;
  onOpen: () => void;
  /** Set for tools that accept dropped files; receives the dropped file names. */
  onDropNames?: (names: string[]) => void;
}

// Entry card for tools that don't parse an uploaded Excel file, so they skip
// the validation in useFileUpload. Some of them (the regex builder) still use
// the names of whatever is dropped on the card.
function ToolCard({ title, description, action, hint, icon, onOpen, onDropNames }: ToolCardProps) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onDragEnter={(e) => {
        if (!onDropNames) return;
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragOver={(e) => onDropNames && e.preventDefault()}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        if (!onDropNames) return;
        e.preventDefault();
        setIsDragging(false);
        onDropNames([...e.dataTransfer.files].map((f) => f.name));
      }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
      className={`
        group relative flex flex-col items-center text-center rounded-2xl border-2 border-dashed
        p-8 cursor-pointer transition-all duration-200
        ${isDragging
          ? 'border-primary-500 bg-primary-50 scale-[1.02] shadow-lg'
          : 'border-gray-300 bg-white hover:border-primary-400 hover:bg-gray-50'
        }
      `}
    >
      <div className="mb-4 w-14 h-14 rounded-2xl flex items-center justify-center bg-slate-100 text-slate-500 transition-colors group-hover:bg-primary-100 group-hover:text-primary-600">
        {icon}
      </div>

      <h3 className="text-lg font-semibold text-gray-800 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-500 mb-5 max-w-xs leading-relaxed">{description}</p>

      <span className="inline-block px-5 py-2.5 rounded-lg font-medium text-sm bg-slate-100 text-slate-700 transition-colors group-hover:bg-slate-200">
        {action}
      </span>
      {hint && <p className="mt-3 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

export function FileUpload() {
  const { t } = useTranslation();
  const parseFile = useValidatorStore((s) => s.parseFile);
  const parseKehilanet = useValidatorStore((s) => s.parseKehilanet);
  const openImportLog = useValidatorStore((s) => s.openImportLog);
  const openRegexBuilder = useValidatorStore((s) => s.openRegexBuilder);
  const openProtocol = useValidatorStore((s) => s.openProtocol);
  const storeError = useValidatorStore((s) => s.error);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-gray-800">{t('upload.title')}</h2>
        <p className="text-gray-500 mt-2">{t('upload.subtitle')}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <DropCard
          variant="kehilanet"
          title={t('upload.kehilanet.title')}
          description={t('upload.kehilanet.description')}
          badge={t('upload.kehilanet.badge')}
          onFile={parseKehilanet}
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
            </svg>
          }
        />
        <DropCard
          variant="validate"
          title={t('upload.validate.title')}
          description={t('upload.validate.description')}
          onFile={parseFile}
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          }
        />
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <DropCard
          variant="importLog"
          title={t('upload.importLog.title')}
          description={t('upload.importLog.description')}
          onFile={(file) => openImportLog(file)}
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
            </svg>
          }
        />
        <ToolCard
          title={t('upload.regex.title')}
          description={t('upload.regex.description')}
          action={t('upload.regex.open')}
          hint={t('upload.regex.hint')}
          onOpen={() => openRegexBuilder([])}
          onDropNames={openRegexBuilder}
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M14.25 9.75 16.5 12l-2.25 2.25m-4.5 0L7.5 12l2.25-2.25M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" />
            </svg>
          }
        />
        <ToolCard
          title={t('upload.protocol.title')}
          description={t('upload.protocol.description')}
          action={t('upload.protocol.open')}
          hint={t('upload.protocol.hint')}
          onOpen={openProtocol}
          icon={
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0a8.95 8.95 0 0 0 4.5-1.207M12 21a8.95 8.95 0 0 1-4.5-1.207M3.6 9h16.8M3.6 15h16.8M12 3c2.1 2.4 3.15 5.4 3.15 9S14.1 18.6 12 21c-2.1-2.4-3.15-5.4-3.15-9S9.9 5.4 12 3Z" />
            </svg>
          }
        />
      </div>

      <p className="text-center text-xs text-gray-400 mt-5">{t('upload.formats')}</p>

      {storeError && (
        <div className="mt-4 p-3 bg-error-50 border border-error-200 rounded-lg text-error-700 text-center text-sm">
          {t(storeError)}
        </div>
      )}

      <RecentActions />
    </div>
  );
}
