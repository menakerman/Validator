import type { CellValidation } from '../types';

export function validateString(value: string, row: number, column: number): CellValidation {
  const trimmed = value.trim();

  if (!trimmed) {
    return { row, column, originalValue: value, status: 'error', message: 'validators.string.empty' };
  }

  if (/^\d+$/.test(trimmed)) {
    return { row, column, originalValue: value, status: 'warning', message: 'validators.string.numbersOnly' };
  }

  return { row, column, originalValue: value, status: 'valid', message: 'validators.string.valid' };
}
