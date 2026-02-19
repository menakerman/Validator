import { distance } from 'fastest-levenshtein';
import type { CellValidation, ValidationStatus } from '../types';
import { DOMAIN_TYPO_MAP, KNOWN_VALID_DOMAINS, INVALID_TLDS } from './domainTypos';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string, row: number, column: number): CellValidation {
  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return result(row, column, value, 'error', 'validators.email.empty');
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return result(row, column, value, 'error', 'validators.email.invalidFormat');
  }

  const atIndex = trimmed.lastIndexOf('@');
  const domain = trimmed.slice(atIndex + 1);
  const localPart = trimmed.slice(0, atIndex);

  // Check TLD
  const tld = domain.split('.').pop() ?? '';
  if (INVALID_TLDS.includes(tld)) {
    const suggestion = findDomainSuggestion(domain);
    if (suggestion) {
      return result(
        row, column, value, 'warning',
        'validators.email.domainTypo',
        `${localPart}@${suggestion}`,
      );
    }
    return result(row, column, value, 'error', 'validators.email.invalidTld');
  }

  // Check exact typo match (fast path)
  if (DOMAIN_TYPO_MAP[domain]) {
    return result(
      row, column, value, 'warning',
      'validators.email.domainTypo',
      `${localPart}@${DOMAIN_TYPO_MAP[domain]}`,
    );
  }

  // Check if domain is known valid
  if (KNOWN_VALID_DOMAINS.includes(domain)) {
    return result(row, column, value, 'valid', 'validators.email.valid');
  }

  // Levenshtein distance fallback for unknown domains
  const suggestion = findDomainSuggestion(domain);
  if (suggestion) {
    return result(
      row, column, value, 'warning',
      'validators.email.domainTypo',
      `${localPart}@${suggestion}`,
    );
  }

  // Unknown domain but valid format
  return result(row, column, value, 'valid', 'validators.email.valid');
}

function findDomainSuggestion(domain: string): string | null {
  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const knownDomain of KNOWN_VALID_DOMAINS) {
    const d = distance(domain, knownDomain);
    if (d <= 2 && d < bestDistance) {
      bestDistance = d;
      bestMatch = knownDomain;
    }
  }

  return bestMatch;
}

function result(
  row: number,
  column: number,
  originalValue: string,
  status: ValidationStatus,
  message: string,
  suggestion?: string,
): CellValidation {
  return { row, column, originalValue, status, message, suggestion };
}
