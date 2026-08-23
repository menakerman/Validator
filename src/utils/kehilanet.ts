import ExcelJS from 'exceljs';
import type { CellValidation, ColumnMapping, ColumnType, ParsedFile, ValidationResult } from '../types';
import { readFileRows } from './excelParser';

// ---------------------------------------------------------------------------
// Kehilanet ("קהילנט") → Mekome ("מקומי") conversion.
//
// A Kehilanet export is a fixed 71-column layout. This module knows, by column
// letter, which columns to validate and how each maps into the 24-column
// Mekome import format. Column indices below are 0-based (A=0, B=1, ...).
// ---------------------------------------------------------------------------

// Zero-based index of an Excel column letter (e.g. "B" -> 1, "AK" -> 36).
function col(letter: string): number {
  let n = 0;
  for (const ch of letter) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

// Columns with cross-row / cross-field rules.
const ID_COL = col('E');      // תעודת זהות — mandatory + unique
const MOBILE_COL = col('V');  // טלפון נייד — unique
const EMAIL_COL = col('R');   // דואר אלקטרוני — email-or-mobile pair

// Child-identity source columns in the 71-column Kehilanet layout, reused by the
// children export below. These are the same indices the Mekome mapping uses for
// the person's own name/DOB/mobile/gender fields.
const FIRST_COL = col('B');   // שם פרטי
const LAST_COL = col('C');    // שם משפחה
const DOB_COL = col('D');     // תאריך לידה
const MIDDLE_COL = col('T');  // שם נעורים → שם אמצעי
const GENDER_COL = col('AK'); // מין

interface KehilanetField {
  col: number;
  type: ColumnType;
}

// Columns to validate on the Kehilanet file, per the agreed format. Whether a
// column may be empty is derived from the Mekome layout (see MANDATORY_SOURCES):
// a column is mandatory only when its Mekome target header is starred.
export const KEHILANET_FIELDS: KehilanetField[] = [
  { col: col('B'), type: 'string' },           // שם פרטי
  { col: col('C'), type: 'string' },           // שם משפחה
  { col: col('D'), type: 'date' },             // תאריך לידה
  { col: col('E'), type: 'id' },               // תעודת זהות
  { col: col('L'), type: 'string' },           // ישוב
  { col: col('M'), type: 'string' },           // שכונה
  { col: col('N'), type: 'string' },           // רחוב
  { col: col('R'), type: 'email' },            // דואר אלקטרוני
  { col: col('T'), type: 'string' },           // שם נעורים
  { col: col('U'), type: 'phoneOrLandline' },  // טלפון בית
  { col: col('V'), type: 'phone' },            // טלפון נייד
  { col: col('W'), type: 'phone' },            // טלפון נייד נוסף
  { col: col('AK'), type: 'string' },          // מין
  { col: col('AL'), type: 'string' },          // מצב משפחתי
  { col: col('AO'), type: 'string' },          // סוג משתמש
  { col: col('AQ'), type: 'id' },              // ת.ז. בן/בת זוג
  { col: col('BA'), type: 'string' },          // ממ"ד/מקלט
  { col: col('BD'), type: 'string' },          // איש קשר במקרה אסון
  { col: col('BE'), type: 'string' },          // טלפון איש קשר במקרה אסון
  { col: col('BS'), type: 'string' },          // קבוצות
];

interface MekomeColumn {
  en: string;
  he: string;
  source: number | null;       // source Kehilanet column index, or null (blank)
  transform?: 'tags';          // "," -> "#" for the tags column
  constant?: string;           // fixed value for every row
}

// The Mekome import layout: two header rows (English, then Hebrew) followed by
// data. Sources were derived by matching the reference input/output files.
export const MEKOME_COLUMNS: MekomeColumn[] = [
  { en: 'First Name', he: 'שם פרטי*', source: col('B') },
  { en: 'Last Name', he: 'שם משפחה*', source: col('C') },
  { en: 'Maiden Name', he: 'שם אמצעי', source: col('T') },
  { en: 'Nickname', he: 'כינוי', source: null },
  { en: 'Date of Birth', he: 'תאריך לידה', source: col('D') },
  { en: 'ID Number', he: 'תעודת זהות*', source: col('E') },
  { en: 'Gender', he: 'מין', source: col('AK') },
  { en: 'Marital Status', he: 'מצב משפחתי', source: col('AL') },
  { en: 'Mobile Phone', he: 'טלפון נייד*', source: col('V') },
  { en: 'Extra Mobile number', he: 'נייד נוסף', source: col('W') },
  { en: 'Phone number', he: 'טלפון נוסף', source: col('U') },
  { en: 'Email', he: 'דואר אלקטרוני*', source: col('R') },
  { en: 'City', he: 'ישוב', source: col('L') },
  { en: 'Street', he: 'רחוב', source: col('N') },
  { en: 'House Number', he: 'מספר בית', source: null },
  { en: 'Shelter', he: 'ממ”ד/מקלט', source: col('BA') },
  { en: 'Emergency Contact 1 name', he: 'איש קשר במקרה אסון', source: col('BD') },
  { en: 'Emergency Contact 1 Phone', he: 'טלפון איש קשר במקרה אסון', source: col('BE') },
  { en: 'Emergency Contact 2 name', he: 'איש קשר 2 במקרה אסון', source: null },
  { en: 'Emergency Contact 2 Phone', he: 'טלפון איש קשר 2 במקרה אסון', source: null },
  { en: 'Tags', he: 'תגיות', source: col('BS'), transform: 'tags' },
  { en: 'Roles', he: 'תפקידים', source: null },
  { en: 'User Type', he: 'סוג משתמש', source: col('AO') },
  { en: 'Is Mekome member', he: 'חבר מקומי הודעות', source: null, constant: 'לא' },
];

// A Kehilanet source column is mandatory (may not be empty) only when its
// Mekome target column is starred ("*") in the Hebrew header row. Email and
// mobile are excluded here — they are governed together by the
// "email or mobile required" cross-field rule instead.
export const MANDATORY_SOURCES = new Set<number>(
  MEKOME_COLUMNS
    .filter((c) => c.source !== null && c.he.trim().endsWith('*'))
    .map((c) => c.source as number),
);

function isMandatory(colIndex: number): boolean {
  if (colIndex === EMAIL_COL || colIndex === MOBILE_COL) return false;
  return MANDATORY_SOURCES.has(colIndex);
}

function isKehilanetHeaderRow(row: string[]): boolean {
  const joined = row.map((c) => String(c).trim());
  return joined.includes('תעודת זהות*') || joined.includes('שם פרטי*');
}

// Parse a Kehilanet export. The file may carry an English mapping row above the
// Hebrew header row; we locate the Hebrew header row and take everything after
// it as data, preserving the full column layout.
export async function parseKehilanetFile(file: File): Promise<ParsedFile> {
  const raw = await readFileRows(file);
  if (raw.length === 0) {
    throw new Error('upload.error.empty');
  }

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    if (isKehilanetHeaderRow(raw[i].map((c) => String(c)))) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    throw new Error('upload.error.notKehilanet');
  }

  const headers = raw[headerRowIndex].map((h) => String(h).trim());
  const width = Math.max(headers.length, ...MEKOME_COLUMNS.map((c) => (c.source ?? 0) + 1));

  const rows = raw
    .slice(headerRowIndex + 1)
    .filter((row) => row.some((cell) => String(cell).trim() !== ''));

  if (rows.length === 0) {
    throw new Error('upload.error.empty');
  }

  const data = rows.map((row) => {
    const normalized = new Array(width).fill('');
    for (let i = 0; i < width; i++) {
      normalized[i] = String(row[i] ?? '').trim();
    }
    return normalized;
  });

  return {
    fileName: file.name,
    headers,
    data,
    totalRows: data.length,
  };
}

