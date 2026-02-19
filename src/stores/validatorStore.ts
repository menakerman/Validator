import { create } from 'zustand';
import type {
  AppStep,
  CellValidation,
  ColumnMapping,
  ColumnType,
  ParsedFile,
  PerColumnSummary,
  ResultFilter,
  ValidationResult,
  ValidationSummary,
  WorkerResponse,
} from '../types';
import { validate } from '../validators';
import { parseExcelFile } from '../utils/excelParser';
import { detectColumnTypes } from '../utils/columnDetector';

const WORKER_THRESHOLD = 10000;

interface ValidatorStore {
  step: AppStep;
  parsedFile: ParsedFile | null;
  columnMappings: ColumnMapping[];
  validationResult: ValidationResult | null;
  validationProgress: number;
  resultFilter: ResultFilter;
  currentPage: number;
  error: string | null;

  parseFile: (file: File) => Promise<void>;
  setColumnType: (columnIndex: number, type: ColumnType) => void;
  setColumnMandatory: (columnIndex: number, mandatory: boolean) => void;
  runValidation: () => void;
  applySuggestion: (row: number, column: number) => void;
  applyAllSuggestions: () => void;
  updateCellValue: (row: number, column: number, newValue: string) => void;
  setResultFilter: (filter: ResultFilter) => void;
  setCurrentPage: (page: number) => void;
  reset: () => void;
}

