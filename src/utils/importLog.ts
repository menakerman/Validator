import ExcelJS from 'exceljs';
import { readFileRows } from './excelParser';

// ---------------------------------------------------------------------------
// Import-log analysis ("יומן ייבוא") + corrected re-import file.
//
// After a children import, Kehilanet returns a log listing every failed row:
// row number, child ID, name, error code + Hebrew description, and a details
// trace. This module parses that log, summarises it by error code, and — given
// the original children import file — produces a corrected file that drops the
// rows that cannot be created and repairs the ones that can.
// ---------------------------------------------------------------------------

export interface ImportLogRow {
  rowNumber: number | null; // "מספר שורה" — 1-based position in the imported file
  id: string;               // child ID (may be empty for MISSING_CHILD_ID)
  name: string;
  code: string;
  description: string;
  status: string;
  details: string;
}

// How the fixer treats a source row for a given error code.
//   'exclude'     — the row cannot be created; drop it from the re-import file.
//   'repairPhone' — the row is creatable once the invalid mobile is cleared.
export type FixAction = 'exclude' | 'repairPhone';

// Known children-import error codes → fix action. Unknown codes default to
// 'exclude' (the safe choice: keep an un-importable row out of the retry).
export const ERROR_CODE_ACTIONS: Record<string, FixAction> = {
  PARENT_NOT_FOUND: 'exclude',
  DUPLICATE_USER: 'exclude',
  MISSING_CHILD_ID: 'exclude',
  InvalidPrimaryPhone: 'repairPhone',
};

export function actionForCode(code: string): FixAction {
  return ERROR_CODE_ACTIONS[code] ?? 'exclude';
}

// Canonical ID for comparison: digits only, no leading zeros.
function canonicalId(value: string): string {
  return (value ?? '').replace(/\D/g, '').replace(/^0+/, '');
}

function findHeaderRow(raw: string[][], markers: string[]): number {
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const cells = raw[i].map((c) => String(c).trim());
    if (cells.some((c) => markers.some((m) => c.includes(m)))) return i;
  }
  return -1;
}

// Parse a Kehilanet import log into typed rows. Columns are located by header
// text so the parser tolerates reordering or extra columns.
export async function parseImportLogFile(file: File): Promise<ImportLogRow[]> {
  const raw = await readFileRows(file);
  if (raw.length === 0) throw new Error('importLog.error.empty');

  const hi = findHeaderRow(raw, ['קוד שגיאה', 'מספר שורה']);
  if (hi === -1) throw new Error('importLog.error.notLog');

  const headers = raw[hi].map((h) => String(h).trim());
  const findCol = (...subs: string[]) => headers.findIndex((h) => subs.some((s) => h.includes(s)));
  const cRow = findCol('מספר שורה');
  const cId = findCol('תעודת זהות');
  const cName = findCol('שם משתמש');
  const cCode = findCol('קוד שגיאה');
  const cDesc = findCol('תיאור שגיאה', 'תיאור');
  const cStatus = findCol('סטטוס');
  const cDetails = findCol('פרטים');

  const at = (row: string[], i: number) => (i >= 0 ? String(row[i] ?? '').trim() : '');

  const rows: ImportLogRow[] = [];
  for (const row of raw.slice(hi + 1)) {
    if (!row.some((c) => String(c).trim() !== '')) continue;
    const numText = at(row, cRow).replace(/\D/g, '');
    const num = numText ? parseInt(numText, 10) : NaN;
    rows.push({
      rowNumber: Number.isFinite(num) ? num : null,
      id: at(row, cId),
      name: at(row, cName),
      code: at(row, cCode),
      description: at(row, cDesc),
      status: at(row, cStatus),
      details: at(row, cDetails),
    });
  }
  if (rows.length === 0) throw new Error('importLog.error.empty');
  return rows;
}

export interface CodeSummary {
  code: string;
  count: number;
  description: string;
  action: FixAction;
}

export interface ImportLogAnalysis {
  total: number;
  byCode: CodeSummary[];
}

// Summarise the log by error code, most frequent first.
export function analyzeImportLog(rows: ImportLogRow[]): ImportLogAnalysis {
  const map = new Map<string, { count: number; description: string }>();
  for (const r of rows) {
    const key = r.code || '—';
    const entry = map.get(key) ?? { count: 0, description: r.description };
    entry.count += 1;
    if (!entry.description && r.description) entry.description = r.description;
    map.set(key, entry);
  }
  const byCode = [...map.entries()]
    .map(([code, v]) => ({ code, count: v.count, description: v.description, action: actionForCode(code) }))
    .sort((a, b) => b.count - a.count);
  return { total: rows.length, byCode };
}

export interface ChildrenFile {
  headerRows: string[][]; // the file's own header rows (EN + HE), re-emitted verbatim
  columns: string[];      // the Hebrew header row
  parentIdCol: number;
  childIdCol: number;
  mobileCol: number;
  data: string[][];       // data rows, in the file's own column order
}