// Build the fixed column mappings for a parsed Kehilanet file: the fields listed
// in KEHILANET_FIELDS are typed for validation, every other column is ignored.
export function buildKehilanetMappings(parsed: ParsedFile): ColumnMapping[] {
  const byCol = new Map(KEHILANET_FIELDS.map((f) => [f.col, f]));
  const width = Math.max(parsed.headers.length, ...KEHILANET_FIELDS.map((f) => f.col + 1));

  const mappings: ColumnMapping[] = [];
  for (let i = 0; i < width; i++) {
    const field = byCol.get(i);
    const sampleValues = parsed.data
      .map((r) => r[i])
      .filter((v) => v && v.trim() !== '')
      .slice(0, 3);
    mappings.push({
      columnIndex: i,
      headerName: parsed.headers[i] ?? `Column ${i + 1}`,
      type: field ? field.type : 'ignore',
      mandatory: field ? isMandatory(field.col) : true,
      confidence: field ? 1 : 0,
      sampleValues,
      emptyValues: [],
    });
  }
  return mappings;
}

// Canonical forms for uniqueness comparison.
function canonicalId(value: string): string {
  return (value ?? '').replace(/\D/g, '').replace(/^0+/, '');
}
function canonicalPhone(value: string): string {
  let x = (value ?? '').trim().replace(/[\s\-().]/g, '');
  if (x.startsWith('+972')) x = '0' + x.slice(4);
  else if (x.startsWith('972')) x = '0' + x.slice(3);
  return x;
}

