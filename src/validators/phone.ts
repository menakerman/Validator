import type { CellValidation, ValidationStatus } from '../types';

const MOBILE_PREFIXES = ['050', '051', '052', '053', '054', '055', '058'];
const LANDLINE_PREFIXES = ['02', '03', '04', '08', '09', '072', '073', '074', '076', '077'];

export function validatePhone(value: string, row: number, column: number): CellValidation {
  const trimmed = value.trim();

  if (!trimmed) {
    return result(row, column, value, 'error', 'validators.phone.empty');
  }

  // Normalize: strip dashes, spaces, dots, convert +972 to 0
  let normalized = trimmed.replace(/[\s\-().]/g, '');
  if (normalized.startsWith('+972')) {
    normalized = '0' + normalized.slice(4);
  } else if (normalized.startsWith('972')) {
    normalized = '0' + normalized.slice(3);
  }

  if (!/^\d+$/.test(normalized)) {
    return result(row, column, value, 'error', 'validators.phone.nonNumeric');
  }

  // Check mobile prefixes (10 digits)
  const isMobile = MOBILE_PREFIXES.some((p) => normalized.startsWith(p));
  if (isMobile) {
    if (normalized.length !== 10) {
      return result(row, column, value, 'error', 'validators.phone.invalidLength');
    }
    return result(row, column, value, 'valid', 'validators.phone.valid');
  }

  // Check landline prefixes (9-10 digits)
  const isLandline = LANDLINE_PREFIXES.some((p) => normalized.startsWith(p));
  if (isLandline) {
    if (normalized.length < 9 || normalized.length > 10) {
      return result(row, column, value, 'error', 'validators.phone.invalidLength');
    }
    return result(row, column, value, 'warning', 'validators.phone.validLandline');
  }

  return result(row, column, value, 'error', 'validators.phone.invalidPrefix');
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
