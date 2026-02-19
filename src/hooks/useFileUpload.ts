import { useState, useCallback, useRef } from 'react';

const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const MAX_SIZE = 50 * 1024 * 1024; // 50MB

interface UseFileUploadReturn {
  isDragging: boolean;
  error: string | null;
  handleDragEnter: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  openFilePicker: () => void;
}

export function useFileUpload(
  onFile: (file: File) => void,
): UseFileUploadReturn {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const validateFile = useCallback(
    (file: File): boolean => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ACCEPTED_TYPES.includes(file.type) && !ACCEPTED_EXTENSIONS.includes(ext)) {
        setError('upload.error.invalidType');
        return false;
      }
      if (file.size > MAX_SIZE) {
        setError('upload.error.tooLarge');
        return false;
      }
      setError(null);
      return true;
    },
    [],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      dragCounter.current = 0;

      const file = e.dataTransfer.files[0];
      if (file && validateFile(file)) {
        onFile(file);
      }
    },
    [onFile, validateFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && validateFile(file)) {
        onFile(file);
      }
    },
    [onFile, validateFile],
  );

  const openFilePicker = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
    isDragging,
    error,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleFileSelect,
    inputRef,
    openFilePicker,
  };
}
