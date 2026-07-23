import { describe, it, expect } from 'vitest';
import { validateDate } from './date';

describe('validateDate', () => {
  const v = (value: string) => validateDate(value, 0, 0);

  it('returns error for empty value', () => {
    expect(v('')).toMatchObject({ status: 'error', message: 'validators.date.empty' });
    expect(v('   ')).toMatchObject({ status: 'error', message: 'validators.date.empty' });
  });

  it('validates DD/MM/YYYY dates', () => {
    expect(v('10/01/1979')).toMatchObject({ status: 'valid' });
    expect(v('5/9/1990')).toMatchObject({ status: 'valid' });
  });

  it('accepts dash and dot separators', () => {
    expect(v('10-01-1979')).toMatchObject({ status: 'valid' });
    expect(v('10.01.1979')).toMatchObject({ status: 'valid' });
  });

  it('rejects malformed formats', () => {
    expect(v('1979-01-10')).toMatchObject({ status: 'error', message: 'validators.date.invalidFormat' });
    expect(v('10/01/79')).toMatchObject({ status: 'error', message: 'validators.date.invalidFormat' });
    expect(v('abc')).toMatchObject({ status: 'error', message: 'validators.date.invalidFormat' });
  });

  it('rejects impossible calendar dates', () => {
    expect(v('31/02/1990')).toMatchObject({ status: 'error', message: 'validators.date.invalidDate' });
    expect(v('32/01/1990')).toMatchObject({ status: 'error', message: 'validators.date.invalidDate' });
    expect(v('10/13/1990')).toMatchObject({ status: 'error', message: 'validators.date.invalidDate' });
    expect(v('10/01/1800')).toMatchObject({ status: 'error', message: 'validators.date.invalidDate' });
  });

  it('warns on future birth dates', () => {
    const nextYear = new Date().getFullYear() + 1;
    expect(v(`10/01/${nextYear}`)).toMatchObject({ status: 'warning', message: 'validators.date.future' });
  });
});
