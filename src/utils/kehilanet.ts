import ExcelJS from 'exceljs';
import type { ColumnMapping, ColumnType, ParsedFile, ValidationResult } from '../types';
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

interface KehilanetField {
  col: number;
  type: ColumnType;
  mandatory: boolean;
}

// Columns to validate on the Kehilanet file, per the agreed format.
export const KEHILANET_FIELDS: KehilanetField[] = [
  { col: col('B'), type: 'string', mandatory: true },           // שם פרטי
  { col: col('C'), type: 'string', mandatory: true },           // שם משפחה
  { col: col('D'), type: 'date', mandatory: true },             // תאריך לידה
  { col: col('E'), type: 'id', mandatory: true },               // תעודת זהות
  { col: col('L'), type: 'string', mandatory: false },          // ישוב
  { col: col('M'), type: 'string', mandatory: false },          // שכונה
  { col: col('N'), type: 'string', mandatory: false },          // רחוב
  { col: col('R'), type: 'email', mandatory: false },           // דואר אלקטרוני
  { col: col('T'), type: 'string', mandatory: false },          // שם נעורים
  { col: col('U'), type: 'phoneOrLandline', mandatory: false }, // טלפון בית
  { col: col('V'), type: 'phone', mandatory: false },           // טלפון נייד
  { col: col('W'), type: 'phone', mandatory: false },           // טלפון נייד נוסף
  { col: col('AK'), type: 'string', mandatory: false },         // מין
  { col: col('AL'), type: 'string', mandatory: false },         // מצב משפחתי
  { col: col('AO'), type: 'string', mandatory: false },         // סוג משתמש
  { col: col('AQ'), type: 'id', mandatory: false },             // ת.ז. בן/בת זוג
  { col: col('BA'), type: 'string', mandatory: false },         // ממ"ד/מקלט
  { col: col('BD'), type: 'string', mandatory: false },         // איש קשר במקרה אסון
  { col: col('BE'), type: 'string', mandatory: false },         // טלפון איש קשר במקרה אסון
  { col: col('BS'), type: 'string', mandatory: false },         // קבוצות
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
      mandatory: field ? field.mandatory : true,
      confidence: field ? 1 : 0,
      sampleValues,
      emptyValues: [],
    });
  }
  return mappings;
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
