import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useValidatorStore } from '../stores/validatorStore';
import {
  analyzeNames,
  composeRegex,
  highlightRegex,
  isValidGroupName,
  testNames,
  type Segment,
} from '../utils/regexBuilder';

const SAMPLE_NAMES = ['240000101-07-26.pdf', '240000102-07-26.pdf', '240000103-07-26.pdf'];

// One colour per capture group, shared by the pattern, the editor and the matches.
const GROUP_COLORS = [
  { code: 'text-sky-300', chip: 'bg-sky-100 text-sky-800 border-sky-200', mark: 'bg-sky-200/70 text-sky-900' },
  { code: 'text-amber-300', chip: 'bg-amber-100 text-amber-800 border-amber-200', mark: 'bg-amber-200/70 text-amber-900' },
  { code: 'text-violet-300', chip: 'bg-violet-100 text-violet-800 border-violet-200', mark: 'bg-violet-200/70 text-violet-900' },
  { code: 'text-emerald-300', chip: 'bg-emerald-100 text-emerald-800 border-emerald-200', mark: 'bg-emerald-200/70 text-emerald-900' },
  { code: 'text-rose-300', chip: 'bg-rose-100 text-rose-800 border-rose-200', mark: 'bg-rose-200/70 text-rose-900' },
  { code: 'text-cyan-300', chip: 'bg-cyan-100 text-cyan-800 border-cyan-200', mark: 'bg-cyan-200/70 text-cyan-900' },
];

type Edit = Partial<Pick<Segment, 'name' | 'kind' | 'pattern'>>;

