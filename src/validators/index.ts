import type { CellValidation, ColumnType } from '../types';
import { validateIsraeliId } from './israeliId';
import { validatePhone } from './phone';
import { validateLandline } from './landline';
import { validateEmail } from './email';

export { validateIsraeliId } from './israeliId';
export { validatePhone } from './phone';
export { validateLandline } from './landline';
export { validateEmail } from './email';

export function validate(
  value: string,
  type: ColumnType,
  row: number,
  column: number,
  mandatory: boolean = true,
): CellValidation {
  // If not mandatory and value is empty, skip validation
  if (!mandatory && !value.trim()) {
    return {
      row,
      column,
      originalValue: value,
      status: 'valid',
      message: '',
    };
  }

  switch (type) {
    case 'id':
      return validateIsraeliId(value, row, column);
    case 'phone':
      return validatePhone(value, row, column);
    case 'landline':
      return validateLandline(value, row, column);
    case 'email':
      return validateEmail(value, row, column);
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
