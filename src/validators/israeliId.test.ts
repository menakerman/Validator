import { describe, it, expect } from 'vitest';
import { validateIsraeliId } from './israeliId';

describe('validateIsraeliId', () => {
  const v = (value: string) => validateIsraeliId(value, 0, 0);

  it('returns error for empty value', () => {
    expect(v('')).toMatchObject({ status: 'error', message: 'validators.id.empty' });
    expect(v('   ')).toMatchObject({ status: 'error', message: 'validators.id.empty' });
  });

  it('returns error for non-numeric value', () => {
    expect(v('12345abc')).toMatchObject({ status: 'error', message: 'validators.id.nonNumeric' });
    expect(v('abc')).toMatchObject({ status: 'error', message: 'validators.id.nonNumeric' });
  });

  it('returns error for value longer than 9 digits', () => {
    expect(v('1234567890')).toMatchObject({ status: 'error', message: 'validators.id.invalidLength' });
  });

  it('returns error for all zeros', () => {
    expect(v('000000000')).toMatchObject({ status: 'error', message: 'validators.id.allZeros' });
    expect(v('0')).toMatchObject({ status: 'error', message: 'validators.id.allZeros' });
  });

  it('validates correct Israeli IDs', () => {
    // Known valid Israeli IDs (check digit validates with Luhn-variant)
    expect(v('000000018')).toMatchObject({ status: 'valid', message: 'validators.id.valid' });
    expect(v('123456782')).toMatchObject({ status: 'valid', message: 'validators.id.valid' });
    expect(v('111111118')).toMatchObject({ status: 'valid', message: 'validators.id.valid' });
  });

  it('pads short IDs with leading zeros', () => {
    // '18' padded to '000000018' should be valid
    expect(v('18')).toMatchObject({ status: 'valid', message: 'validators.id.valid' });
  });

  it('returns error for invalid check digit', () => {
    expect(v('000000019')).toMatchObject({ status: 'error', message: 'validators.id.invalidCheckDigit' });
    expect(v('123456789')).toMatchObject({ status: 'error', message: 'validators.id.invalidCheckDigit' });
  });

  it('preserves row, column, and originalValue', () => {
    const result = validateIsraeliId(' 18 ', 5, 3);
    expect(result.row).toBe(5);
    expect(result.column).toBe(3);
    expect(result.originalValue).toBe(' 18 ');
  });
});
