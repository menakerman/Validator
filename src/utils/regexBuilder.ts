// Infers a named-group regular expression from a set of similar file names.
//
// The names are split into runs of digits / letters / single separator chars.
// When every name yields the same run structure, each position is compared
// across the whole set: positions that differ become capture groups, positions
// that are identical stay literal — except date-looking numbers, which become
// month/year/day groups even when the sample happens to share one date.

const ALPHA = 'A-Za-z\\u0590-\\u05FF';

export type TokenClass = 'digits' | 'alpha' | 'other';
export type SegmentKind = 'literal' | 'group';
export type DateRole = 'day' | 'month' | 'year';

export interface Token {
  value: string;
  cls: TokenClass;
}

export interface Segment {
  cls: TokenClass;
  kind: SegmentKind;
  /** Group name, empty for literal segments. */
  name: string;
  /** Pattern used when the segment is a group (kept even while literal). */
  pattern: string;
  /** Distinct values seen at this position, in order of appearance. */
  values: string[];
  varies: boolean;
  literal: string;
  role?: DateRole;
}

export interface AnalyzeOptions {
  /** Pin repeating segments to the observed length (\d{9}) instead of \d+. */
  strictLengths?: boolean;
}

export interface AnalyzeResult {
  segments: Segment[];
  /** False when the names did not share a structure and a loose fallback was used. */
  structural: boolean;
  warning?: string;
}

export interface ComposeOptions {
  anchors?: boolean;
}

export interface NameMatch {
  name: string;
  matched: boolean;
  /** Captured group name → value, empty when the name did not match. */
  groups: Record<string, string>;
  /** Character ranges of each capture, for highlighting. */
  spans: { name: string; start: number; end: number }[];
}

const SEPARATORS = new Set(['-', '_', '.', '/']);
const NAME_POOL: Record<TokenClass, string[]> = {
  digits: ['id', 'number', 'code'],
  alpha: ['name', 'type', 'category'],
  other: ['separator', 'symbol'],
};

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function tokenize(name: string): Token[] {
  const re = new RegExp(`\\d+|[${ALPHA}]+|[^\\d${ALPHA}]`, 'g');
  const alphaRe = new RegExp(`^[${ALPHA}]`);
  const tokens: Token[] = [];
  for (const match of name.matchAll(re)) {
    const value = match[0];
    const cls: TokenClass = /^\d/.test(value) ? 'digits' : alphaRe.test(value) ? 'alpha' : 'other';
    tokens.push({ value, cls });
  }
  return tokens;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function lengthOf(segment: Segment): number {
  return Math.max(...segment.values.map((v) => v.length));
}

function sameLength(segment: Segment): number | null {
  const lengths = unique(segment.values.map((v) => String(v.length)));
  return lengths.length === 1 ? Number(lengths[0]) : null;
}

function allNumbersWithin(segment: Segment, min: number, max: number): boolean {
  return segment.values.every((v) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min && n <= max;
  });
}

function inferPattern(segment: Segment, strict = false): string {
  if (segment.cls === 'other') {
    const chars = unique(segment.values);
    return chars.length === 1
      ? escapeRegex(chars[0])
      : `[${chars.map((c) => c.replace(/[\]\\^-]/g, '\\$&')).join('')}]`;
  }
  const base = segment.cls === 'digits' ? '\\d' : `[${ALPHA}]`;
  if (!strict) return `${base}+`;
  const fixed = sameLength(segment);
  if (fixed !== null) return `${base}{${fixed}}`;
  const lengths = segment.values.map((v) => v.length);
  return `${base}{${Math.min(...lengths)},${Math.max(...lengths)}}`;
}

function rolePattern(role: DateRole, segment: Segment): string {
  if (role === 'month') return '0?[1-9]|1[0-2]';
  if (role === 'day') return '0?[1-9]|[12]\\d|3[01]';
  return lengthOf(segment) === 4 ? '\\d{4}' : '\\d{2}';
}

/** A date part is 1–2 digits (day/month/short year) or exactly 4 (full year). */
function plausibleDatePart(segment: Segment): boolean {
  const len = lengthOf(segment);
  return len <= 2 || len === 4;
}