// Parse a children import file (the format produced by the children export:
// two header rows then data). Key columns are found by Hebrew header text.
export async function parseChildrenImportFile(file: File): Promise<ChildrenFile> {
  const raw = await readFileRows(file);
  if (raw.length === 0) throw new Error('importLog.error.empty');

  const hi = findHeaderRow(raw, ['תעודת זהות ילד']);
  if (hi === -1) throw new Error('importLog.error.notChildren');

  const columns = raw[hi].map((h) => String(h).trim());
  const childIdCol = columns.findIndex((h) => h.includes('תעודת זהות ילד'));
  const parentIdCol = columns.findIndex((h) => h.includes('תעודת זהות הורה'));
  const mobileCol = columns.findIndex((h) => h.includes('נייד'));

  // Preserve the file's own header rows (the English row above, if present).
  const headerRows = (hi >= 1 ? raw.slice(hi - 1, hi + 1) : raw.slice(hi, hi + 1)).map((r) =>
    r.map((c) => String(c ?? '')),
  );

  const data = raw
    .slice(hi + 1)
    .filter((r) => r.some((c) => String(c).trim() !== ''))
    .map((r) => r.map((c) => String(c ?? '').trim()));

  return { headerRows, columns, parentIdCol, childIdCol, mobileCol, data };
}

// Detect the offset between the log's "row number" and the children file's
// 0-based data index (data-row-1-based → 1, Excel-row-with-2-headers → 3, ...),
// by choosing the offset that best aligns child IDs.
function detectOffset(log: ImportLogRow[], child: ChildrenFile): number {
  const candidates = [1, 3, 2, 0];
  let best = 1;
  let bestScore = -1;
  for (const d of candidates) {
    let score = 0;
    let checked = 0;
    for (const r of log) {
      if (r.rowNumber == null || !r.id) continue;
      const idx = r.rowNumber - d;
      if (idx < 0 || idx >= child.data.length) continue;
      checked += 1;
      if (canonicalId(child.data[idx][child.childIdCol] ?? '') === canonicalId(r.id)) score += 1;
    }
    if (checked > 0 && score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

const PARENT_IN_DETAILS = /לפי ת\.?ז\.?\s*([0-9]+)/;

// Locate the children-file data row a log entry refers to. Prefer the row
// number (the only key that works for rows with no child ID); fall back to
// matching by child ID, disambiguated by the parent ID named in the details.
function locateRow(r: ImportLogRow, child: ChildrenFile, offset: number): number {
  if (r.rowNumber != null) {
    const idx = r.rowNumber - offset;
    if (idx >= 0 && idx < child.data.length) {
      const idOk = !r.id || canonicalId(child.data[idx][child.childIdCol] ?? '') === canonicalId(r.id);
      if (idOk) return idx;
    }
  }
  if (r.id && child.childIdCol >= 0) {
    const pm = r.details.match(PARENT_IN_DETAILS);
    const pid = pm ? pm[1] : '';
    const hits: number[] = [];
    for (let i = 0; i < child.data.length; i++) {
      if (canonicalId(child.data[i][child.childIdCol] ?? '') !== canonicalId(r.id)) continue;
      if (pid && child.parentIdCol >= 0 && canonicalId(child.data[i][child.parentIdCol] ?? '') !== canonicalId(pid)) {
        continue;
      }
      hits.push(i);
    }
    if (hits.length === 1) return hits[0];
    if (hits.length > 1 && r.rowNumber != null) {
      const expected = r.rowNumber - offset;
      return hits.reduce((a, b) => (Math.abs(b - expected) < Math.abs(a - expected) ? b : a));
    }
    if (hits.length > 0) return hits[0];
  }
  return -1;
}

export interface FixResult {
  offset: number;
  matched: number;                       // log rows mapped to a source row
  unmatched: number;                     // log rows that could not be located
  total: number;                         // total log rows
  excludedByCode: Record<string, number>;
  repaired: number;
  removedRows: number;
  remainingRows: number;
  data: string[][];                      // corrected data rows (file column order)
  headerRows: string[][];
}

// Build the corrected children data: drop excluded rows, clear the mobile on
// rows repaired for InvalidPrimaryPhone, keep everything else untouched.
export function buildCorrectedChildren(log: ImportLogRow[], child: ChildrenFile): FixResult {
  const offset = detectOffset(log, child);
  const exclude = new Set<number>();
  const repair = new Set<number>();
  const excludedByCode: Record<string, number> = {};
  let matched = 0;

  for (const r of log) {
    const idx = locateRow(r, child, offset);
    if (idx < 0) continue;
    matched += 1;
    if (actionForCode(r.code) === 'repairPhone') {
      repair.add(idx);
    } else {
      exclude.add(idx);
      excludedByCode[r.code] = (excludedByCode[r.code] ?? 0) + 1;
    }
  }
  // If a row is both excluded and repaired, exclusion wins — it cannot import.
  for (const i of exclude) repair.delete(i);

  const data: string[][] = [];
  for (let i = 0; i < child.data.length; i++) {
    if (exclude.has(i)) continue;
    const row = child.data[i].slice();
    if (repair.has(i) && child.mobileCol >= 0) row[child.mobileCol] = '';
    data.push(row);
  }

  return {
    offset,
    matched,
    unmatched: log.length - matched,
    total: log.length,
    excludedByCode,
    repaired: repair.size,
    removedRows: exclude.size,
    remainingRows: data.length,
    data,
    headerRows: child.headerRows,
  };
}

// Write and download the corrected children re-import file.
export async function exportCorrectedChildrenFile(fix: FixResult, baseName: string): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sheet1', { views: [{ rightToLeft: true }] });

  for (const header of fix.headerRows) {
    sheet.addRow(header).font = { bold: true };
  }
  for (const row of fix.data) {
    sheet.addRow(row);
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
  a.href = url;
  a.download = `children_fixed_${baseName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
