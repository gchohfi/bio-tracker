/**
 * utils.ts
 *
 * Helpers genéricos de parsing numérico e operadores.
 * Extraído de index.ts (Fase 1 da refatoração).
 */

/**
 * Converte string numérica brasileira para float.
 * Suporta: "1.234,56" → 1234.56, "13,1" → 13.1, "1.120" → 1120
 */
export function toFloat(s: string): number | null {
  if (!s) return null;
  let cleaned = s.trim().replace(/\s/g, '');
  if (cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    const thousandsMatch = cleaned.match(/^(\d{1,3})(\.(\d{3}))+$/);
    if (thousandsMatch) {
      cleaned = cleaned.replace(/\./g, '');
    }
  }
  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

/**
 * Parser de número brasileiro (usado no regex fallback).
 * Similar a toFloat mas sempre retorna number (NaN se inválido).
 */
export function parseBrNum(s: string): number {
  let c = s.trim();
  if (/^\d{1,3}(\.\d{3})+(,\d{1,4})?$/.test(c)) {
    c = c.replace(/\./g, '').replace(',', '.');
    return parseFloat(c);
  }
  if (/^\d+,\d{1,4}$/.test(c)) {
    c = c.replace(',', '.');
    return parseFloat(c);
  }
  if (/^\d{2,}(\.\d{3})+$/.test(c)) {
    c = c.replace('.', '');
    return parseFloat(c);
  }
  return parseFloat(c.replace(',', '.'));
}

/** Padrões de operador textual português → símbolo */
export const OPERATOR_PATTERNS: Array<{ pattern: RegExp; operator: string }> = [
  { pattern: /^inferior\s+ou\s+igual\s+a\b/i, operator: '<=' },
  { pattern: /^menor\s+ou\s+igual\s+a?\b/i, operator: '<=' },
  { pattern: /^superior\s+ou\s+igual\s+a\b/i, operator: '>=' },
  { pattern: /^maior\s+ou\s+igual\s+a?\b/i, operator: '>=' },
  { pattern: /^inferior\s+a\b/i, operator: '<' },
  { pattern: /^menor\s+que\b/i, operator: '<' },
  { pattern: /^superior\s+a\b/i, operator: '>' },
  { pattern: /^maior\s+que\b/i, operator: '>' },
  { pattern: /^ate\b/i, operator: '<=' },
  { pattern: /^até\b/i, operator: '<=' },
  { pattern: /^acima\s+de\b/i, operator: '>' },
  { pattern: /^abaixo\s+de\b/i, operator: '<' },
  { pattern: /^<=\s*/, operator: '<=' },
  { pattern: /^>=\s*/, operator: '>=' },
  { pattern: /^<\s*/, operator: '<' },
  { pattern: /^>\s*/, operator: '>' },
];
