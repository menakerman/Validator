import { describe, it, expect } from 'vitest';
import {
  mekomeRow,
  buildKehilanetMappings,
  selectExportRows,
  mekomeErrorColumns,
  applyKehilanetCrossRules,
  MEKOME_COLUMNS,
  CHILDREN_COLUMNS,
  parentIdColumns,
  childRowsForPerson,
  childrenErrorColumns,
} from './kehilanet';
import { validate } from '../validators';
import type { CellValidation, ParsedFile, ValidationResult } from '../types';

// Build a sparse 71-column Kehilanet row from {colIndex: value} pairs.
function kehRow(values: Record<number, string>): string[] {
  const row = new Array(71).fill('');
  for (const [i, v] of Object.entries(values)) row[Number(i)] = v;
  return row;
}

describe('mekomeRow', () => {
  // Column indices: B=1 C=2 D=3 E=4 R=17 U=20 V=21 AK=36 AO=40 BA=52 BS=70
  const row = kehRow({
    1: 'טלי',
    2: 'אביב',
    3: '10/01/1979',
    4: '036269827',
    17: 'taliran79@walla.co.il',
    20: '077-5254236',
    21: '0504555931',
    36: 'נקבה',
    40: 'גר ביישוב - תושב קבע (בבעלותי בית)',
    52: 'ממד',
    70: 'הרחבה, חברי אגודה, חברי אגודה ומשלמי מיסים, תרבות',
  });
  const out = mekomeRow(row);

  it('produces 24 columns', () => {
    expect(out).toHaveLength(MEKOME_COLUMNS.length);
    expect(out).toHaveLength(24);
  });

  it('maps identity, contact and status fields', () => {
    expect(out[0]).toBe('טלי');                          // First Name <- B
    expect(out[1]).toBe('אביב');                         // Last Name  <- C
    expect(out[4]).toBe('10/01/1979');                   // Date of Birth <- D
    expect(out[5]).toBe('036269827');                    // ID Number  <- E
    expect(out[6]).toBe('נקבה');                         // Gender     <- AK
    expect(out[8]).toBe('0504555931');                   // Mobile     <- V
    expect(out[10]).toBe('077-5254236');                 // Phone      <- U
    expect(out[11]).toBe('taliran79@walla.co.il');       // Email      <- R
    expect(out[15]).toBe('ממד');                         // Shelter    <- BA
    expect(out[22]).toBe('גר ביישוב - תושב קבע (בבעלותי בית)'); // User Type <- AO
  });

  it('replaces commas with # in the tags column', () => {
    expect(out[20]).toBe('הרחבה#חברי אגודה#חברי אגודה ומשלמי מיסים#תרבות');
  });

  it('preserves a space before a comma when replacing tags', () => {
    const r = kehRow({ 70: 'צוות שדרוג תשתיות , תרבות' });
    expect(mekomeRow(r)[20]).toBe('צוות שדרוג תשתיות #תרבות');
  });

  it('sets "Is Mekome member" to a constant and leaves unmapped columns empty', () => {
    expect(out[23]).toBe('לא'); // Is Mekome member (constant)
    expect(out[3]).toBe('');    // Nickname (no source)
    expect(out[14]).toBe('');   // House Number (no source)
  });
});

describe('buildKehilanetMappings', () => {
  const parsed: ParsedFile = {
    fileName: 'k.xlsx',
    headers: (() => {
      const h = new Array(71).fill('');
      h[3] = 'תאריך לידה*';
      h[4] = 'תעודת זהות*';
      h[20] = 'טלפון בית*';
      return h;
    })(),
    data: [kehRow({ 3: '10/01/1979', 4: '036269827', 20: '077-5254236' })],
    totalRows: 1,
  };
  const mappings = buildKehilanetMappings(parsed);

  it('types the specified columns and ignores the rest', () => {
    const byCol = new Map(mappings.map((m) => [m.columnIndex, m]));
    expect(byCol.get(3)?.type).toBe('date');            // D
    expect(byCol.get(4)?.type).toBe('id');              // E
    expect(byCol.get(20)?.type).toBe('phoneOrLandline'); // U
    expect(byCol.get(0)?.type).toBe('ignore');          // A
    expect(byCol.get(5)?.type).toBe('ignore');          // F
  });

  it('marks a column mandatory only when its Mekome target is starred', () => {
    const byCol = new Map(mappings.map((m) => [m.columnIndex, m]));
    // Starred in Mekome and independently mandatory: B, C, E
    expect(byCol.get(1)?.mandatory).toBe(true);   // B First Name*
    expect(byCol.get(2)?.mandatory).toBe(true);   // C Last Name*
    expect(byCol.get(4)?.mandatory).toBe(true);   // E ID Number*
    // Email (R) and Mobile (V) are starred but handled by the
    // "email or mobile required" cross-rule, so not independently mandatory.
    expect(byCol.get(21)?.mandatory).toBe(false); // V Mobile Phone*
    expect(byCol.get(17)?.mandatory).toBe(false); // R Email*
    // Not starred in Mekome (may be empty)
    expect(byCol.get(3)?.mandatory).toBe(false);  // D Date of Birth (no *)
    expect(byCol.get(20)?.mandatory).toBe(false); // U home phone
    expect(byCol.get(70)?.mandatory).toBe(false); // BS tags
  });
});

