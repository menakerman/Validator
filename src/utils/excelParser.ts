import * as XLSX from 'xlsx';
import type { ParsedFile } from '../types';

export function parseExcelFile(file: File): Promise<ParsedFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        if (!firstSheet) {
          reject(new Error('upload.error.empty'));
          return;
        }

        const raw: string[][] = XLSX.utils.sheet_to_json(firstSheet, {
          header: 1,
          defval: '',
          raw: false,
        });

        if (raw.length === 0) {
          reject(new Error('upload.error.empty'));
          return;
        }

        // Find the header row: the first row with 3+ non-empty cells
        // This skips report-title rows and blank rows common in exported files
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
    };

    reader.onerror = () => reject(new Error('upload.error.parseError'));
    reader.readAsArrayBuffer(file);
  });
}
