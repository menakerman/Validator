import { describe, it, expect } from 'vitest';
import { validateEmail } from './email';

describe('validateEmail', () => {
  const v = (value: string) => validateEmail(value, 0, 0);

  it('returns error for empty value', () => {
    expect(v('')).toMatchObject({ status: 'error', message: 'validators.email.empty' });
    expect(v('  ')).toMatchObject({ status: 'error', message: 'validators.email.empty' });
  });

  it('returns error for invalid format', () => {
    expect(v('notanemail')).toMatchObject({ status: 'error', message: 'validators.email.invalidFormat' });
    expect(v('missing@domain')).toMatchObject({ status: 'error', message: 'validators.email.invalidFormat' });
    expect(v('@domain.com')).toMatchObject({ status: 'error', message: 'validators.email.invalidFormat' });
  });

  it('validates emails with known valid domains', () => {
    expect(v('user@gmail.com')).toMatchObject({ status: 'valid', message: 'validators.email.valid' });
    expect(v('user@yahoo.com')).toMatchObject({ status: 'valid', message: 'validators.email.valid' });
    expect(v('user@hotmail.com')).toMatchObject({ status: 'valid', message: 'validators.email.valid' });
    expect(v('user@walla.co.il')).toMatchObject({ status: 'valid', message: 'validators.email.valid' });
  });

  it('detects exact domain typos from the typo map', () => {
    const result = v('user@gmai.com');
    expect(result.status).toBe('warning');
    expect(result.message).toBe('validators.email.domainTypo');
    expect(result.suggestion).toBe('user@gmail.com');
  });

  it('detects typos via Levenshtein distance', () => {
    const result = v('user@gmial.com');
    expect(result.status).toBe('warning');
    expect(result.message).toBe('validators.email.domainTypo');
    expect(result.suggestion).toBe('user@gmail.com');
  });

  it('detects invalid TLDs', () => {
    // 'con' is an invalid TLD, and gmail.con is in the typo map
    const result = v('user@gmail.con');
    expect(result.status).toBe('warning');
    expect(result.suggestion).toBe('user@gmail.com');
  });

  it('returns error for invalid TLD with no close match', () => {
    const result = v('user@xyzunknowndomain.con');
    expect(result.status).toBe('error');
    expect(result.message).toBe('validators.email.invalidTld');
  });

  it('validates unknown but well-formed domains as valid', () => {
    expect(v('user@somecompany.org')).toMatchObject({ status: 'valid', message: 'validators.email.valid' });
  });

  it('trims and lowercases input', () => {
    expect(v('  User@Gmail.Com  ')).toMatchObject({ status: 'valid', message: 'validators.email.valid' });
  });

  it('detects Israeli domain typos', () => {
    const result = v('user@wala.co.il');
    expect(result.status).toBe('warning');
    expect(result.suggestion).toBe('user@walla.co.il');
  });

  it('preserves row, column, and originalValue', () => {
    const result = validateEmail('test@gmail.com', 3, 2);
    expect(result.row).toBe(3);
    expect(result.column).toBe(2);
    expect(result.originalValue).toBe('test@gmail.com');
  });
});
