import type { CellValidation } from '../types';

const VALID_GENDERS = new Set([
  'male', 'female', 'other',
  'm', 'f',
  'זכר', 'נקבה', 'אחר',
  'ז', 'נ',
]);

export function validateGender(value: string, row: number, column: number): CellValidation {
  const trimmed = value.trim();

  if (!trimmed) {
    return { row, column, originalValue: value, status: 'error', message: 'validators.gender.empty' };
  }

  if (VALID_GENDERS.has(trimmed.toLowerCase())) {
    return { row, column, originalValue: value, status: 'valid', message: 'validators.gender.valid' };
  }

  return { row, column, originalValue: value, status: 'error', message: 'validators.gender.invalid' };
}
