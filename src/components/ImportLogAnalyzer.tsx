import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useValidatorStore } from '../stores/validatorStore';
import { useFileUpload } from '../hooks/useFileUpload';
import {
  parseImportLogFile,
  parseChildrenImportFile,
  analyzeImportLog,
  buildCorrectedChildren,
  exportCorrectedChildrenFile,
  type ImportLogRow,
  type ChildrenFile,
  type FixResult,
} from '../utils/importLog';

// A compact drag-and-drop / browse control for a single file.
function InlineDrop({
  title,
  hint,
  fileName,
  done,
  onFile,
}: {
  title: string;
  hint: string;
  fileName: string;
  done: boolean;
  onFile: (file: File) => void;
}) {
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

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={openFilePicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') openFilePicker();
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`flex items-center gap-3 rounded-xl border-2 border-dashed p-4 cursor-pointer transition-colors ${
        isDragging
          ? 'border-primary-500 bg-primary-50'
          : done
            ? 'border-valid-300 bg-valid-50'
            : 'border-gray-300 bg-white hover:border-primary-400 hover:bg-gray-50'
      }`}
    >
      <div
        className={`w-10 h-10 shrink-0 rounded-lg flex items-center justify-center ${
          done ? 'bg-valid-100 text-valid-600' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {done ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
          </svg>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-800">{title}</p>
        <p className="truncate text-xs text-gray-500">{done && fileName ? fileName : hint}</p>
        {error && <p className="text-xs text-error-600">{t(error)}</p>}
      </div>
      <span className="shrink-0 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
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
  );
}

const ACTION_BADGE: Record<string, string> = {
  exclude: 'bg-error-100 text-error-700',
  repairPhone: 'bg-warning-100 text-warning-700',
};

export function ImportLogAnalyzer() {
  const { t } = useTranslation();
  const reset = useValidatorStore((s) => s.reset);
  const initialLog = useValidatorStore((s) => s.importLogFile);

  const [logRows, setLogRows] = useState<ImportLogRow[] | null>(null);
  const [logName, setLogName] = useState('');
  const [child, setChild] = useState<ChildrenFile | null>(null);
  const [childName, setChildName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [codeFilter, setCodeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [fix, setFix] = useState<FixResult | null>(null);

  const loadLog = async (file: File) => {
    setError(null);
    try {
      const rows = await parseImportLogFile(file);
      setLogRows(rows);
      setLogName(file.name);
      setFix(null);
      setCodeFilter('all');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const loadChild = async (file: File) => {
    setError(null);
    try {
      const parsed = await parseChildrenImportFile(file);
      setChild(parsed);
      setChildName(file.name);
      setFix(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Parse the file dropped on the entry card, exactly once.
  const consumed = useRef(false);
  useEffect(() => {
    if (initialLog && !consumed.current) {
      consumed.current = true;
      void loadLog(initialLog);
    }
  }, [initialLog]);

  const analysis = useMemo(() => (logRows ? analyzeImportLog(logRows) : null), [logRows]);

  const filtered = useMemo(() => {
    if (!logRows) return [];
    const q = search.trim();
    return logRows.filter(
      (r) =>
        (codeFilter === 'all' || r.code === codeFilter) &&
        (!q || r.name.includes(q) || r.id.includes(q) || String(r.rowNumber ?? '').includes(q)),
    );
  }, [logRows, codeFilter, search]);

  const handleFix = async () => {
    if (!logRows || !child) return;
    setBusy(true);
    try {
      const result = buildCorrectedChildren(logRows, child);
      setFix(result);
      const base = (childName || logName).replace(/\.[^.]+$/, '');
      await exportCorrectedChildrenFile(result, base);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">{t('importLog.title')}</h2>
          <p className="text-sm text-gray-500">{t('importLog.subtitle')}</p>
        </div>
        <button
          onClick={reset}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          {t('results.newFile')}
        </button>
      </div>

      {!logRows && (
        <div className="mx-auto max-w-xl">
          <InlineDrop
            title={t('importLog.dropLog.title')}
            hint={t('importLog.dropLog.hint')}
            fileName={logName}
            done={false}
            onFile={loadLog}
          />
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-error-200 bg-error-50 p-3 text-center text-sm text-error-700">
          {t(error)}
        </div>
      )}

      {logRows && analysis && (
        <div className="space-y-6">
          {/* Summary cards per error code */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs text-gray-500">{t('importLog.totalErrors')}</p>
              <p className="mt-1 text-2xl font-semibold text-gray-800">{analysis.total}</p>
              <p className="mt-1 truncate text-xs text-gray-400">{logName}</p>
            </div>
            {analysis.byCode.map((c) => {
              const pct = Math.round((c.count / analysis.total) * 100);
              return (
                <button
                  key={c.code}
                  onClick={() => setCodeFilter(codeFilter === c.code ? 'all' : c.code)}
                  className={`rounded-xl border p-4 text-start transition-colors ${
                    codeFilter === c.code
                      ? 'border-primary-400 bg-primary-50'
                      : 'border-gray-200 bg-white hover:border-primary-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-2xl font-semibold text-gray-800">{c.count}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ACTION_BADGE[c.action]}`}>
                      {t(`importLog.action.${c.action}`)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{c.description || c.code}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-gray-400">
                    {c.code} · {pct}%
                  </p>
                </button>
              );
            })}
          </div>

          {/* Fix panel */}
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-lg font-semibold text-gray-800">{t('importLog.fix.title')}</h3>
            <p className="mb-4 text-sm text-gray-500">{t('importLog.fix.description')}</p>
            <InlineDrop
              title={t('importLog.dropChildren.title')}
              hint={t('importLog.dropChildren.hint')}
              fileName={childName}
              done={!!child}
              onFile={loadChild}
            />
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleFix}
                disabled={!child || busy}
                className="inline-flex items-center gap-2 rounded-lg bg-valid-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-valid-700 disabled:opacity-50"
              >
                {t('importLog.fix.button')}
              </button>
              {!child && <span className="text-xs text-gray-400">{t('importLog.fix.needChildren')}</span>}
            </div>

            {fix && (
              <div className="mt-4 rounded-lg border border-valid-200 bg-valid-50 p-4 text-sm text-gray-700">
                <p className="font-medium text-valid-800">{t('importLog.fix.done')}</p>
                <ul className="mt-2 space-y-1">
                  <li>{t('importLog.fix.statRemaining', { count: fix.remainingRows })}</li>
                  <li>{t('importLog.fix.statRemoved', { count: fix.removedRows })}</li>
                  <li>{t('importLog.fix.statRepaired', { count: fix.repaired })}</li>
                  <li>{t('importLog.fix.statMatched', { matched: fix.matched, total: fix.total })}</li>
                </ul>
                {fix.unmatched > 0 && (
                  <p className="mt-2 text-warning-700">
                    {t('importLog.fix.unmatched', { count: fix.unmatched })}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Error table */}
          <div className="rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('importLog.searchPlaceholder')}
                className="flex-1 min-w-[12rem] rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              />
              <select
                value={codeFilter}
                onChange={(e) => setCodeFilter(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">{t('importLog.allCodes', { count: analysis.total })}</option>
                {analysis.byCode.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} ({c.count})
                  </option>
                ))}
              </select>
              <span className="text-xs text-gray-400">
                {t('importLog.showing', { shown: filtered.length, total: analysis.total })}
              </span>
            </div>
            <div className="max-h-[26rem] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-start text-xs text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">{t('importLog.col.row')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('importLog.col.id')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('importLog.col.name')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('importLog.col.error')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={`${r.rowNumber}-${r.id}-${i}`} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.rowNumber ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs text-gray-600">{r.id || '—'}</td>
                      <td className="px-3 py-2 text-gray-800">{r.name || '—'}</td>
                      <td className="px-3 py-2">
                        <span className="text-gray-700">{r.description || r.code}</span>
                        <span className="ms-2 font-mono text-[11px] text-gray-400">{r.code}</span>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-gray-400">
                        {t('results.table.noResults')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