describe('selectExportRows', () => {
  const parsed: ParsedFile = {
    fileName: 'k.xlsx',
    headers: new Array(71).fill(''),
    data: [kehRow({}), kehRow({}), kehRow({}), kehRow({})], // 4 rows
    totalRows: 4,
  };
  // Rows 1 and 3 have an error on Kehilanet column E (ID, index 4).
  const cell = (row: number, column: number, status: CellValidation['status']): CellValidation => ({
    row, column, originalValue: '', status, message: '',
  });
  const result: ValidationResult = {
    cells: [
      cell(0, 4, 'valid'),
      cell(1, 4, 'error'),
      cell(2, 4, 'warning'),
      cell(3, 4, 'error'),
    ],
    summary: { totalCells: 4, validCount: 1, warningCount: 1, errorCount: 2, perColumn: [] },
  };

  it('all -> every row', () => {
    expect(selectExportRows(parsed, result, 'all')).toEqual([0, 1, 2, 3]);
  });

  it('valid -> rows without errors (warnings still count as valid)', () => {
    expect(selectExportRows(parsed, result, 'valid')).toEqual([0, 2]);
  });

  it('errors -> only rows with at least one error', () => {
    expect(selectExportRows(parsed, result, 'errors')).toEqual([1, 3]);
  });
});

describe('mekomeErrorColumns', () => {
  it('maps erroring Kehilanet source columns to Mekome output indices', () => {
    // E(4) -> ID Number (5), R(17) -> Email (11)
    expect(mekomeErrorColumns([4, 17]).sort((a, b) => a - b)).toEqual([5, 11]);
  });

  it('skips source columns that are not present in the Mekome output', () => {
    // M(12) and AQ(42) are validated but not exported to Mekome.
    expect(mekomeErrorColumns([12, 42])).toEqual([]);
  });
});

