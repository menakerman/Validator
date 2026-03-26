import type { CellValidation } from '../types';

export function validateNumber(value: string, row: number, column: number): CellValidation {
  const trimmed = value.trim();

  if (!trimmed) {
    return { row, column, originalValue: value, status: 'error', message: 'validators.number.empty' };
  }

  const cleaned = trimmed.replace(/,/g, '');

  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
    return { row, column, originalValue: value, status: 'error', message: 'validators.number.nonNumeric' };
  }

  return { row, column, originalValue: value, status: 'valid', message: 'validators.number.valid' };
}