function splitNames(text: string): string[] {
  return text
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function RegexBuilder() {
  const { t } = useTranslation();
  const reset = useValidatorStore((s) => s.reset);
  const initialNames = useValidatorStore((s) => s.regexNames);

  const [namesText, setNamesText] = useState(() => initialNames.join('\n'));
  const [strictLengths, setStrictLengths] = useState(false);
  const [anchors, setAnchors] = useState(true);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [editedShape, setEditedShape] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  const names = useMemo(() => splitNames(namesText), [namesText]);
  const analysis = useMemo(
    () => analyzeNames(names, { strictLengths }),
    [names, strictLengths],
  );

  // Manual edits are indexed by segment, so they only apply while the inferred
  // shape is unchanged — a different name list starts from the fresh analysis.
  const segmentCount = analysis.segments.length;
  const activeEdits = useMemo(
    () => (editedShape === segmentCount ? edits : {}),
    [editedShape, segmentCount, edits],
  );

  const segments = useMemo(
    () => analysis.segments.map((segment, i) => ({ ...segment, ...activeEdits[i] })),
    [analysis.segments, activeEdits],
  );

  const groupIndex = useMemo(() => {
    const map = new Map<string, number>();
    segments.filter((s) => s.kind === 'group').forEach((s, i) => map.set(s.name, i));
    return map;
  }, [segments]);
  const colorOf = (name: string) => GROUP_COLORS[(groupIndex.get(name) ?? 0) % GROUP_COLORS.length];

  const regex = useMemo(() => composeRegex(segments, { anchors }), [segments, anchors]);
  const parts = useMemo(() => highlightRegex(segments, { anchors }), [segments, anchors]);

  const duplicate = findDuplicateGroup(segments);
  const invalid = segments.find((s) => s.kind === 'group' && !isValidGroupName(s.name));
  const nameError = invalid
    ? t('regex.errors.invalidName', { name: invalid.name })
    : duplicate
      ? t('regex.errors.duplicateName', { name: duplicate })
      : null;

  const compileError = regex && !nameError ? compile(regex) : null;
  const patternError = compileError ? t('regex.errors.invalidPattern', { message: compileError }) : null;

  const matches = nameError || patternError ? [] : testNames(regex, names, ignoreCase);
  const matchedCount = matches.filter((m) => m.matched).length;

  const addNames = (incoming: string[]) => {
    setNamesText((current) => {
      const existing = splitNames(current);
      const merged = [...existing, ...incoming.filter((n) => n && !existing.includes(n))];
      return merged.join('\n');
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addNames([...e.dataTransfer.files].map((f) => f.name));
  };

  const editSegment = (index: number, edit: Edit) => {
    setEdits({ ...activeEdits, [index]: { ...activeEdits[index], ...edit } });
    setEditedShape(segmentCount);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(regex);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const flags = ignoreCase ? 'gi' : 'g';

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800">{t('regex.title')}</h2>
          <p className="text-sm text-gray-500">{t('regex.subtitle')}</p>
        </div>
        <button
          onClick={reset}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          {t('results.newFile')}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* File names input */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-800">{t('regex.input.title')}</h3>
            <span className="text-xs text-gray-400">{t('regex.input.count', { count: names.length })}</span>
          </div>

          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`rounded-lg border-2 border-dashed transition-colors ${
              isDragging ? 'border-primary-500 bg-primary-50' : 'border-gray-300 bg-white'
            }`}
          >
            <textarea
              dir="ltr"
              value={namesText}
              onChange={(e) => setNamesText(e.target.value)}
              placeholder={SAMPLE_NAMES.join('\n')}
              spellCheck={false}
              rows={10}
              className="w-full resize-y rounded-lg bg-transparent p-3 font-mono text-sm text-gray-800 outline-none placeholder:text-gray-300"
            />
          </div>
          <p className="mt-2 text-xs text-gray-400">{t('regex.input.hint')}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => filesRef.current?.click()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
            >
              {t('regex.input.chooseFiles')}
            </button>
            <button
              onClick={() => folderRef.current?.click()}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              {t('regex.input.chooseFolder')}
            </button>
            <button
              onClick={() => setNamesText(SAMPLE_NAMES.join('\n'))}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              {t('regex.input.sample')}
            </button>
            {names.length > 0 && (
              <button
                onClick={() => setNamesText('')}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                {t('regex.input.clear')}
              </button>
            )}
          </div>

          <input
            ref={filesRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addNames([...(e.target.files ?? [])].map((f) => f.name));
              e.target.value = '';
            }}
          />
          <input
            ref={folderRef}
            type="file"
            multiple
            className="hidden"
            // Directory picking is Chromium/WebKit only and not in the DOM types.
            {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
            onChange={(e) => {
              addNames([...(e.target.files ?? [])].map((f) => f.name));
              e.target.value = '';
            }}
          />
        </div>

        {/* Generated pattern */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold text-gray-800">{t('regex.output.title')}</h3>
            <button
              onClick={copy}
              disabled={!regex || !!nameError}
              className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              {copied ? t('regex.output.copied') : t('regex.output.copy')}
            </button>
          </div>

          <div dir="ltr" className="overflow-x-auto rounded-lg bg-slate-900 p-4">
            {regex ? (
              <code className="whitespace-pre font-mono text-sm text-slate-400">
                <span className="text-slate-600">/</span>
                {parts.map((part, i) => (
                  <span key={i} className={part.group ? colorOf(part.group).code : 'text-slate-200'}>
                    {part.text}
                  </span>
                ))}
                <span className="text-slate-600">/{flags}</span>
              </code>
            ) : (
              <span className="font-mono text-sm text-slate-500">{t('regex.output.empty')}</span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
            {[
              { key: 'anchors', value: anchors, set: setAnchors },
              { key: 'ignoreCase', value: ignoreCase, set: setIgnoreCase },
              { key: 'strictLengths', value: strictLengths, set: setStrictLengths },
            ].map(({ key, value, set }) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(e) => set(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                {t(`regex.options.${key}`)}
              </label>
            ))}
          </div>

          {analysis.warning && (
            <p className="mt-3 rounded-lg border border-warning-200 bg-warning-50 p-2.5 text-xs text-warning-700">
              {t(analysis.warning)}
            </p>
          )}
          {(nameError || patternError) && (
            <p className="mt-3 rounded-lg border border-error-200 bg-error-50 p-2.5 text-xs text-error-700">
              {nameError ?? patternError}
            </p>
          )}
          {Object.keys(activeEdits).length > 0 && (
            <button
              onClick={() => setEdits({})}
              className="mt-3 text-xs text-primary-600 hover:underline"
            >
              {t('regex.groups.resetEdits')}
            </button>
          )}
        </div>
      </div>

      {/* Segment editor */}
      {segments.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="mb-1 font-semibold text-gray-800">{t('regex.groups.title')}</h3>
          <p className="mb-4 text-sm text-gray-500">{t('regex.groups.description')}</p>

          <div className="space-y-2">
            {segments.map((segment, i) => {
              const isGroup = segment.kind === 'group';
              const color = colorOf(segment.name);
              return (
                <div
                  key={i}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${
                    isGroup ? 'border-gray-200 bg-gray-50' : 'border-gray-100 bg-white'
                  }`}
                >
                  <code
                    dir="ltr"
                    className={`shrink-0 rounded-md border px-2 py-1 font-mono text-xs ${
                      isGroup ? color.chip : 'border-gray-200 bg-white text-gray-500'
                    }`}
                  >
                    {segment.values.slice(0, 3).join(' · ')}
                    {segment.values.length > 3 && ' …'}
                  </code>

                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={isGroup}
                      onChange={(e) =>
                        editSegment(i, {
                          kind: e.target.checked ? 'group' : 'literal',
                          name: segment.name || `group${i + 1}`,
                        })
                      }
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    {t('regex.groups.capture')}
                  </label>

                  {isGroup ? (
                    <>
                      <input
                        dir="ltr"
                        value={segment.name}
                        onChange={(e) => editSegment(i, { name: e.target.value.trim() })}
                        placeholder={t('regex.groups.name')}
                        className="w-36 rounded-lg border border-gray-300 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                      />
                      <input
                        dir="ltr"
                        value={segment.pattern}
                        onChange={(e) => editSegment(i, { pattern: e.target.value })}
                        placeholder={t('regex.groups.pattern')}
                        className="min-w-[10rem] flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500"
                      />
                    </>
                  ) : (
                    <span className="text-xs text-gray-400">{t('regex.groups.literal')}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Match results */}
      {matches.length > 0 && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 p-4">
            <h3 className="font-semibold text-gray-800">{t('regex.test.title')}</h3>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                matchedCount === matches.length
                  ? 'bg-valid-100 text-valid-700'
                  : 'bg-error-100 text-error-700'
              }`}
            >
              {t('regex.test.summary', { matched: matchedCount, total: matches.length })}
            </span>
          </div>
          <div className="max-h-[24rem] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2 text-start font-medium">{t('regex.test.name')}</th>
                  <th className="px-3 py-2 text-start font-medium">{t('regex.test.groups')}</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match, i) => (
                  <tr key={`${match.name}-${i}`} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2">
                      {match.matched ? (
                        <span className="text-valid-600">✓</span>
                      ) : (
                        <span className="text-error-600">✕</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <code dir="ltr" className="block font-mono text-xs text-gray-700">
                        {match.matched
                          ? highlightName(match.name, match.spans).map((piece, j) => (
                              <span
                                key={j}
                                className={piece.group ? `rounded px-0.5 ${colorOf(piece.group).mark}` : ''}
                              >
                                {piece.text}
                              </span>
                            ))
                          : match.name}
                      </code>
                    </td>
                    <td className="px-3 py-2">
                      {match.matched ? (
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(match.groups).map(([name, value]) => (
                            <span
                              key={name}
                              dir="ltr"
                              className={`rounded-md border px-2 py-0.5 font-mono text-[11px] ${colorOf(name).chip}`}
                            >
                              {name}: {value}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-error-600">{t('regex.test.unmatched')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function findDuplicateGroup(segments: Segment[]): string | null {
  const seen = new Set<string>();
  for (const segment of segments) {
    if (segment.kind !== 'group') continue;
    if (seen.has(segment.name)) return segment.name;
    seen.add(segment.name);
  }
  return null;
}

/** Returns the compilation error message, or null when the pattern is valid. */
function compile(pattern: string): string | null {
  try {
    new RegExp(pattern);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

// Splits a matched name into captured / uncaptured pieces for colouring.
function highlightName(
  name: string,
  spans: { name: string; start: number; end: number }[],
): { text: string; group?: string }[] {
  const pieces: { text: string; group?: string }[] = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue;
    if (span.start > cursor) pieces.push({ text: name.slice(cursor, span.start) });
    pieces.push({ text: name.slice(span.start, span.end), group: span.name });
    cursor = span.end;
  }
  if (cursor < name.length) pieces.push({ text: name.slice(cursor) });
  return pieces;
}
