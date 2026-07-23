import type { CellValidation, ValidationStatus } from '../types';

// Israeli birth-date format: DD/MM/YYYY (also accepts DD-MM-YYYY and DD.MM.YYYY).
export function validateDate(value: string, row: number, column: number): CellValidation {
  const trimmed = value.trim();

  if (!trimmed) {
    return result(row, column, value, 'error', 'validators.date.empty');
  }

  const match = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (!match) {
    return result(row, column, value, 'error', 'validators.date.invalidFormat');
  }

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  // Verify it is a real calendar date (rejects 31/02, 30/02, month 13, etc.)
  const date = new Date(year, month - 1, day);
  const isReal =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isReal || year < 1900) {
    return result(row, column, value, 'error', 'validators.date.invalidDate');
  }

  // A birth date cannot be in the future
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date.getTime() > today.getTime()) {
    return result(row, column, value, 'warning', 'validators.date.future');
  }

  return result(row, column, value, 'valid', 'validators.date.valid');
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
