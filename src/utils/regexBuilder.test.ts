import { describe, it, expect } from 'vitest';
import {
  analyzeNames,
  composeRegex,
  testNames,
  tokenize,
  isValidGroupName,
} from './regexBuilder';

const build = (names: string[], strictLengths = false) => {
  const { segments, structural, warning } = analyzeNames(names, { strictLengths });
  return { regex: composeRegex(segments), segments, structural, warning };
};

describe('tokenize', () => {
  it('splits into digit, letter and separator runs', () => {
    expect(tokenize('240000101-07-26.pdf').map((t) => t.value)).toEqual([
      '240000101', '-', '07', '-', '26', '.', 'pdf',
    ]);
  });
});

describe('analyzeNames', () => {
  it('builds the expected regex for payslip-style names', () => {
    const { regex, segments } = build([
      '240000101-07-26.pdf',
      '240000102-07-26.pdf',
      '240000103-07-26.pdf',
    ]);
    expect(regex).toBe('^(?<id>\\d+)-(?<month>0?[1-9]|1[0-2])-(?<year>\\d{2})\\.pdf$');
    expect(segments.filter((s) => s.kind === 'group').map((s) => s.name)).toEqual([
      'id', 'month', 'year',
    ]);
  });

  it('renaming a group is reflected in the composed regex', () => {
    const { segments } = analyzeNames(['240000101-07-26.pdf', '240000102-07-26.pdf']);
    segments[0].name = 'workerid';
    expect(composeRegex(segments)).toBe(
      '^(?<workerid>\\d+)-(?<month>0?[1-9]|1[0-2])-(?<year>\\d{2})\\.pdf$',
    );
  });

  it('pins lengths when strict mode is on', () => {
    const { regex } = build(['240000101-07-26.pdf', '240000102-07-26.pdf'], true);
    expect(regex).toBe('^(?<id>\\d{9})-(?<month>0?[1-9]|1[0-2])-(?<year>\\d{2})\\.pdf$');
  });

  it('keeps shared text literal and captures what differs', () => {
    const { regex } = build(['report_alpha_v1.csv', 'report_beta_v1.csv']);
    expect(regex).toBe(`^report_(?<name>[A-Za-z\\u0590-\\u05FF]+)_v1\\.csv$`);
  });

  it('recognises an ISO date', () => {
    const { regex } = build(['log-2026-07-26.txt', 'log-2026-08-01.txt']);
    expect(regex).toBe('^log-(?<year>\\d{4})-(?<month>0?[1-9]|1[0-2])-(?<day>0?[1-9]|[12]\\d|3[01])\\.txt$');
  });

  it('recognises day-month-year order', () => {
    const { regex } = build(['inv_26-07-2026.pdf', 'inv_27-07-2026.pdf']);
    expect(regex).toBe(
      '^inv_(?<day>0?[1-9]|[12]\\d|3[01])-(?<month>0?[1-9]|1[0-2])-(?<year>\\d{4})\\.pdf$',
    );
  });

  it('captures long numbers from a single sample', () => {
    const { regex } = build(['240000101-07-26.pdf']);
    expect(regex).toBe('^(?<id>\\d+)-(?<month>0?[1-9]|1[0-2])-(?<year>\\d{2})\\.pdf$');
  });

  it('does not mistake a version number for a date', () => {
    const { regex } = build(['app-1.2.3-x86.bin', 'app-1.2.4-x86.bin']);
    expect(regex).toBe('^app-1\\.2\\.(?<id>\\d+)-x86\\.bin$');
  });

  it('falls back to prefix/suffix when the shapes differ', () => {
    const { regex, structural, warning } = build(['file-a1.pdf', 'file-22.pdf']);
    expect(structural).toBe(false);
    expect(warning).toBe('regex.warn.fallback');
    expect(regex).toBe('^file-(?<value>.+)\\.pdf$');
  });

  it('returns nothing for empty input', () => {
    expect(analyzeNames([]).segments).toEqual([]);
  });

  it('gives unique names to repeated group kinds', () => {
    const { segments } = analyzeNames(['a1-b2.txt', 'a3-b4.txt']);
    const names = segments.filter((s) => s.kind === 'group').map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('testNames', () => {
  const names = ['240000101-07-26.pdf', '240000102-07-26.pdf'];
  const { regex } = build(names);

  it('matches every source name and captures the groups', () => {
    const results = testNames(regex, names);
    expect(results.every((r) => r.matched)).toBe(true);
    expect(results[0].groups).toEqual({ id: '240000101', month: '07', year: '26' });
    expect(results[0].spans.map((s) => s.name)).toEqual(['id', 'month', 'year']);
  });

  it('rejects a name that does not fit', () => {
    expect(testNames(regex, ['240000101-13-26.pdf'])[0].matched).toBe(false);
    expect(testNames(regex, ['240000101-07-26.docx'])[0].matched).toBe(false);
  });

  it('honours the ignore-case flag', () => {
    expect(testNames(regex, ['240000101-07-26.PDF'])[0].matched).toBe(false);
    expect(testNames(regex, ['240000101-07-26.PDF'], true)[0].matched).toBe(true);
  });

  it('survives an invalid pattern', () => {
    expect(testNames('(?<bad', names)[0].matched).toBe(false);
  });
});

describe('isValidGroupName', () => {
  it('accepts identifiers and rejects the rest', () => {
    expect(isValidGroupName('workerid')).toBe(true);
    expect(isValidGroupName('worker_id2')).toBe(true);
    expect(isValidGroupName('2id')).toBe(false);
    expect(isValidGroupName('worker id')).toBe(false);
    expect(isValidGroupName('')).toBe(false);
  });
});
