import type { CellValidation, ValidationStatus } from '../types';

export function validateIsraeliId(value: string, row: number, column: number): CellValidation {
  const trimmed = value.trim();

  if (!trimmed) {
    return result(row, column, value, 'error', 'validators.id.empty');
  }

  if (!/^\d+$/.test(trimmed)) {
    return result(row, column, value, 'error', 'validators.id.nonNumeric');
  }

  if (trimmed.length > 9) {
    return result(row, column, value, 'error', 'validators.id.invalidLength');
  }

  const padded = trimmed.padStart(9, '0');

  if (padded === '000000000') {
    return result(row, column, value, 'error', 'validators.id.allZeros');
  }

  const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let product = Number(padded[i]) * weights[i];
    if (product > 9) product -= 9;
    sum += product;
  }

  if (sum % 10 !== 0) {
    return result(row, column, value, 'error', 'validators.id.invalidCheckDigit');
  }

  return result(row, column, value, 'valid', 'validators.id.valid');
}

function result(
  row: number,
  column: number,
  originalValue: string,
  status: ValidationStatus,
  message: string,
  suggestion?: string,
): CellValidation {
  return { row, column, originalValue, status, message, suggestion };
}
