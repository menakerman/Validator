import type { ColumnMapping, ColumnType } from '../types';

// Header patterns for auto-detection
const HEADER_PATTERNS: Record<Exclude<ColumnType, 'ignore'>, RegExp[]> = {
  id: [
    /תעודת\s*זהות/i,
    /ת\.?\s*ז\.?/i,
    /מספר\s*זהות/i,
    /מס['׳']\s*זהות/i,
    /id/i,
    /identity/i,
    /teudat\s*zehut/i,
    /tz/i,
  ],
  phone: [
    /טלפון/i,
    /נייד/i,
    /סלולרי/i,
    /פלאפון/i,
    /phone/i,
    /mobile/i,
    /cell/i,
    /tel/i,
  ],
  landline: [
    /קווי/i,
    /טלפון\s*קווי/i,
    /קו/i,
    /בית/i,
    /landline/i,
    /home\s*phone/i,
    /office\s*phone/i,
    /work\s*phone/i,
  ],
  email: [
    /אימייל/i,
    /דוא"?ל/i,
    /דואל/i,
    /דואר\s*אלקטרוני/i,
    /email/i,
    /e-mail/i,
    /mail/i,
  ],
};

// Data sample patterns
const DATA_PATTERNS: Record<Exclude<ColumnType, 'ignore'>, { test: (v: string) => boolean; confidence: number }> = {
  id: {
    test: (v) => /^\d{5,9}$/.test(v.trim()),
    confidence: 0.7,
  },
  phone: {
    test: (v) => {
      const cleaned = v.trim().replace(/[\s\-().+]/g, '');
      return /^(972|0)\d{8,9}$/.test(cleaned);
    },
    confidence: 0.8,
  },
  landline: {
    test: (v) => {
      const cleaned = v.trim().replace(/[\s\-().+]/g, '');
      return /^(0[2-489]|07[2-7])\d{7,8}$/.test(cleaned);
    },
    confidence: 0.7,
  },
  email: {
    test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    confidence: 0.9,
  },
};

export function detectColumnTypes(headers: string[], data: string[][]): ColumnMapping[] {
  const sampleSize = Math.min(data.length, 20);
  const sampleRows = data.slice(0, sampleSize);

  return headers.map((header, colIndex) => {
    const sampleValues = sampleRows
      .map((row) => row[colIndex] ?? '')
      .filter((v) => v.trim() !== '')
      .slice(0, 5);

    // Pass 1: Header matching
    for (const [type, patterns] of Object.entries(HEADER_PATTERNS) as [Exclude<ColumnType, 'ignore'>, RegExp[]][]) {
      if (patterns.some((p) => p.test(header))) {
        return {
          columnIndex: colIndex,
          headerName: header,
          type,
          mandatory: true,
          confidence: 0.9,
          sampleValues,
        };
      }
    }

    // Pass 2: Data sample matching
    const nonEmptySamples = sampleRows
      .map((row) => row[colIndex] ?? '')
      .filter((v) => v.trim() !== '');

    if (nonEmptySamples.length > 0) {
      for (const [type, pattern] of Object.entries(DATA_PATTERNS) as [Exclude<ColumnType, 'ignore'>, typeof DATA_PATTERNS['id']][]) {
        const matchCount = nonEmptySamples.filter((v) => pattern.test(v)).length;
        const matchRatio = matchCount / nonEmptySamples.length;

        if (matchRatio >= 0.6) {
          return {
            columnIndex: colIndex,
            headerName: header,
            type,
            mandatory: true,
            confidence: Math.round(matchRatio * pattern.confidence * 100) / 100,
            sampleValues,
          };
        }
      }
    }

    return {
      columnIndex: colIndex,
      headerName: header,
      type: 'ignore' as ColumnType,
      mandatory: true,
      confidence: 0,
      sampleValues,
    };
  });
}
