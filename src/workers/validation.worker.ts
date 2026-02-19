import { validate } from '../validators';
import type { CellValidation, PerColumnSummary, ValidationSummary, WorkerMessage, WorkerProgress, WorkerResult } from '../types';

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { data, mappings } = e.data;
  const activeMappings = mappings.filter((m) => m.type !== 'ignore');
  const cells: CellValidation[] = [];
  const totalRows = data.length;
  const BATCH_SIZE = 1000;

  for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
    const row = data[rowIdx];
    for (const mapping of activeMappings) {
      const value = row[mapping.columnIndex] ?? '';
      const result = validate(value, mapping.type, rowIdx, mapping.columnIndex, mapping.mandatory);
      cells.push(result);
    }

    if ((rowIdx + 1) % BATCH_SIZE === 0 || rowIdx === totalRows - 1) {
      const progress: WorkerProgress = {
        type: 'progress',
        percent: Math.round(((rowIdx + 1) / totalRows) * 100),
      };
      self.postMessage(progress);
    }
  }

  // Build summary
  let validCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  const perColumnMap = new Map<number, PerColumnSummary>();
  for (const mapping of activeMappings) {
    perColumnMap.set(mapping.columnIndex, {
      columnIndex: mapping.columnIndex,
      headerName: mapping.headerName,
      type: mapping.type,
      total: 0,
      valid: 0,
      warnings: 0,
      errors: 0,
    });
  }

  for (const cell of cells) {
    const col = perColumnMap.get(cell.column);
    if (col) {
      col.total++;
      if (cell.status === 'valid') { col.valid++; validCount++; }
      else if (cell.status === 'warning') { col.warnings++; warningCount++; }
      else { col.errors++; errorCount++; }
    }
  }

  const summary: ValidationSummary = {
    totalCells: cells.length,
    validCount,
    warningCount,
    errorCount,
    perColumn: Array.from(perColumnMap.values()),
  };

  const result: WorkerResult = { type: 'result', cells, summary };
  self.postMessage(result);
};