// Row indices that share a non-empty canonical value in the given column.
function duplicateRows(data: string[][], colIndex: number, canonical: (v: string) => string): Set<number> {
  const byValue = new Map<string, number[]>();
  for (let r = 0; r < data.length; r++) {
    const key = canonical(data[r]?.[colIndex] ?? '');
    if (!key) continue;
    const arr = byValue.get(key);
    if (arr) arr.push(r);
    else byValue.set(key, [r]);
  }
  const dupes = new Set<number>();
  for (const rows of byValue.values()) {
    if (rows.length > 1) for (const r of rows) dupes.add(r);
  }
  return dupes;
}

// Apply Kehilanet cross-row / cross-field rules on top of the per-cell results:
//   - ID number must be unique
//   - mobile phone must be unique
//   - every row must have an email or a mobile phone
// Expects freshly per-cell-validated cells; only upgrades cells to 'error'
// (never hides an existing per-cell error such as an invalid check digit).
export function applyKehilanetCrossRules(cells: CellValidation[], data: string[][]): CellValidation[] {
  const indexByKey = new Map<string, number>();
  cells.forEach((c, i) => indexByKey.set(`${c.row}-${c.column}`, i));
  const next = cells.slice();

  const setError = (row: number, column: number, message: string) => {
    const i = indexByKey.get(`${row}-${column}`);
    if (i === undefined) return;
    if (next[i].status === 'error') return; // keep the more specific per-cell error
    next[i] = { ...next[i], status: 'error', message };
  };

  for (const r of duplicateRows(data, ID_COL, canonicalId)) {
    setError(r, ID_COL, 'validators.id.duplicate');
  }
  for (const r of duplicateRows(data, MOBILE_COL, canonicalPhone)) {
    setError(r, MOBILE_COL, 'validators.phone.duplicate');
  }

  for (let r = 0; r < data.length; r++) {
    const hasEmail = (data[r]?.[EMAIL_COL] ?? '').trim() !== '';
    const hasMobile = (data[r]?.[MOBILE_COL] ?? '').trim() !== '';
    if (!hasEmail && !hasMobile) {
      setError(r, EMAIL_COL, 'validators.kehilanet.emailOrPhone');
      setError(r, MOBILE_COL, 'validators.kehilanet.emailOrPhone');
    }
  }

  return next;
}

function tagsTransform(value: string): string {
  // Replace each comma (and any spaces after it) with "#". A space before the
  // comma is preserved, matching the Mekome import format.
  return value.replace(/,\s*/g, '#');
}

function mekomeValue(mcol: MekomeColumn, row: string[]): string {
  if (mcol.constant !== undefined) return mcol.constant;
  if (mcol.source === null) return '';
  const raw = row[mcol.source] ?? '';
  return mcol.transform === 'tags' ? tagsTransform(raw) : raw;
}

// Convert a single Kehilanet data row into its Mekome column values.
export function mekomeRow(row: string[]): string[] {
  return MEKOME_COLUMNS.map((c) => mekomeValue(c, row));
}

// Which rows to include in a Mekome export.
export type MekomeExportScope = 'all' | 'valid' | 'errors';

const ERROR_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFC7CE' },
};
const ERROR_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF9C0006' } };

// Map each Kehilanet source column to its Mekome output column index, so a
// validation error on a source cell can be highlighted in the output.
const SOURCE_TO_MEKOME = new Map<number, number>();
MEKOME_COLUMNS.forEach((c, i) => {
  if (c.source !== null && !SOURCE_TO_MEKOME.has(c.source)) SOURCE_TO_MEKOME.set(c.source, i);
});

