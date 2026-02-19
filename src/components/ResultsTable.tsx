import { useMemo, useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useValidatorStore, ROWS_PER_PAGE } from '../stores/validatorStore';
import { CellTooltip } from './CellTooltip';
import type { CellValidation, ResultFilter } from '../types';

const STATUS_BG: Record<string, string> = {
  valid: 'bg-valid-100',
  warning: 'bg-warning-100',
  error: 'bg-error-100',
};

const FILTERS: ResultFilter[] = ['all', 'valid', 'warning', 'error'];

export function ResultsTable() {
  const { t } = useTranslation();
  const resultFilter = useValidatorStore((s) => s.resultFilter);
  const setResultFilter = useValidatorStore((s) => s.setResultFilter);
  const currentPage = useValidatorStore((s) => s.currentPage);
  const setCurrentPage = useValidatorStore((s) => s.setCurrentPage);
  const validationResult = useValidatorStore((s) => s.validationResult);
  const parsedFile = useValidatorStore((s) => s.parsedFile);
  const columnMappings = useValidatorStore((s) => s.columnMappings);
  const applySuggestion = useValidatorStore((s) => s.applySuggestion);
  const updateCellValue = useValidatorStore((s) => s.updateCellValue);

  const activeColumns = useMemo(
    () => columnMappings.filter((m) => m.type !== 'ignore'),
    [columnMappings],
  );

  const filteredCells = useMemo(() => {
    if (!validationResult) return [];
    if (resultFilter === 'all') return validationResult.cells;
    return validationResult.cells.filter((c) => c.status === resultFilter);
  }, [validationResult, resultFilter]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredCells.length / ROWS_PER_PAGE)),
    [filteredCells],
  );

  const paginatedCells = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredCells.slice(start, start + ROWS_PER_PAGE);
  }, [filteredCells, currentPage]);

  const groupedRows = useMemo(() => groupByRow(paginatedCells), [paginatedCells]);

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {FILTERS.map((filter) => (
          <button
            key={filter}
            onClick={() => setResultFilter(filter)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${resultFilter === filter
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }
            `}
          >
            {t(`results.filter.${filter}`)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-start text-sm font-semibold text-gray-600">{t('results.table.row')}</th>
                {activeColumns.map((col) => (
                  <th key={col.columnIndex} className="px-4 py-3 text-start text-sm font-semibold text-gray-600">
                    {col.headerName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupedRows.length === 0 ? (
                <tr>
                  <td colSpan={activeColumns.length + 1} className="px-4 py-8 text-center text-gray-400">
                    {t('results.table.noResults')}
                  </td>
                </tr>
              ) : (
                groupedRows.map(([rowIdx, cells]) => (
                  <tr key={rowIdx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-500 font-mono">{rowIdx + 1}</td>
                    {activeColumns.map((col) => {
                      const cell = cells.find((c) => c.column === col.columnIndex);
                      if (!cell) {
                        return (
                          <td key={col.columnIndex} className="px-4 py-2 text-sm">
                            {parsedFile?.data[rowIdx]?.[col.columnIndex] ?? ''}
                          </td>
                        );
                      }
                      return (
                        <td key={col.columnIndex} className={`px-4 py-2 text-sm ${STATUS_BG[cell.status]}`}>
                          <EditableCell
                            cell={cell}
                            onSave={(val) => updateCellValue(cell.row, cell.column, val)}
                            onApplySuggestion={() => applySuggestion(cell.row, cell.column)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &laquo;
          </button>
          <span className="text-sm text-gray-600">
            {t('results.table.page', { current: currentPage, total: totalPages })}
          </span>
          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            &raquo;
          </button>
        </div>
      )}
    </div>
  );
}

function EditableCell({
  cell,
  onSave,
  onApplySuggestion,
}: {
  cell: CellValidation;
  onSave: (value: string) => void;
  onApplySuggestion: () => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(cell.originalValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Sync draft when cell value changes externally (e.g. fix all)
  useEffect(() => {
    setDraft(cell.originalValue);
  }, [cell.originalValue]);

  const commit = () => {
    setEditing(false);
    if (draft !== cell.originalValue) {
      onSave(draft);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(cell.originalValue); setEditing(false); }
        }}
        className="w-full px-1 py-0.5 border border-primary-400 rounded text-sm outline-none focus:ring-1 focus:ring-primary-500"
      />
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <CellTooltip cell={cell}>
        <span
          className="cursor-text hover:underline hover:decoration-dotted"
          onDoubleClick={() => setEditing(true)}
        >
          {cell.originalValue || '-'}
        </span>
      </CellTooltip>
      {cell.suggestion && (
        <button
          onClick={onApplySuggestion}
          title={`${t('results.fix')}: ${cell.suggestion}`}
          className="shrink-0 px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 transition-colors"
        >
          {t('results.fix')}
        </button>
      )}
    </div>
  );
}

function groupByRow(cells: CellValidation[]): [number, CellValidation[]][] {
  const map = new Map<number, CellValidation[]>();
  for (const cell of cells) {
    const group = map.get(cell.row);
    if (group) {
      group.push(cell);
    } else {
      map.set(cell.row, [cell]);
    }
  }
  return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
}
