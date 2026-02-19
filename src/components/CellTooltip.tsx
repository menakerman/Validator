import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { CellValidation } from '../types';

interface CellTooltipProps {
  cell: CellValidation;
  children: React.ReactNode;
}

export function CellTooltip({ cell, children }: CellTooltipProps) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [show]);

  if (cell.status === 'valid') {
    return <>{children}</>;
  }

  const message = t(cell.message, { suggestion: cell.suggestion ?? '' });

  return (
    <div
      ref={ref}
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div className="absolute z-50 bottom-full start-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-gray-800 text-white text-sm rounded-lg shadow-lg">
          <p>{message}</p>
          {cell.suggestion && (
            <p className="mt-1 text-primary-300 font-medium">
              {cell.suggestion}
            </p>
          )}
          <div className="absolute top-full start-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>
      )}
    </div>
  );
}
