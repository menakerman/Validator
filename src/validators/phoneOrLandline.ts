import type { CellValidation, ValidationStatus } from '../types';

const MOBILE_PREFIXES = ['050', '051', '052', '053', '054', '055', '058'];
const LANDLINE_PREFIXES = ['02', '03', '04', '08', '09', '072', '073', '074', '076', '077'];

// Accepts either a valid Israeli mobile or a valid Israeli landline number.
// Used for the Kehilanet "home phone" column, which may hold either kind.
export function validatePhoneOrLandline(value: string, row: number, column: number): CellValidation {
  const trimmed = value.trim();

  if (!trimmed) {
    return result(row, column, value, 'error', 'validators.phoneOrLandline.empty');
  }

  // Normalize: strip separators, convert +972 / 972 to leading 0
  let normalized = trimmed.replace(/[\s\-().]/g, '');
  if (normalized.startsWith('+972')) {
    normalized = '0' + normalized.slice(4);
  } else if (normalized.startsWith('972')) {
    normalized = '0' + normalized.slice(3);
  }

  if (!/^\d+$/.test(normalized)) {
    return result(row, column, value, 'error', 'validators.phoneOrLandline.nonNumeric');
  }

  if (MOBILE_PREFIXES.some((p) => normalized.startsWith(p))) {
    if (normalized.length !== 10) {
      return result(row, column, value, 'error', 'validators.phoneOrLandline.invalidLength');
    }
    return result(row, column, value, 'valid', 'validators.phoneOrLandline.valid');
  }

  if (LANDLINE_PREFIXES.some((p) => normalized.startsWith(p))) {
    if (normalized.length < 9 || normalized.length > 10) {
      return result(row, column, value, 'error', 'validators.phoneOrLandline.invalidLength');
    }
    return result(row, column, value, 'valid', 'validators.phoneOrLandline.valid');
  }

  return result(row, column, value, 'error', 'validators.phoneOrLandline.invalidPrefix');
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