// Group validation errors by row: row index -> set of erroring Kehilanet columns.
export function errorsByRow(result: ValidationResult): Map<number, Set<number>> {
  const map = new Map<number, Set<number>>();
  for (const cell of result.cells) {
    if (cell.status !== 'error') continue;
    let cols = map.get(cell.row);
    if (!cols) {
      cols = new Set();
      map.set(cell.row, cols);
    }
    cols.add(cell.column);
  }
  return map;
}

// The data-row indices to include for a given export scope.
export function selectExportRows(
  parsed: ParsedFile,
  result: ValidationResult,
  scope: MekomeExportScope,
): number[] {
  const rowErrors = errorsByRow(result);
  const indices: number[] = [];
  for (let rowIdx = 0; rowIdx < parsed.data.length; rowIdx++) {
    const hasError = rowErrors.has(rowIdx);
    if (scope === 'valid' && hasError) continue;
    if (scope === 'errors' && !hasError) continue;
    indices.push(rowIdx);
  }
  return indices;
}

// Map erroring Kehilanet source columns to the Mekome output column indices
// that should be highlighted (source columns not present in the output are
// silently skipped).
export function mekomeErrorColumns(kehilanetCols: Iterable<number>): number[] {
  const out: number[] = [];
  for (const kehCol of kehilanetCols) {
    const mekomeIdx = SOURCE_TO_MEKOME.get(kehCol);
    if (mekomeIdx !== undefined) out.push(mekomeIdx);
  }
  return out;
}

