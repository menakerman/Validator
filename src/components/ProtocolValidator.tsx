import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useValidatorStore } from '../stores/validatorStore';
import {
  buildCurl,
  fetchProtocol,
  isValidId,
  prettyJson,
  type ProtocolResponse,
} from '../utils/kehilanetProtocol';

const STORAGE_KEY = 'kehilanet_protocol_ids';

interface StoredIds {
  communityId: string;
  protocolId: string;
}

function loadIds(): StoredIds {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      communityId: String(parsed?.communityId ?? ''),
      protocolId: String(parsed?.protocolId ?? ''),
    };
  } catch {
    return { communityId: '', protocolId: '' };
  }
}

function saveIds(ids: StoredIds): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // ignore storage errors (private mode, quota, ...)
  }
}

export function ProtocolValidator() {
  const { t } = useTranslation();
  const reset = useValidatorStore((s) => s.reset);

  const [ids, setIds] = useState<StoredIds>(loadIds);
  const [isRunning, setIsRunning] = useState(false);
  const [response, setResponse] = useState<ProtocolResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState<'body' | 'curl' | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canRun = isValidId(ids.communityId) && isValidId(ids.protocolId);
  const pretty = useMemo(() => (response ? prettyJson(response.body) : null), [response]);
  const curl = useMemo(() => buildCurl(ids), [ids]);

  const run = async () => {
    if (!canRun || isRunning) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setError(null);
    setResponse(null);
    saveIds(ids);

    try {
      const result = await fetchProtocol(ids, controller.signal);
      setResponse(result);
      setShowRaw(prettyJson(result.body) === null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError((err as Error).message);
    } finally {
      if (abortRef.current === controller) setIsRunning(false);
    }
  };

  const copy = async (what: 'body' | 'curl', text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1600);
  };

  const idField = (key: keyof StoredIds) => {
    const value = ids[key];
    const invalid = value.trim() !== '' && !isValidId(value);
    return (
      <div key={key}>
        <label className="mb-1.5 block text-sm font-medium text-gray-700" htmlFor={key}>
          {t(`protocol.form.${key}`)}
        </label>
        <input
          id={key}
          dir="ltr"
          inputMode="numeric"
          value={value}
          onChange={(e) => setIds({ ...ids, [key]: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run();
          }}
          placeholder={t(`protocol.form.${key}Placeholder`)}
          className={`w-full rounded-lg border px-3 py-2 font-mono text-sm outline-none focus:ring-2 ${
            invalid
              ? 'border-error-300 focus:border-error-500 focus:ring-error-500'
              : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
          }`}
        />
        {invalid && <p className="mt-1 text-xs text-error-600">{t('protocol.form.digitsOnly')}</p>}
      </div>
    );
  };

  const ok = response ? response.status >= 200 && response.status < 300 : false;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">{t('protocol.title')}</h2>
          <p className="text-sm text-gray-500">{t('protocol.subtitle')}</p>
        </div>
        <button
          onClick={reset}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          {t('results.newFile')}
        </button>
      </div>

      {/* Request */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h3 className="mb-4 font-semibold text-gray-800">{t('protocol.form.title')}</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {idField('communityId')}
          {idField('protocolId')}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={run}
            disabled={!canRun || isRunning}
            className="rounded-lg bg-primary-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
          >
            {isRunning ? t('protocol.form.running') : t('protocol.form.run')}
          </button>
          <p className="text-xs text-gray-400">{t('protocol.form.hint')}</p>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-error-200 bg-error-50 p-3 text-sm text-error-700">
            {t(error)}
          </p>
        )}
      </div>

      {/* Response */}
      {response && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-gray-800">{t('protocol.result.title')}</h3>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  ok ? 'bg-valid-100 text-valid-700' : 'bg-error-100 text-error-700'
                }`}
              >
                {t('protocol.result.status', { status: response.status })}
              </span>
              <span className="text-xs text-gray-400">
                {t('protocol.result.duration', { ms: response.durationMs })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {pretty && (
                <button
                  onClick={() => setShowRaw(!showRaw)}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                >
                  {showRaw ? t('protocol.result.showPretty') : t('protocol.result.showRaw')}
                </button>
              )}
              <button
                onClick={() => copy('body', response.body)}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
              >
                {copied === 'body' ? t('protocol.result.copied') : t('protocol.result.copy')}
              </button>
            </div>
          </div>

          <div className="p-4">
            {!pretty && (
              <p className="mb-3 rounded-lg border border-warning-200 bg-warning-50 p-2.5 text-xs text-warning-700">
                {t('protocol.result.notJson')}
              </p>
            )}
            {response.body.trim() === '' ? (
              <p className="text-sm text-gray-500">{t('protocol.result.empty')}</p>
            ) : (
              <pre
                dir="ltr"
                className="max-h-[32rem] overflow-auto rounded-lg bg-slate-900 p-4 font-mono text-xs whitespace-pre-wrap text-slate-200"
              >
                {showRaw || !pretty ? response.body : pretty}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Equivalent curl */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-800">{t('protocol.curl.title')}</h3>
            <p className="text-sm text-gray-500">{t('protocol.curl.description')}</p>
          </div>
          <button
            onClick={() => copy('curl', curl)}
            className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            {copied === 'curl' ? t('protocol.result.copied') : t('protocol.result.copy')}
          </button>
        </div>
        <pre
          dir="ltr"
          className="overflow-x-auto rounded-lg bg-slate-900 p-4 font-mono text-xs text-slate-300"
        >
          {curl}
        </pre>
      </div>
    </div>
  );
}
