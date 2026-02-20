import { describe, it, expect } from 'vitest';
import { validate } from './index';

describe('validate', () => {
  it('delegates to validateIsraeliId for id type', () => {
    const result = validate('000000018', 'id', 0, 0);
    expect(result.status).toBe('valid');
  });

  it('delegates to validatePhone for phone type', () => {
    const result = validate('0501234567', 'phone', 0, 0);
    expect(result.status).toBe('valid');
  });

  it('delegates to validateLandline for landline type', () => {
    const result = validate('021234567', 'landline', 0, 0);
    expect(result.status).toBe('valid');
  });

  it('delegates to validateEmail for email type', () => {
    const result = validate('user@gmail.com', 'email', 0, 0);
    expect(result.status).toBe('valid');
  });

  it('returns valid for ignore type', () => {
    const result = validate('anything', 'ignore', 0, 0);
    expect(result.status).toBe('valid');
    expect(result.message).toBe('');
  });

  it('skips validation for non-mandatory empty values', () => {
    const result = validate('', 'id', 0, 0, false);
    expect(result.status).toBe('valid');
    expect(result.message).toBe('');
  });

  it('still validates non-empty values when not mandatory', () => {
    const result = validate('invalid', 'id', 0, 0, false);
    expect(result.status).toBe('error');
  });

  it('validates mandatory empty values as error', () => {
    const result = validate('', 'id', 0, 0, true);
    expect(result.status).toBe('error');
    expect(result.message).toBe('validators.id.empty');
  });
});