// Build and download the Mekome import file from parsed Kehilanet data.
// `scope` selects which rows to include; in the 'errors' scope the offending
// cells are highlighted red in the output file.
export async function exportMekomeFile(
  parsed: ParsedFile,
  result: ValidationResult,
  scope: MekomeExportScope = 'all',
): Promise<void> {
  const rowErrors = errorsByRow(result);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1', {
    views: [{ rightToLeft: true }],
  });

  sheet.addRow(MEKOME_COLUMNS.map((c) => c.en));
  sheet.addRow(MEKOME_COLUMNS.map((c) => c.he));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(2).font = { bold: true };

  for (const rowIdx of selectExportRows(parsed, result, scope)) {
    const excelRow = sheet.addRow(mekomeRow(parsed.data[rowIdx]));

    // Highlight erroring cells when exporting the error rows.
    if (scope === 'errors') {
      const errorCols = rowErrors.get(rowIdx);
      if (errorCols) {
        for (const mekomeIdx of mekomeErrorColumns(errorCols)) {
          const cell = excelRow.getCell(mekomeIdx + 1);
          cell.fill = ERROR_FILL;
          cell.font = ERROR_FONT;
        }
      }
    }
  }

  sheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = String(cell.value ?? '').length;
      if (length > maxLength) maxLength = length;
    });
    column.width = Math.min(maxLength + 2, 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const baseName = parsed.fileName.replace(/\.[^.]+$/, '');
  a.href = url;
  a.download = `mekome_${scope}_${baseName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Kehilanet → Children ("ייבוא ילדים") conversion.
//
// The children import links a parent to a child: one output row per
// parent-child relationship. A Kehilanet person row carries its parents' ID
// numbers ("ת.ז. הורה 1" / "ת.ז. הורה 2"), so every person that names a parent
// IS a child from that parent's perspective. A person with both parents filled
// produces two rows (one per parent). All child identity fields come from the
// person's own row.
// ---------------------------------------------------------------------------

interface ChildrenColumn {
  en: string;
  he: string;
  source: number | null; // fixed child-identity source column, or null (parent, resolved per file)
}

// The children import layout: two header rows (English, then Hebrew) followed by
// data, matching update_sample_children.xlsx. The Parent ID column has no fixed
// source — it is filled per output row from the resolved parent column.
export const CHILDREN_COLUMNS: ChildrenColumn[] = [
  { en: 'Parent ID', he: 'תעודת זהות הורה*', source: null },
  { en: 'Child ID', he: 'תעודת זהות ילד*', source: ID_COL },
  { en: 'Child First Name', he: 'שם פרטי ילד*', source: FIRST_COL },
  { en: 'Child Last Name', he: 'שם משפחה ילד*', source: LAST_COL },
  { en: 'Child Middle Name', he: 'שם אמצעי ילד', source: MIDDLE_COL },
  { en: 'Child Mobile', he: 'נייד ילד', source: MOBILE_COL },
  { en: 'Child Date of Birth', he: 'תאריך לידה ילד', source: DOB_COL },
  { en: 'Child Gender', he: 'מגדר ילד', source: GENDER_COL },
];

// Locate the parent-ID columns by header text rather than by fixed index: the
// 71-column export places "ת.ז. הורה 1" / "ת.ז. הורה 2" at positions that vary
// between export variants, but parseKehilanetFile preserves the real headers.
// A parent-ID header mentions a parent ("הורה") together with an ID token
// ("ת.ז"/"תעודת זהות"), which excludes the "מספר הורה N" (parent serial) columns.
// Returned in column order, so parent 1 precedes parent 2.
export function parentIdColumns(headers: string[]): number[] {
  const out: number[] = [];
  headers.forEach((h, i) => {
    const n = String(h).replace(/["'*]/g, '').replace(/\s+/g, ' ').trim();
    const isParent = n.includes('הורה');
    const isId = /ת\.?ז\.?/.test(n) || n.includes('תעודת זהות');
    if (isParent && isId) out.push(i);
  });
  return out;
}

// Expand a single Kehilanet person row into its children-import rows: one row
// per non-empty parent ID found in `parentCols`. A person with no parent named
// produces no rows (they are not a child of anyone in this file).
export function childRowsForPerson(row: string[], parentCols: number[]): string[][] {
  const rows: string[][] = [];
  for (const pc of parentCols) {
    const parentId = String(row[pc] ?? '').trim();
    if (!parentId) continue;
    rows.push(
      CHILDREN_COLUMNS.map((c) => (c.source === null ? parentId : String(row[c.source] ?? ''))),
    );
  }
  return rows;
}

// Map each Kehilanet source column to its children output column index, so a
// validation error on a source cell can be highlighted in the output.
const SOURCE_TO_CHILDREN = new Map<number, number>();
CHILDREN_COLUMNS.forEach((c, i) => {
  if (c.source !== null && !SOURCE_TO_CHILDREN.has(c.source)) SOURCE_TO_CHILDREN.set(c.source, i);
});

// Map erroring Kehilanet source columns to the children output column indices
// that should be highlighted (source columns not present in the output, and the
// parent columns, are silently skipped).
export function childrenErrorColumns(kehilanetCols: Iterable<number>): number[] {
  const out: number[] = [];
  for (const kehCol of kehilanetCols) {
    const childIdx = SOURCE_TO_CHILDREN.get(kehCol);
    if (childIdx !== undefined) out.push(childIdx);
  }
  return out;
}

// Build and download the children import file from parsed Kehilanet data.
// `scope` selects which source person rows to include (same semantics as the
// Mekome export); each selected person expands to one row per named parent. In
// the 'errors' scope the offending child cells are highlighted red.
export async function exportChildrenFile(
  parsed: ParsedFile,
  result: ValidationResult,
  scope: MekomeExportScope = 'all',
): Promise<void> {
  const parentCols = parentIdColumns(parsed.headers);
  const rowErrors = errorsByRow(result);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1', {
    views: [{ rightToLeft: true }],
  });

  sheet.addRow(CHILDREN_COLUMNS.map((c) => c.en));
  sheet.addRow(CHILDREN_COLUMNS.map((c) => c.he));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(2).font = { bold: true };

  for (const rowIdx of selectExportRows(parsed, result, scope)) {
    const childRows = childRowsForPerson(parsed.data[rowIdx], parentCols);
    for (const values of childRows) {
      const excelRow = sheet.addRow(values);

      // Highlight erroring cells when exporting the error rows.
      if (scope === 'errors') {
        const errorCols = rowErrors.get(rowIdx);
        if (errorCols) {
          for (const childIdx of childrenErrorColumns(errorCols)) {
            const cell = excelRow.getCell(childIdx + 1);
            cell.fill = ERROR_FILL;
            cell.font = ERROR_FONT;
          }
        }
      }
    }
  }

  sheet.columns.forEach((column) => {
    let maxLength = 12;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = String(cell.value ?? '').length;
      if (length > maxLength) maxLength = length;
    });
    column.width = Math.min(maxLength + 2, 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const baseName = parsed.fileName.replace(/\.[^.]+$/, '');
  a.href = url;
  a.download = `children_${scope}_${baseName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