/** Groups of digit segments joined by a single separator, e.g. `07-26`. */
function findNumericRuns(segments: Segment[]): number[][] {
  const runs: number[][] = [];
  let current: number[] = [];

  const flush = () => {
    if (current.length > 1) runs.push(current);
    current = [];
  };

  for (let i = 0; i < segments.length; i++) {
    if (segments[i].cls !== 'digits') continue;
    const prev = current[current.length - 1];
    const joined =
      prev !== undefined &&
      i - prev === 2 &&
      segments[i - 1].cls === 'other' &&
      !segments[i - 1].varies &&
      SEPARATORS.has(segments[i - 1].literal);
    if (joined) {
      current.push(i);
    } else {
      flush();
      current = [i];
    }
  }
  flush();
  return runs;
}

function assignDateRoles(segments: Segment[]): void {
  for (const run of findNumericRuns(segments)) {
    // Drop leading/trailing numbers that cannot be a date part (an id, a serial).
    const trimmed = [...run];
    while (trimmed.length && !plausibleDatePart(segments[trimmed[0]])) trimmed.shift();
    while (trimmed.length && !plausibleDatePart(segments[trimmed[trimmed.length - 1]])) trimmed.pop();
    if (trimmed.length < 2) continue;

    const parts = trimmed.slice(-3).map((i) => segments[i]);
    const lens = parts.map(lengthOf);
    let roles: DateRole[] | null = null;

    if (parts.length === 3) {
      if (lens[0] === 4 && allNumbersWithin(parts[1], 1, 12) && allNumbersWithin(parts[2], 1, 31)) {
        roles = ['year', 'month', 'day']; // 2026-07-26
      } else if (lens[2] === 4 || lens[2] === 2) {
        if (allNumbersWithin(parts[0], 1, 12) && !allNumbersWithin(parts[1], 1, 12)) {
          roles = ['month', 'day', 'year']; // 07-26-26
        } else if (allNumbersWithin(parts[1], 1, 12) && allNumbersWithin(parts[0], 1, 31)) {
          roles = ['day', 'month', 'year']; // 26-07-26
        }
      }
    } else if (lens[0] === 4 && allNumbersWithin(parts[1], 1, 12)) {
      roles = ['year', 'month']; // 2026-07
    } else if (lens[0] <= 2 && (lens[1] === 2 || lens[1] === 4) && allNumbersWithin(parts[0], 1, 12)) {
      roles = ['month', 'year']; // 07-26
    }

    if (!roles) continue;
    const targets = trimmed.slice(-roles.length);
    targets.forEach((segIndex, i) => {
      segments[segIndex].role = roles![i];
    });
  }
}

function assignNames(segments: Segment[]): void {
  const used = new Set<string>();
  const poolCursor: Record<TokenClass, number> = { digits: 0, alpha: 0, other: 0 };

  const claim = (candidate: string): string => {
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
    let n = 2;
    while (used.has(`${candidate}${n}`)) n++;
    used.add(`${candidate}${n}`);
    return `${candidate}${n}`;
  };

  for (const segment of segments) {
    if (segment.kind !== 'group') continue;
    if (segment.role) {
      segment.name = claim(segment.role);
      continue;
    }
    const pool = NAME_POOL[segment.cls];
    const cursor = poolCursor[segment.cls]++;
    segment.name = claim(pool[cursor] ?? `${pool[0]}${cursor + 1}`);
  }
}

function makeSegment(values: string[], cls: TokenClass): Segment {
  const distinct = unique(values);
  return {
    cls,
    kind: 'literal',
    name: '',
    pattern: '',
    values: distinct,
    varies: distinct.length > 1,
    literal: distinct[0] ?? '',
  };
}

/** Names with different shapes: keep the shared prefix/suffix, capture the middle. */
function buildFallbackSegments(names: string[], options: AnalyzeOptions): Segment[] {
  const shortest = names.reduce((a, b) => (a.length <= b.length ? a : b));

  let prefix = 0;
  while (prefix < shortest.length && names.every((n) => n[prefix] === shortest[prefix])) prefix++;

  let suffix = 0;
  while (
    suffix < shortest.length - prefix &&
    names.every((n) => n[n.length - 1 - suffix] === shortest[shortest.length - 1 - suffix])
  ) {
    suffix++;
  }

  const middles = names.map((n) => n.slice(prefix, n.length - suffix));
  const segments: Segment[] = [];

  if (prefix > 0) {
    const segment = makeSegment([shortest.slice(0, prefix)], 'other');
    segment.pattern = escapeRegex(segment.literal);
    segments.push(segment);
  }

  const cls: TokenClass = middles.every((m) => /^\d+$/.test(m))
    ? 'digits'
    : middles.every((m) => new RegExp(`^[${ALPHA}]+$`).test(m))
      ? 'alpha'
      : 'other';
  const middle = makeSegment(middles, cls);
  middle.kind = 'group';
  middle.pattern = cls === 'other' ? '.+' : inferPattern(middle, options.strictLengths);
  middle.name = 'value';
  segments.push(middle);

  if (suffix > 0) {
    const segment = makeSegment([shortest.slice(shortest.length - suffix)], 'other');
    segment.pattern = escapeRegex(segment.literal);
    segments.push(segment);
  }

  return segments;
}

