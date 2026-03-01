/**
 * parseLabReference.ts
 *
 * Parser universal de textos de referência laboratorial.
 * Extrai min, max, operador e displayText a partir de strings como:
 *   "70 a 100 mg/dL", "< 200", ">= 10", "Inferior ou igual a 15",
 *   "Homens: 4.5 - 5.5 / Mulheres: 4.0 - 5.0", etc.
 *
 * SYNC NOTE: Uma cópia inline deste parser existe em
 *   supabase/functions/extract-lab-results/index.ts
 * Mantenha ambos sincronizados ao fazer alterações.
 */

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Converte string numérica para float, distinguindo ponto-milhar de ponto-decimal.
 *
 * Regras:
 * - Vírgula sempre é tratada como separador decimal (padrão brasileiro)
 * - Ponto seguido de exatamente 3 dígitos no final → ponto-milhar (ex: "1.000" → 1000)
 * - Ponto NÃO seguido de 3 dígitos → ponto-decimal (ex: "3.80" → 3.8)
 */
function toFloat(s: string): number | null {
  if (!s) return null;
  let cleaned = s.trim();

  // Remove espaços internos
  cleaned = cleaned.replace(/\s/g, '');

  // Se tem vírgula, ela é o separador decimal
  if (cleaned.includes(',')) {
    // Remove pontos (milhar) e troca vírgula por ponto
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    // Sem vírgula: verificar se o ponto é milhar ou decimal
    // Ponto-milhar: "1.000", "10.500" → ponto seguido de exatamente 3 dígitos no final
    const thousandsMatch = cleaned.match(/^(\d{1,3})(\.(\d{3}))+$/);
    if (thousandsMatch) {
      // É ponto de milhar, remover todos os pontos
      cleaned = cleaned.replace(/\./g, '');
    }
    // Caso contrário, ponto é decimal (ex: "3.80", "0.5")
  }

  const val = parseFloat(cleaned);
  return isNaN(val) ? null : val;
}

// ─── Operator mapping ───────────────────────────────────────────────

/**
 * Mapeia operadores textuais e simbólicos para operadores normalizados.
 * Importante: padrões mais específicos (<=, >=) vêm ANTES dos menos específicos (<, >).
 */
const OPERATOR_PATTERNS: Array<{ pattern: RegExp; operator: string }> = [
  // Textual operators (português)
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
  // Symbolic operators — mais específicos primeiro
  { pattern: /^<=\s*/, operator: '<=' },
  { pattern: /^>=\s*/, operator: '>=' },
  { pattern: /^<\s*/, operator: '<' },
  { pattern: /^>\s*/, operator: '>' },
];

// ─── Sex-prefix patterns ────────────────────────────────────────────

const SEX_PREFIXES: Array<{ pattern: RegExp; sex: 'M' | 'F' }> = [
  { pattern: /^(homens?|masc(?:ulino)?|male)\s*:?\s*/i, sex: 'M' },
  { pattern: /^(mulheres?|fem(?:inino)?|female)\s*:?\s*/i, sex: 'F' },
];

// ─── Main parser ────────────────────────────────────────────────────

export interface ParsedReference {
  min: number | null;
  max: number | null;
  operator: 'range' | '<' | '<=' | '>' | '>=' | 'qualitative' | 'unknown';
  displayText: string;
}

/**
 * Analisa uma string de referência laboratorial e extrai min/max/operador.
 *
 * @param text - Texto bruto do campo "Valor de Referência" do PDF
 * @param sex  - Sexo do paciente ('M' ou 'F'), usado para selecionar a faixa correta
 *               quando o texto contém separação por sexo
 * @returns ParsedReference com min, max, operador e displayText limpo
 */
export function parseLabReference(text: string, sex?: 'M' | 'F'): ParsedReference {
  const fallback: ParsedReference = {
    min: null,
    max: null,
    operator: 'unknown',
    displayText: text?.trim() ?? '',
  };

  if (!text || !text.trim()) return fallback;

  let input = text.trim();

  // ── 1. Separação por sexo ──
  // Tentar encontrar segmentos separados por sexo (ex: "Homens: 4.5-5.5 / Mulheres: 4.0-5.0")
  // Dividir por / , ; ou quebra de linha
  const segments = input.split(/[\/;]|\n/).map(s => s.trim()).filter(Boolean);

  if (segments.length > 1 && sex) {
    // Procurar o segmento que corresponde ao sexo do paciente
    for (const segment of segments) {
      for (const prefix of SEX_PREFIXES) {
        if (prefix.sex === sex && prefix.pattern.test(segment)) {
          // Encontrou o segmento correto — remover o prefixo e continuar parsing
          input = segment.replace(prefix.pattern, '').trim();
          break;
        }
      }
      if (input !== text.trim()) break; // já encontrou
    }
  }

  // Remover prefixo de sexo mesmo em texto sem separação
  if (sex) {
    for (const prefix of SEX_PREFIXES) {
      if (prefix.sex === sex && prefix.pattern.test(input)) {
        input = input.replace(prefix.pattern, '').trim();
        break;
      }
    }
  }

  // ── 2. Detecção de qualitativo ──
  const qualitativePatterns = /^(n[aã]o\s*reag|reag|negativ|positiv|ausente|presente|normal|indeterminad)/i;
  if (qualitativePatterns.test(input)) {
    return { min: null, max: null, operator: 'qualitative', displayText: input };
  }

  // ── 3. Detecção de operador ──
  for (const { pattern, operator } of OPERATOR_PATTERNS) {
    if (pattern.test(input)) {
      const numStr = input.replace(pattern, '').trim();
      // Extrair primeiro número do restante
      const numMatch = numStr.match(/[\d.,]+/);
      if (numMatch) {
        const val = toFloat(numMatch[0]);
        if (val !== null) {
          if (operator === '<' || operator === '<=') {
            return { min: null, max: val, operator: operator as ParsedReference['operator'], displayText: `${operator} ${val}` };
          } else {
            return { min: val, max: null, operator: operator as ParsedReference['operator'], displayText: `${operator} ${val}` };
          }
        }
      }
    }
  }

  // ── 4. Detecção de range (X a Y, X - Y, X–Y) ──
  // Padrão: número separador número
  const rangeMatch = input.match(
    /([\d.,]+)\s*(?:a|até|to|-|–|—)\s*([\d.,]+)/i
  );
  if (rangeMatch) {
    const min = toFloat(rangeMatch[1]);
    const max = toFloat(rangeMatch[2]);
    if (min !== null && max !== null) {
      return { min, max, operator: 'range', displayText: `${min}–${max}` };
    }
  }

  // ── 5. Número isolado (sem operador) — tratar como máximo ──
  const singleNum = input.match(/^([\d.,]+)\s*$/);
  if (singleNum) {
    const val = toFloat(singleNum[1]);
    if (val !== null) {
      return { min: null, max: val, operator: '<=', displayText: `<= ${val}` };
    }
  }

  // ── 6. Fallback ──
  return fallback;
}
