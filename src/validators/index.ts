import type { CellValidation, ColumnType } from '../types';
import { validateIsraeliId } from './israeliId';
import { validatePhone } from './phone';
import { validateLandline } from './landline';
import { validateEmail } from './email';
import { validateString } from './string';
import { validateNumber } from './number';
import { validateGender } from './gender';

export { validateIsraeliId } from './israeliId';
export { validatePhone } from './phone';
export { validateLandline } from './landline';
export { validateEmail } from './email';
export { validateString } from './string';
export { validateNumber } from './number';
export { validateGender } from './gender';

export function validate(
  value: string,
  type: ColumnType,
  row: number,
  column: number,
  mandatory: boolean = true,
  emptyValues: string[] = [],
): CellValidation {
  const trimmed = value.trim();

  // Check if value matches a configured empty pattern
  const isEmptyValue = !trimmed || emptyValues.some((ev) => trimmed === ev);

  // If not mandatory and value is empty (or matches empty pattern), skip validation
  if (!mandatory && isEmptyValue) {
    return {
      row,
      column,
      originalValue: value,
      status: 'valid',
      message: '',
    };
  }

  // If mandatory and value is empty, let the individual validator handle it
  // But if value matches an empty pattern (like "-"), treat it as truly empty
  const effectiveValue = isEmptyValue ? '' : value;

  switch (type) {
    case 'id':
      return validateIsraeliId(effectiveValue, row, column);
    case 'phone':
      return validatePhone(effectiveValue, row, column);
    case 'landline':
      return validateLandline(effectiveValue, row, column);
    case 'email':
      return validateEmail(effectiveValue, row, column);
    case 'string':
      return validateString(effectiveValue, row, column);
    case 'number':
      return validateNumber(effectiveValue, row, column);
    case 'gender':
      return validateGender(effectiveValue, row, column);
    case 'ignore':
      return {
        row,
        column,
        originalValue: value,
        status: 'valid',
        message: '',
      };
  }
}
