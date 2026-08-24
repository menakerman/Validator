import { describe, it, expect } from 'vitest';
import {
  actionForCode,
  analyzeImportLog,
  buildCorrectedChildren,
  type ChildrenFile,
  type ImportLogRow,
} from './importLog';

// Column order matches the children export: Parent ID, Child ID, First, Last,
// Middle, Mobile, DOB, Gender.
const COLS = [
  'תעודת זהות הורה*', 'תעודת זהות ילד*', 'שם פרטי ילד*', 'שם משפחה ילד*',
  'שם אמצעי ילד', 'נייד ילד', 'תאריך לידה ילד', 'מגדר ילד',
];
const PARENT = 0, CHILD = 1, MOBILE = 5;

function childRow(parentId: string, childId: string, name: string, mobile = ''): string[] {
  const r = new Array(COLS.length).fill('');
  r[PARENT] = parentId; r[CHILD] = childId; r[2] = name; r[MOBILE] = mobile;
  return r;
}

// A children file: two header rows then data. Data-row 1 is the first data row,
// so the log's "row number" is data-row-1-based here (offset 1).
function makeChildrenFile(data: string[][]): ChildrenFile {
  return {
    headerRows: [COLS.map(() => ''), COLS],
    columns: COLS,
    parentIdCol: PARENT,
    childIdCol: CHILD,
    mobileCol: MOBILE,
    data,
  };
}

const logRow = (p: Partial<ImportLogRow>): ImportLogRow => ({
  rowNumber: null, id: '', name: '', code: '', description: '', status: 'שגיאה', details: '', ...p,
});

describe('actionForCode', () => {
  it('excludes un-creatable codes and repairs invalid phone', () => {
    expect(actionForCode('PARENT_NOT_FOUND')).toBe('exclude');
    expect(actionForCode('DUPLICATE_USER')).toBe('exclude');
    expect(actionForCode('MISSING_CHILD_ID')).toBe('exclude');
    expect(actionForCode('InvalidPrimaryPhone')).toBe('repairPhone');
  });
  it('defaults unknown codes to exclude', () => {
    expect(actionForCode('SOMETHING_NEW')).toBe('exclude');
  });
});

describe('analyzeImportLog', () => {
  it('counts by code, most frequent first, with descriptions and actions', () => {
    const rows = [
      logRow({ code: 'PARENT_NOT_FOUND', description: 'הורה לא נמצא' }),
      logRow({ code: 'PARENT_NOT_FOUND', description: 'הורה לא נמצא' }),
      logRow({ code: 'InvalidPrimaryPhone', description: 'נייד לא תקין' }),
    ];
    const a = analyzeImportLog(rows);
    expect(a.total).toBe(3);
    expect(a.byCode[0]).toMatchObject({ code: 'PARENT_NOT_FOUND', count: 2, action: 'exclude' });
    expect(a.byCode[1]).toMatchObject({ code: 'InvalidPrimaryPhone', count: 1, action: 'repairPhone' });
  });
});

describe('buildCorrectedChildren', () => {
  const data = [
    childRow('111111111', '220313217', 'ארבל', '0501111111'), // row 1
    childRow('111111111', '220313225', 'ירדן', '0502222222'), // row 2
    childRow('222222222', '339190902', 'מיתר', '0503333333'), // row 3
    childRow('333333333', '', 'ילד ללא ת.ז.', '0504444444'),  // row 4 (missing id)
    childRow('444444444', '239654452', 'כרמל', 'not-a-phone'), // row 5 (bad phone)
    childRow('555555555', '999999999', 'תקין', '0505555555'),  // row 6 (no error)
  ];
  const child = makeChildrenFile(data);

  const log: ImportLogRow[] = [
    logRow({ rowNumber: 1, id: '220313217', name: 'ארבל', code: 'PARENT_NOT_FOUND',
      details: 'מחפש הורה לפי ת.ז. 111111111 | הורה לא נמצא במערכת' }),
    logRow({ rowNumber: 3, id: '339190902', name: 'מיתר', code: 'DUPLICATE_USER',
      details: 'מחפש הורה לפי ת.ז. 222222222 | ילד קיים' }),
    logRow({ rowNumber: 4, id: '', name: 'ילד ללא ת.ז.', code: 'MISSING_CHILD_ID',
      details: 'חסרה ת.ז. ילד' }),
    logRow({ rowNumber: 5, id: '239654452', name: 'כרמל', code: 'InvalidPrimaryPhone',
      details: 'מחפש הורה לפי ת.ז. 444444444 | שגיאה — מספר הטלפון הנייד אינו תקין' }),
  ];

  const fix = buildCorrectedChildren(log, child);

  it('detects the row-number offset and matches every log row', () => {
    expect(fix.offset).toBe(1);
    expect(fix.matched).toBe(4);
    expect(fix.unmatched).toBe(0);
  });

  it('excludes un-creatable rows and repairs the bad phone', () => {
    expect(fix.removedRows).toBe(3); // rows 1, 3, 4
    expect(fix.excludedByCode).toEqual({ PARENT_NOT_FOUND: 1, DUPLICATE_USER: 1, MISSING_CHILD_ID: 1 });
    expect(fix.repaired).toBe(1); // row 5
    expect(fix.remainingRows).toBe(3); // rows 2, 5, 6
  });

  it('keeps unaffected rows and clears the invalid mobile on repaired rows', () => {
    const ids = fix.data.map((r) => r[CHILD]);
    expect(ids).toEqual(['220313225', '239654452', '999999999']); // rows 2, 5, 6
    const carmel = fix.data.find((r) => r[CHILD] === '239654452')!;
    expect(carmel[MOBILE]).toBe(''); // invalid phone cleared
    const intact = fix.data.find((r) => r[CHILD] === '999999999')!;
    expect(intact[MOBILE]).toBe('0505555555'); // untouched
  });

  it('disambiguates a two-parent child by the parent ID in the details', () => {
    // Two rows share child ID 201; the log names parent 222 in the details,
    // so only the row linking to parent 222 is excluded.
    const twoParent = makeChildrenFile([
      childRow('111', '201', 'תאום', '0501'),
      childRow('222', '201', 'תאום', '0501'),
    ]);
    const twoLog = [
      logRow({ rowNumber: 99, id: '201', code: 'PARENT_NOT_FOUND',
        details: 'מחפש הורה לפי ת.ז. 222 | הורה לא נמצא' }), // bad rowNumber → falls back to id+parent
    ];
    const r = buildCorrectedChildren(twoLog, twoParent);
    expect(r.removedRows).toBe(1);
    expect(r.data.map((x) => x[PARENT])).toEqual(['111']); // parent-222 row removed
  });
});
