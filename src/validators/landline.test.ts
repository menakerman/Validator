import { describe, it, expect } from 'vitest';
import { validateLandline } from './landline';

describe('validateLandline', () => {
  const v = (value: string) => validateLandline(value, 0, 0);

  it('returns error for empty value', () => {
    expect(v('')).toMatchObject({ status: 'error', message: 'validators.landline.empty' });
    expect(v('  ')).toMatchObject({ status: 'error', message: 'validators.landline.empty' });
  });

  it('returns error for non-numeric value', () => {
    expect(v('02abc1234')).toMatchObject({ status: 'error', message: 'validators.landline.nonNumeric' });
  });

  it('validates valid landline numbers', () => {
    expect(v('021234567')).toMatchObject({ status: 'valid', message: 'validators.landline.valid' });
    expect(v('031234567')).toMatchObject({ status: 'valid', message: 'validators.landline.valid' });
    expect(v('041234567')).toMatchObject({ status: 'valid', message: 'validators.landline.valid' });
    expect(v('081234567')).toMatchObject({ status: 'valid', message: 'validators.landline.valid' });
    expect(v('091234567')).toMatchObject({ status: 'valid', message: 'validators.landline.valid' });
    expect(v('0721234567')).toMatchObject({ status: 'valid', message: 'validators.landline.valid' });
    expect(v('0731234567')).toMatchObject({ status: 'valid', message: 'validators.landline.valid' });
    expect(v('0771234567')).toMatchObject({ status: 'valid', message: 'validators.landline.valid' });
  });

  it('normalizes +972 prefix', () => {
    expect(v('+97221234567')).toMatchObject({ status: 'valid', message: 'validators.landline.valid' });
    expect(v('97221234567')).toMatchObject({ status: 'valid', message: 'validators.landline.valid' });
  });

  it('strips formatting characters', () => {
    expect(v('02-123-4567')).toMatchObject({ status: 'valid', message: 'validators.landline.valid' });
    expect(v('02 123 4567')).toMatchObject({ status: 'valid', message: 'validators.landline.valid' });
    expect(v('(02) 1234567')).toMatchObject({ status: 'valid', message: 'validators.landline.valid' });
  });

  it('returns error for landline with wrong length', () => {
    expect(v('0212345')).toMatchObject({ status: 'error', message: 'validators.landline.invalidLength' });
    expect(v('02123456789')).toMatchObject({ status: 'error', message: 'validators.landline.invalidLength' });
  });

  it('returns warning for mobile numbers', () => {
    expect(v('0501234567')).toMatchObject({ status: 'warning', message: 'validators.landline.isMobile' });
    expect(v('0521234567')).toMatchObject({ status: 'warning', message: 'validators.landline.isMobile' });
  });

  it('returns error for mobile with wrong length', () => {
    expect(v('050123456')).toMatchObject({ status: 'error', message: 'validators.landline.invalidLength' });
  });

  it('returns error for invalid prefix', () => {
    expect(v('0601234567')).toMatchObject({ status: 'error', message: 'validators.landline.invalidPrefix' });
    expect(v('0101234567')).toMatchObject({ status: 'error', message: 'validators.landline.invalidPrefix' });
  });
});
