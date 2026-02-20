import { describe, it, expect } from 'vitest';
import { validatePhone } from './phone';

describe('validatePhone', () => {
  const v = (value: string) => validatePhone(value, 0, 0);

  it('returns error for empty value', () => {
    expect(v('')).toMatchObject({ status: 'error', message: 'validators.phone.empty' });
    expect(v('  ')).toMatchObject({ status: 'error', message: 'validators.phone.empty' });
  });

  it('returns error for non-numeric value', () => {
    expect(v('050abc1234')).toMatchObject({ status: 'error', message: 'validators.phone.nonNumeric' });
  });

  it('validates valid mobile numbers', () => {
    expect(v('0501234567')).toMatchObject({ status: 'valid', message: 'validators.phone.valid' });
    expect(v('0521234567')).toMatchObject({ status: 'valid', message: 'validators.phone.valid' });
    expect(v('0541234567')).toMatchObject({ status: 'valid', message: 'validators.phone.valid' });
    expect(v('0581234567')).toMatchObject({ status: 'valid', message: 'validators.phone.valid' });
  });

  it('normalizes +972 prefix', () => {
    expect(v('+972501234567')).toMatchObject({ status: 'valid', message: 'validators.phone.valid' });
    expect(v('972501234567')).toMatchObject({ status: 'valid', message: 'validators.phone.valid' });
  });

  it('strips formatting characters', () => {
    expect(v('050-123-4567')).toMatchObject({ status: 'valid', message: 'validators.phone.valid' });
    expect(v('050 123 4567')).toMatchObject({ status: 'valid', message: 'validators.phone.valid' });
    expect(v('(050) 1234567')).toMatchObject({ status: 'valid', message: 'validators.phone.valid' });
  });

  it('returns error for mobile with wrong length', () => {
    expect(v('050123456')).toMatchObject({ status: 'error', message: 'validators.phone.invalidLength' });
    expect(v('05012345678')).toMatchObject({ status: 'error', message: 'validators.phone.invalidLength' });
  });

  it('returns warning for landline numbers', () => {
    expect(v('021234567')).toMatchObject({ status: 'warning', message: 'validators.phone.validLandline' });
    expect(v('031234567')).toMatchObject({ status: 'warning', message: 'validators.phone.validLandline' });
    expect(v('0771234567')).toMatchObject({ status: 'warning', message: 'validators.phone.validLandline' });
  });

  it('returns error for landline with wrong length', () => {
    expect(v('0212345')).toMatchObject({ status: 'error', message: 'validators.phone.invalidLength' });
  });

  it('returns error for invalid prefix', () => {
    expect(v('0601234567')).toMatchObject({ status: 'error', message: 'validators.phone.invalidPrefix' });
    expect(v('0101234567')).toMatchObject({ status: 'error', message: 'validators.phone.invalidPrefix' });
  });
});