describe('applyKehilanetCrossRules', () => {
  const E = 4, R = 17, V = 21; // ID, Email, Mobile column indices

  // Base-validate the columns involved in the cross rules for a data set.
  function baseCells(data: string[][]): CellValidation[] {
    const cells: CellValidation[] = [];
    for (let r = 0; r < data.length; r++) {
      cells.push(validate(data[r][E] ?? '', 'id', r, E, true, []));
      cells.push(validate(data[r][R] ?? '', 'email', r, R, false, []));
      cells.push(validate(data[r][V] ?? '', 'phone', r, V, false, []));
    }
    return cells;
  }
  const row = (id: string, email: string, mobile: string) => {
    const a = new Array(71).fill('');
    a[E] = id; a[R] = email; a[V] = mobile;
    return a;
  };
  const cellAt = (cells: CellValidation[], r: number, c: number) =>
    cells.find((x) => x.row === r && x.column === c)!;

  it('flags duplicate ID numbers (ignoring leading zeros)', () => {
    const data = [
      row('036269827', 'a@x.com', '0501111111'),
      row('36269827', 'b@x.com', '0502222222'),   // same ID, no leading zero
      row('036202307', 'c@x.com', '0503333333'),  // different valid ID
    ];
    const out = applyKehilanetCrossRules(baseCells(data), data);
    expect(cellAt(out, 0, E)).toMatchObject({ status: 'error', message: 'validators.id.duplicate' });
    expect(cellAt(out, 1, E)).toMatchObject({ status: 'error', message: 'validators.id.duplicate' });
    expect(cellAt(out, 2, E).status).not.toBe('error');
  });

  it('flags duplicate mobile numbers (normalizing +972)', () => {
    const data = [
      row('012345671', 'a@x.com', '0501234567'),
      row('036269827', 'b@x.com', '+972501234567'), // same mobile
    ];
    const out = applyKehilanetCrossRules(baseCells(data), data);
    expect(cellAt(out, 0, V)).toMatchObject({ status: 'error', message: 'validators.phone.duplicate' });
    expect(cellAt(out, 1, V)).toMatchObject({ status: 'error', message: 'validators.phone.duplicate' });
  });

  it('requires an email or a mobile phone', () => {
    const data = [
      row('012345671', '', ''),            // neither -> error on both
      row('036269827', 'has@x.com', ''),   // email only -> ok
      row('108241902', '', '0504444444'),  // mobile only -> ok
    ];
    const out = applyKehilanetCrossRules(baseCells(data), data);
    expect(cellAt(out, 0, R)).toMatchObject({ status: 'error', message: 'validators.kehilanet.emailOrPhone' });
    expect(cellAt(out, 0, V)).toMatchObject({ status: 'error', message: 'validators.kehilanet.emailOrPhone' });
    expect(cellAt(out, 1, R).status).not.toBe('error');
    expect(cellAt(out, 1, V).status).not.toBe('error');
    expect(cellAt(out, 2, R).status).not.toBe('error');
    expect(cellAt(out, 2, V).status).not.toBe('error');
  });

  it('does not override a more specific per-cell error', () => {
    const data = [
      row('111111111', 'a@x.com', '0501234567'), // invalid check digit
      row('111111111', 'b@x.com', '0502222222'), // duplicate of the invalid ID
    ];
    const out = applyKehilanetCrossRules(baseCells(data), data);
    // Keeps the check-digit error rather than replacing it with 'duplicate'.
    expect(cellAt(out, 0, E)).toMatchObject({ status: 'error', message: 'validators.id.invalidCheckDigit' });
  });
});

describe('children export', () => {
  // Column indices in the 71-column layout: B=1 C=2 D=3 E=4 T=19 V=21 AK=36.
  // Parent-ID columns are resolved by header text, not a fixed index; place them
  // at arbitrary positions to prove the lookup is header-driven.
  const P1 = 43;
  const P2 = 44;
  const headers = (() => {
    const h = new Array(71).fill('');
    h[P1] = 'ת.ז. הורה 1*';
    h[P2] = 'ת.ז. הורה 2*';
    h[38] = 'מספר הורה 1'; // parent serial — must NOT be treated as a parent ID
    return h;
  })();

  const child = kehRow({
    1: 'שאול',
    2: 'סיני',
    3: '10/05/2003',
    4: '23123223',
    19: 'חן',
    21: '+972507955877',
    36: 'זכר',
    [P1]: '123456789',
    [P2]: '987654321',
  });

  it('has the 8 children columns matching the sample header', () => {
    expect(CHILDREN_COLUMNS.map((c) => c.he)).toEqual([
      'תעודת זהות הורה*',
      'תעודת זהות ילד*',
      'שם פרטי ילד*',
      'שם משפחה ילד*',
      'שם אמצעי ילד',
      'נייד ילד',
      'תאריך לידה ילד',
      'מגדר ילד',
    ]);
  });

  it('resolves parent-ID columns by header, excluding "מספר הורה"', () => {
    expect(parentIdColumns(headers)).toEqual([P1, P2]);
  });

  it('emits one row per named parent with child identity fields', () => {
    const rows = childRowsForPerson(child, [P1, P2]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual([
      '123456789', '23123223', 'שאול', 'סיני', 'חן', '+972507955877', '10/05/2003', 'זכר',
    ]);
    expect(rows[1][0]).toBe('987654321'); // second row links to parent 2
    expect(rows[1].slice(1)).toEqual(rows[0].slice(1)); // same child fields
  });

  it('skips people with no parent named', () => {
    const orphan = kehRow({ 1: 'דן', 4: '111' });
    expect(childRowsForPerson(orphan, [P1, P2])).toHaveLength(0);
  });

  it('emits a single row when only one parent is filled', () => {
    const oneParent = kehRow({ 4: '55', [P1]: '123456789' });
    const rows = childRowsForPerson(oneParent, [P1, P2]);
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe('123456789');
  });

  it('maps erroring child source columns to output columns (parent skipped)', () => {
    // E (Child ID) -> col 1, V (Mobile) -> col 5; parent cols map to nothing.
    expect(childrenErrorColumns([4, 21, P1]).sort((a, b) => a - b)).toEqual([1, 5]);
  });
});
