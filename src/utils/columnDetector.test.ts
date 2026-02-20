import { describe, it, expect } from 'vitest';
import { detectColumnTypes } from './columnDetector';

describe('detectColumnTypes', () => {
  describe('header matching', () => {
    it('detects ID column from Hebrew header', () => {
      const result = detectColumnTypes(['תעודת זהות'], [['123456782']]);
      expect(result[0].type).toBe('id');
      expect(result[0].confidence).toBe(0.9);
    });

    it('detects ID column from abbreviated Hebrew header', () => {
      const result = detectColumnTypes(['ת.ז.'], [['123456782']]);
      expect(result[0].type).toBe('id');
    });

    it('detects phone column from Hebrew header', () => {
      const result = detectColumnTypes(['טלפון'], [['0501234567']]);
      expect(result[0].type).toBe('phone');
    });

    it('detects phone from English header', () => {
      const result = detectColumnTypes(['mobile'], [['0501234567']]);
      expect(result[0].type).toBe('phone');
    });

    it('detects landline from Hebrew header', () => {
      const result = detectColumnTypes(['קווי'], [['021234567']]);
      expect(result[0].type).toBe('landline');
    });

    it('detects email from Hebrew header', () => {
      const result = detectColumnTypes(['אימייל'], [['test@gmail.com']]);
      expect(result[0].type).toBe('email');
    });

    it('detects email from English header', () => {
      const result = detectColumnTypes(['email'], [['test@gmail.com']]);
      expect(result[0].type).toBe('email');
    });

    it('detects email from e-mail header', () => {
      const result = detectColumnTypes(['e-mail'], [['test@gmail.com']]);
      expect(result[0].type).toBe('email');
    });
  });

  describe('data sample matching', () => {
    it('detects ID column from data patterns', () => {
      const data = [
        ['123456782'],
        ['987654321'],
        ['111222333'],
        ['555666777'],
      ];
      const result = detectColumnTypes(['col1'], data);
      expect(result[0].type).toBe('id');
    });

    it('detects email column from data patterns', () => {
      const data = [
        ['user@gmail.com'],
        ['another@yahoo.com'],
        ['test@hotmail.com'],
        ['info@company.org'],
      ];
      const result = detectColumnTypes(['col1'], data);
      expect(result[0].type).toBe('email');
    });

    it('detects phone column from data patterns', () => {
      const data = [
        ['0501234567'],
        ['0521234567'],
        ['0541234567'],
        ['0551234567'],
      ];
      const result = detectColumnTypes(['col1'], data);
      expect(result[0].type).toBe('phone');
    });

    it('falls back to ignore for unrecognized data', () => {
      const data = [
        ['hello'],
        ['world'],
        ['foo'],
        ['bar'],
      ];
      const result = detectColumnTypes(['col1'], data);
      expect(result[0].type).toBe('ignore');
      expect(result[0].confidence).toBe(0);
    });
  });

  describe('multi-column detection', () => {
    it('detects multiple column types', () => {
      const headers = ['תעודת זהות', 'טלפון', 'email', 'הערות'];
      const data = [
        ['123456782', '0501234567', 'user@gmail.com', 'note'],
      ];
      const result = detectColumnTypes(headers, data);
      expect(result[0].type).toBe('id');
      expect(result[1].type).toBe('phone');
      expect(result[2].type).toBe('email');
      expect(result[3].type).toBe('ignore');
    });
  });

  describe('sample values', () => {
    it('includes sample values in result', () => {
      const data = [['val1'], ['val2'], [''], ['val3']];
      const result = detectColumnTypes(['col1'], data);
      expect(result[0].sampleValues).toEqual(['val1', 'val2', 'val3']);
    });

    it('limits sample values to 5', () => {
      const data = Array.from({ length: 10 }, (_, i) => [`val${i}`]);
      const result = detectColumnTypes(['col1'], data);
      expect(result[0].sampleValues.length).toBeLessThanOrEqual(5);
    });
  });
});