export const useValidatorStore = create<ValidatorStore>((set, get) => ({
  step: 'upload',
  parsedFile: null,
  columnMappings: [],
  validationResult: null,
  validationProgress: 0,
  resultFilter: 'all',
  currentPage: 1,
  error: null,

  parseFile: async (file: File) => {
    try {
      set({ error: null });
      const parsed = await parseExcelFile(file);
      const mappings = detectColumnTypes(parsed.headers, parsed.data);
      set({
        parsedFile: parsed,
        columnMappings: mappings,
        step: 'mapping',
      });
    } catch (err) {
      set({ error: (err as Error).message });
    }
  },

  setColumnType: (columnIndex: number, type: ColumnType) => {
    const mappings = get().columnMappings.map((m) =>
      m.columnIndex === columnIndex
        ? { ...m, type, confidence: type === 'ignore' ? 0 : 1 }
        : m,
    );
    set({ columnMappings: mappings });
  },

  setColumnMandatory: (columnIndex: number, mandatory: boolean) => {
    const mappings = get().columnMappings.map((m) =>
      m.columnIndex === columnIndex ? { ...m, mandatory } : m,
    );
    set({ columnMappings: mappings });
  },

  runValidation: () => {
    const { parsedFile, columnMappings } = get();
    if (!parsedFile) return;

    const activeMappings = columnMappings.filter((m) => m.type !== 'ignore');
    if (activeMappings.length === 0) return;

    set({ step: 'validating', validationProgress: 0 });

    if (parsedFile.totalRows > WORKER_THRESHOLD) {
      // Use Web Worker
      const worker = new Worker(
        new URL('../workers/validation.worker.ts', import.meta.url),
        { type: 'module' },
      );

      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          set({ validationProgress: msg.percent });
        } else if (msg.type === 'result') {
          set({
            validationResult: { cells: msg.cells, summary: msg.summary },
            validationProgress: 100,
            step: 'results',
            currentPage: 1,
            resultFilter: 'all',
          });
          worker.terminate();
        }
      };

      worker.postMessage({
        type: 'validate',
        data: parsedFile.data,
        mappings: columnMappings,
      });
    } else {
      // Inline validation with batched yields
      const data = parsedFile.data;
      const cells: CellValidation[] = [];
      const totalRows = data.length;
      const BATCH_SIZE = 500;
      let rowIdx = 0;

      const processBatch = () => {
        const end = Math.min(rowIdx + BATCH_SIZE, totalRows);
        for (; rowIdx < end; rowIdx++) {
          const row = data[rowIdx];
          for (const mapping of activeMappings) {
            const value = row[mapping.columnIndex] ?? '';
            const result = validate(value, mapping.type, rowIdx, mapping.columnIndex, mapping.mandatory);
            cells.push(result);
          }
        }

        set({ validationProgress: Math.round((rowIdx / totalRows) * 100) });

        if (rowIdx < totalRows) {
          requestAnimationFrame(processBatch);
        } else {
          // Build summary
          const summary = buildSummary(cells, activeMappings);
          set({
            validationResult: { cells, summary },
            validationProgress: 100,
            step: 'results',
            currentPage: 1,
            resultFilter: 'all',
          });
        }
      };

      requestAnimationFrame(processBatch);
    }
  },

  applySuggestion: (row: number, column: number) => {
    const { parsedFile, validationResult, columnMappings } = get();
    if (!parsedFile || !validationResult) return;

    const cellIdx = validationResult.cells.findIndex(
      (c) => c.row === row && c.column === column && c.suggestion,
    );
    if (cellIdx === -1) return;

    const cell = validationResult.cells[cellIdx];
    const mapping = columnMappings.find((m) => m.columnIndex === column);
    if (!mapping) return;

    // Update the source data
    const newData = parsedFile.data.map((r) => [...r]);
    newData[row][column] = cell.suggestion!;

    // Re-validate the fixed cell
    const newCell = validate(cell.suggestion!, mapping.type, row, column, mapping.mandatory);
    const newCells = [...validationResult.cells];
    newCells[cellIdx] = newCell;

    const activeMappings = columnMappings.filter((m) => m.type !== 'ignore');
    const summary = buildSummary(newCells, activeMappings);

    set({
      parsedFile: { ...parsedFile, data: newData },
      validationResult: { cells: newCells, summary },
    });
  },

  updateCellValue: (row: number, column: number, newValue: string) => {
    const { parsedFile, validationResult, columnMappings } = get();
    if (!parsedFile || !validationResult) return;

    const cellIdx = validationResult.cells.findIndex(
      (c) => c.row === row && c.column === column,
    );
    if (cellIdx === -1) return;

    const mapping = columnMappings.find((m) => m.columnIndex === column);
    if (!mapping) return;

    const newData = parsedFile.data.map((r) => [...r]);
    newData[row][column] = newValue;

    const newCell = validate(newValue, mapping.type, row, column, mapping.mandatory);
    const newCells = [...validationResult.cells];
    newCells[cellIdx] = newCell;

    const activeMappings = columnMappings.filter((m) => m.type !== 'ignore');
    const summary = buildSummary(newCells, activeMappings);

    set({
      parsedFile: { ...parsedFile, data: newData },
      validationResult: { cells: newCells, summary },
    });
  },

  applyAllSuggestions: () => {
    const { parsedFile, validationResult, columnMappings } = get();
    if (!parsedFile || !validationResult) return;

    const newData = parsedFile.data.map((r) => [...r]);
    const newCells = [...validationResult.cells];

    for (let i = 0; i < newCells.length; i++) {
      const cell = newCells[i];
      if (!cell.suggestion) continue;

      const mapping = columnMappings.find((m) => m.columnIndex === cell.column);
      if (!mapping) continue;

      newData[cell.row][cell.column] = cell.suggestion;
      newCells[i] = validate(cell.suggestion, mapping.type, cell.row, cell.column, mapping.mandatory);
    }

    const activeMappings = columnMappings.filter((m) => m.type !== 'ignore');
    const summary = buildSummary(newCells, activeMappings);

    set({
      parsedFile: { ...parsedFile, data: newData },
      validationResult: { cells: newCells, summary },
    });
  },

  setResultFilter: (filter: ResultFilter) => {
    set({ resultFilter: filter, currentPage: 1 });
  },

  setCurrentPage: (page: number) => {
    set({ currentPage: page });
  },

  reset: () => {
    set({
      step: 'upload',
      parsedFile: null,
      columnMappings: [],
      validationResult: null,
      validationProgress: 0,
      resultFilter: 'all',
      currentPage: 1,
      error: null,
    });
  },

}));

export const ROWS_PER_PAGE = 100;

function buildSummary(
  cells: CellValidation[],
  activeMappings: ColumnMapping[],
): ValidationSummary {
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

  return {
    totalCells: cells.length,
    validCount,
    warningCount,
    errorCount,
    perColumn: Array.from(perColumnMap.values()),
  };
}
