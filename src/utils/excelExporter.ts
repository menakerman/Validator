import ExcelJS from 'exceljs';
import type { CellValidation, ColumnMapping, ParsedFile, ValidationResult } from '../types';

const STATUS_FILLS: Record<string, ExcelJS.FillPattern> = {
  valid: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFD5F5E3' },
  },
  warning: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFEF3C7' },
  },
  error: {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFEE2E2' },
  },
};

export async function exportValidatedExcel(
  parsedFile: ParsedFile,
  mappings: ColumnMapping[],
  result: ValidationResult,
  t: (key: string, options?: Record<string, string>) => string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();

  // Data sheet
  const dataSheet = workbook.addWorksheet('Data', {
    views: [{ rightToLeft: true }],
  });

  // Build header row: original headers + "Validation Notes"
  const headerRow = [...parsedFile.headers, t('results.summary')];
  dataSheet.addRow(headerRow);

  // Style header row
  const hRow = dataSheet.getRow(1);
  hRow.font = { bold: true };
  hRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E40AF' },
  };
  hRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Build a lookup for cell validations
  const cellMap = new Map<string, CellValidation>();
  for (const cell of result.cells) {
    cellMap.set(`${cell.row}-${cell.column}`, cell);
  }

  // Validated column indices
  const validatedCols = new Set(
    mappings.filter((m) => m.type !== 'ignore').map((m) => m.columnIndex),
  );

  // Add data rows
  for (let rowIdx = 0; rowIdx < parsedFile.data.length; rowIdx++) {
    const rowData = parsedFile.data[rowIdx];
    const notes: string[] = [];
    const excelRow = dataSheet.addRow([...rowData, '']);

    for (const colIdx of validatedCols) {
      const key = `${rowIdx}-${colIdx}`;
      const cellValidation = cellMap.get(key);
      if (cellValidation) {
        const cell = excelRow.getCell(colIdx + 1);
        cell.fill = STATUS_FILLS[cellValidation.status];

        if (cellValidation.status !== 'valid') {
          const msg = t(cellValidation.message, { suggestion: cellValidation.suggestion ?? '' });
          notes.push(`${parsedFile.headers[colIdx]}: ${msg}`);
        }
      }
    }

    // Write notes to last column
    if (notes.length > 0) {
      excelRow.getCell(parsedFile.headers.length + 1).value = notes.join(' | ');
    }
  }

  // Auto-fit column widths
  dataSheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: false }, (cell) => {
      const length = String(cell.value ?? '').length;
      if (length > maxLength) maxLength = length;
    });
    column.width = Math.min(maxLength + 2, 40);
  });

  // Summary sheet
  const summarySheet = workbook.addWorksheet(t('results.summary'), {
    views: [{ rightToLeft: true }],
  });

  summarySheet.addRow([t('results.summary')]);
  summarySheet.getRow(1).font = { bold: true, size: 14 };
  summarySheet.addRow([]);
  summarySheet.addRow([t('results.totalCells'), result.summary.totalCells]);
  summarySheet.addRow([t('results.valid'), result.summary.validCount]);
  summarySheet.addRow([t('results.warnings'), result.summary.warningCount]);
  summarySheet.addRow([t('results.errors'), result.summary.errorCount]);

  summarySheet.addRow([]);
  summarySheet.addRow([t('results.perColumn')]);
  summarySheet.getRow(8).font = { bold: true };

  for (const col of result.summary.perColumn) {
    summarySheet.addRow([
      col.headerName,
      `${t('results.valid')}: ${col.valid}`,
      `${t('results.warnings')}: ${col.warnings}`,
      `${t('results.errors')}: ${col.errors}`,
    ]);
  }

  summarySheet.columns.forEach((column) => {
    column.width = 20;
  });

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `validated_${parsedFile.fileName}`;
  a.click();
  URL.revokeObjectURL(url);
}
