import * as XLSX from 'xlsx';
import type { ParsedFile } from '../types';

// Detect if a buffer starts with HTML content (common for fake .xls exports)
function isHtmlFile(data: Uint8Array): boolean {
  const head = new TextDecoder('ascii').decode(data.slice(0, 500)).toLowerCase();
  return head.includes('<!doctype html') || head.includes('<html') || head.includes('<table');
}

// Detect charset from HTML meta tag
function detectCharset(data: Uint8Array): string {
  const head = new TextDecoder('ascii').decode(data.slice(0, 1000)).toLowerCase();
  const match = head.match(/charset[=\s]*([a-z0-9-]+)/);
  return match?.[1] ?? 'utf-8';
}

// Parse an HTML table into rows of strings
function parseHtmlTable(html: string): string[][] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('table');
  if (!table) return [];

  const rows: string[][] = [];
  for (const tr of table.querySelectorAll('tr')) {
    const cells: string[] = [];
    for (const td of tr.querySelectorAll('td, th')) {
      cells.push((td.textContent ?? '').trim());
    }
    if (cells.length > 0) {
      rows.push(cells);
    }
  }
  return rows;
}

// Read the first worksheet of a file into raw rows of strings, handling both
// real spreadsheets and HTML-based `.xls` exports. Returns [] when unreadable.
export function readFileRows(file: File): Promise<string[][]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const arrayBuf = e.target?.result as ArrayBuffer;
        const data = new Uint8Array(arrayBuf);

        let raw: string[][];

        if (isHtmlFile(data)) {
          // HTML-based .xls: decode with correct charset, parse HTML table directly
          const charset = detectCharset(data);
          const html = new TextDecoder(charset).decode(data);
          raw = parseHtmlTable(html);
        } else {
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

          if (!firstSheet) {
            resolve([]);
            return;
          }

          raw = XLSX.utils.sheet_to_json(firstSheet, {
            header: 1,
            defval: '',
            raw: false,
          });
        }

        resolve(raw);
      } catch {
        reject(new Error('upload.error.parseError'));
      }
    };

    reader.onerror = () => reject(new Error('upload.error.parseError'));
    reader.readAsArrayBuffer(file);
  });
}

export function parseExcelFile(file: File): Promise<ParsedFile> {
  return readFileRows(file).then((raw) => {
    return new Promise<ParsedFile>((resolve, reject) => {
      try {
        if (raw.length === 0) {
          reject(new Error('upload.error.empty'));
          return;
        }

        // Find the header row: the first row with 3+ non-empty cells
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(raw.length, 10); i++) {
          const nonEmpty = raw[i].filter((cell) => String(cell).trim() !== '').length;
          if (nonEmpty >= 3) {
            headerRowIndex = i;
            break;
          }
        }

        const headers = raw[headerRowIndex].map((h) => String(h).trim());
        const rows = raw
          .slice(headerRowIndex + 1)
          .filter((row) => row.some((cell) => String(cell).trim() !== ''));

        if (rows.length === 0) {
          reject(new Error('upload.error.empty'));
          return;
        }

        // Ensure all rows have the same number of columns as headers
        const normalizedRows = rows.map((row) => {
          const normalized = new Array(headers.length).fill('');
          for (let i = 0; i < headers.length; i++) {
            normalized[i] = String(row[i] ?? '').trim();
          }
          return normalized;
        });

        resolve({
          fileName: file.name,
          headers,
          data: normalizedRows,
          totalRows: normalizedRows.length,
        });
      } catch {
        reject(new Error('upload.error.parseError'));
      }
    });
  });
}
