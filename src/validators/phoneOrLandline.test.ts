import { describe, it, expect } from 'vitest';
import { validatePhoneOrLandline } from './phoneOrLandline';

describe('validatePhoneOrLandline', () => {
  const v = (value: string) => validatePhoneOrLandline(value, 0, 0);

  it('returns error for empty value', () => {
    expect(v('')).toMatchObject({ status: 'error', message: 'validators.phoneOrLandline.empty' });
  });

  it('accepts valid mobile numbers', () => {
    expect(v('0501234567')).toMatchObject({ status: 'valid' });
    expect(v('054-123-4567')).toMatchObject({ status: 'valid' });
  });

  it('accepts valid landline numbers', () => {
    expect(v('03-1234567')).toMatchObject({ status: 'valid' });
    expect(v('077-5254236')).toMatchObject({ status: 'valid' });
    expect(v('09-8765432')).toMatchObject({ status: 'valid' });
  });

  it('normalizes +972 prefix', () => {
    expect(v('+972501234567')).toMatchObject({ status: 'valid' });
  });

  it('rejects unknown prefixes', () => {
    expect(v('0611234567')).toMatchObject({ status: 'error', message: 'validators.phoneOrLandline.invalidPrefix' });
  });

  it('rejects wrong length', () => {
    expect(v('050123')).toMatchObject({ status: 'error', message: 'validators.phoneOrLandline.invalidLength' });
  });

  it('rejects non-numeric', () => {
    expect(v('05a1234567')).toMatchObject({ status: 'error', message: 'validators.phoneOrLandline.nonNumeric' });
  });
});
