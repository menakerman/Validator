export type ColumnType = 'id' | 'phone' | 'landline' | 'email' | 'ignore';

export type ValidationStatus = 'valid' | 'warning' | 'error';

export interface ColumnMapping {
  columnIndex: number;
  headerName: string;
  type: ColumnType;
  mandatory: boolean;
  confidence: number;
  sampleValues: string[];
}

export interface CellValidation {
  row: number;
  column: number;
  originalValue: string;
  status: ValidationStatus;
  message: string;
  suggestion?: string;
}

export interface ValidationResult {
  cells: CellValidation[];
  summary: ValidationSummary;
}

export interface ValidationSummary {
  totalCells: number;
  validCount: number;
  warningCount: number;
  errorCount: number;
  perColumn: PerColumnSummary[];
}

export interface PerColumnSummary {
  columnIndex: number;
  headerName: string;
  type: ColumnType;
  total: number;
  valid: number;
  warnings: number;
  errors: number;
}

export interface ParsedFile {
  fileName: string;
  headers: string[];
  data: string[][];
  totalRows: number;
}

export type AppStep = 'upload' | 'mapping' | 'validating' | 'results';

export type ResultFilter = 'all' | 'valid' | 'warning' | 'error';

export interface ValidatorState {
  step: AppStep;
  parsedFile: ParsedFile | null;
  columnMappings: ColumnMapping[];
  validationResult: ValidationResult | null;
  validationProgress: number;
  resultFilter: ResultFilter;
  currentPage: number;
  error: string | null;
}

export interface WorkerMessage {
  type: 'validate';
  data: string[][];
  mappings: ColumnMapping[];
}

export interface WorkerProgress {
  type: 'progress';
  percent: number;
}

export interface WorkerResult {
  type: 'result';
  cells: CellValidation[];
  summary: ValidationSummary;
}

export type WorkerResponse = WorkerProgress | WorkerResult;
