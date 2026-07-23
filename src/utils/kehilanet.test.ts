import { describe, it, expect } from 'vitest';
import { mekomeRow, buildKehilanetMappings, MEKOME_COLUMNS } from './kehilanet';
import type { ParsedFile } from '../types';

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

  it('marks core identity fields as mandatory', () => {
    const byCol = new Map(mappings.map((m) => [m.columnIndex, m]));
    expect(byCol.get(4)?.mandatory).toBe(true);   // ID
    expect(byCol.get(20)?.mandatory).toBe(false); // home phone (optional)
  });
});
