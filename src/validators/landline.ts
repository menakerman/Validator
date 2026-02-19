import type { CellValidation, ValidationStatus } from '../types';

const LANDLINE_PREFIXES = ['02', '03', '04', '08', '09', '072', '073', '074', '076', '077'];
const MOBILE_PREFIXES = ['050', '051', '052', '053', '054', '055', '058'];

export function validateLandline(value: string, row: number, column: number): CellValidation {
  const trimmed = value.trim();

  if (!trimmed) {
    return result(row, column, value, 'error', 'validators.landline.empty');
  }

  // Normalize: strip dashes, spaces, dots, convert +972 to 0
  let normalized = trimmed.replace(/[\s\-().]/g, '');
  if (normalized.startsWith('+972')) {
    normalized = '0' + normalized.slice(4);
  } else if (normalized.startsWith('972')) {
    normalized = '0' + normalized.slice(3);
  }

  if (!/^\d+$/.test(normalized)) {
    return result(row, column, value, 'error', 'validators.landline.nonNumeric');
  }

  // Check landline prefixes (9-10 digits)
  const isLandline = LANDLINE_PREFIXES.some((p) => normalized.startsWith(p));
  if (isLandline) {
    if (normalized.length < 9 || normalized.length > 10) {
      return result(row, column, value, 'error', 'validators.landline.invalidLength');
    }
    return result(row, column, value, 'valid', 'validators.landline.valid');
  }

  // Check mobile prefixes - warn that this is a mobile number
  const isMobile = MOBILE_PREFIXES.some((p) => normalized.startsWith(p));
  if (isMobile) {
    if (normalized.length !== 10) {
      return result(row, column, value, 'error', 'validators.landline.invalidLength');
    }
    return result(row, column, value, 'warning', 'validators.landline.isMobile');
  }

  return result(row, column, value, 'error', 'validators.landline.invalidPrefix');
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