export function analyzeNames(rawNames: string[], options: AnalyzeOptions = {}): AnalyzeResult {
  const names = rawNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return { segments: [], structural: true };

  const tokenLists = names.map(tokenize);
  const reference = tokenLists[0];
  const structural = tokenLists.every(
    (tokens) =>
      tokens.length === reference.length && tokens.every((t, i) => t.cls === reference[i].cls),
  );

  if (!structural) {
    return {
      segments: buildFallbackSegments(names, options),
      structural: false,
      warning: 'regex.warn.fallback',
    };
  }

  const segments = reference.map((token, i) =>
    makeSegment(
      tokenLists.map((tokens) => tokens[i].value),
      token.cls,
    ),
  );

  assignDateRoles(segments);

  // With a single sample nothing "varies", so treat longer numbers as the id.
  const single = names.length === 1;
  for (const segment of segments) {
    if (segment.role) {
      segment.kind = 'group';
      segment.pattern = rolePattern(segment.role, segment);
      continue;
    }
    segment.pattern = inferPattern(segment, options.strictLengths);
    const looksLikeId = single && segment.cls === 'digits' && segment.literal.length >= 3;
    segment.kind = segment.varies || looksLikeId ? 'group' : 'literal';
  }

  assignNames(segments);
  return { segments, structural: true };
}

export function composeRegex(segments: Segment[], options: ComposeOptions = {}): string {
  const body = segments
    .map((segment) => {
      if (segment.kind === 'group') return `(?<${segment.name}>${segment.pattern})`;
      if (!segment.varies) return escapeRegex(segment.literal);
      return segment.pattern.includes('|') ? `(?:${segment.pattern})` : segment.pattern;
    })
    .join('');
  const anchors = options.anchors !== false;
  return anchors ? `^${body}$` : body;
}

export function testNames(pattern: string, names: string[], ignoreCase = false): NameMatch[] {
  let re: RegExp;
  try {
    re = new RegExp(pattern, ignoreCase ? 'di' : 'd');
  } catch {
    return names.map((name) => ({ name, matched: false, groups: {}, spans: [] }));
  }

  return names.map((name) => {
    const match = re.exec(name);
    if (!match) return { name, matched: false, groups: {}, spans: [] };

    const groups = { ...(match.groups ?? {}) } as Record<string, string>;
    const indices = (match as RegExpExecArray & { indices?: { groups?: Record<string, [number, number] | undefined> } })
      .indices?.groups ?? {};
    const spans = Object.entries(groups)
      .map(([groupName, value]) => {
        const range = indices[groupName];
        const start = range ? range[0] : name.indexOf(value ?? '');
        return { name: groupName, start, end: range ? range[1] : start + (value?.length ?? 0) };
      })
      .filter((s) => s.start >= 0)
      .sort((a, b) => a.start - b.start);

    return { name, matched: true, groups, spans };
  });
}

/** Group name accepted by JavaScript / .NET named captures. */
export function isValidGroupName(name: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);
}

/** Splits a pattern into pieces so the UI can colour each named group. */
export function highlightRegex(
  segments: Segment[],
  options: ComposeOptions = {},
): { text: string; group?: string }[] {
  const parts: { text: string; group?: string }[] = [];
  const anchors = options.anchors !== false;
  if (anchors) parts.push({ text: '^' });
  for (const segment of segments) {
    if (segment.kind === 'group') {
      parts.push({ text: `(?<${segment.name}>${segment.pattern})`, group: segment.name });
    } else if (!segment.varies) {
      parts.push({ text: escapeRegex(segment.literal) });
    } else {
      parts.push({ text: segment.pattern.includes('|') ? `(?:${segment.pattern})` : segment.pattern });
    }
  }
  if (anchors) parts.push({ text: '$' });
  return parts;
}
