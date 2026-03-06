/**
 * normalize.ts
 *
 * Funções de normalização, limpeza, deduplicação e parsing de referência.
 * Extraído de index.ts (Fase 1 da refatoração).
 *
 * Responsabilidades:
 * - Normalizar operadores textuais ("inferior a" → "<")
 * - Deduplicar resultados (preferir valor calculado sobre operador)
 * - Cross-dedup urina qualitativo/quantitativo
 * - Parsear lab_ref_text em min/max numéricos
 */

import { toFloat, OPERATOR_PATTERNS } from "./utils.ts";

// ---------------------------------------------------------------------------
// Normalização de operadores textuais
// ---------------------------------------------------------------------------

/**
 * Normaliza texto de operador português para formato padrão.
 * Ex: "inferior a 34 U/mL" → "< 34"
 */
export function normalizeOperatorText(results: any[]): any[] {
  for (const r of results) {
    if (r.text_value && typeof r.text_value === "string") {
      const tv = r.text_value.trim();
      // "inferior a 34 U/mL" → "< 34"
      const inferiorMatch = tv.match(/^inferior\s+a\s+(\d+[.,]?\d*)/i);
      if (inferiorMatch) {
        const num = inferiorMatch[1].replace(",", ".");
        r.text_value = `< ${num}`;
        r.value = parseFloat(num);
        console.log(`Normalized operator for ${r.marker_id}: "${tv}" → "${r.text_value}"`);
        continue;
      }
      // "superior a 90" → "> 90"
      const superiorMatch = tv.match(/^superior\s+a\s+(\d+[.,]?\d*)/i);
      if (superiorMatch) {
        const num = superiorMatch[1].replace(",", ".");
        r.text_value = `> ${num}`;
        r.value = parseFloat(num);
        console.log(`Normalized operator for ${r.marker_id}: "${tv}" → "${r.text_value}"`);
        continue;
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Deduplicação
// ---------------------------------------------------------------------------

/**
 * Deduplica marcadores: se o mesmo marker_id aparece múltiplas vezes,
 * prefere valor calculado sobre valor com operador.
 * Também faz cross-dedup de urina qualitativo/quantitativo.
 */
export function deduplicateResults(results: any[]): any[] {
  const seen = new Map<string, any>();
  for (const r of results) {
    const existing = seen.get(r.marker_id);
    if (!existing) {
      seen.set(r.marker_id, r);
    } else {
      // Prefer non-operator value over operator value (e.g., TFG: 103 > "> 60")
      const existingHasOp = existing.text_value && /^[<>≤≥]=?\s*\d/.test(existing.text_value);
      const newHasOp = r.text_value && /^[<>≤≥]=?\s*\d/.test(r.text_value);
      if (existingHasOp && !newHasOp && typeof r.value === "number") {
        console.log(`Dedup ${r.marker_id}: replaced operator "${existing.text_value}" with calculated value ${r.value}`);
        seen.set(r.marker_id, r);
      }
      // Otherwise keep first occurrence
    }
  }
  const deduped = Array.from(seen.values());

  // Cross-deduplication: if both qualitative (urina_leucocitos) and quantitative (urina_leucocitos_quant)
  // exist with the same numeric value, remove the qualitative one to avoid showing duplicates.
  const crossPairs: [string, string][] = [
    ['urina_leucocitos', 'urina_leucocitos_quant'],
    ['urina_hemacias', 'urina_hemacias_quant'],
  ];
  const seenIds = new Set(deduped.map((r: any) => r.marker_id));
  for (const [qualId, quantId] of crossPairs) {
    if (seenIds.has(qualId) && seenIds.has(quantId)) {
      const idx = deduped.findIndex((r: any) => r.marker_id === qualId);
      if (idx !== -1) {
        console.log(`Cross-dedup: removed ${qualId} (duplicate of ${quantId})`);
        deduped.splice(idx, 1);
      }
    }
  }
  return deduped;
}

// ---------------------------------------------------------------------------
// Parser de referência (lab_ref_text → min/max)
// ---------------------------------------------------------------------------

/**
 * Parseia o lab_ref_text retornado pelo Gemini em campos numéricos lab_ref_min e lab_ref_max.
 * Versão sincronizada com src/lib/parseLabReference.ts (com 3 fixes aplicados).
 */
export function parseLabRefRanges(results: any[]): any[] {
  for (const r of results) {
    const refText: string | undefined = r.lab_ref_text;
    if (!refText || typeof refText !== 'string' || refText.trim() === '') {
      delete r.lab_ref_text;
      continue;
    }
    let t = refText.trim();

    // ── Remover padrões descritivos que confundem o parser ──
    // Horários
    t = t.replace(/\(\s*\d+\s*[-–]\s*\d+\s*h(?:oras?)?\s*\)/gi, '').trim();
    t = t.replace(/\d+\s*[-–]\s*\d+\s*h(?:oras?)?/gi, '').trim();
    t = t.replace(/^(?:horas?\s+d[ao]\s+)?(?:manh[aã]|tarde|noite|vesper[ae])\s*:?\s*/gi, '').trim();
    // Faixa etária por sexo
    t = t.replace(/(?:homens?|mulheres?|masc(?:ulino)?|fem(?:inino)?)\s*\d+\s*[-–]\s*\d+\s*(?:anos?|a)\s*:?\s*/gi, '').trim();
    t = t.replace(/(?:homens?|mulheres?|masc(?:ulino)?|fem(?:inino)?)\s*>=\s*\d+\s*(?:anos?|a)\s*:?\s*/gi, '').trim();
    t = t.replace(/(?:homens?|mulheres?|masc(?:ulino)?|fem(?:inino)?)\s*<=\s*\d+\s*(?:anos?|a)\s*:?\s*/gi, '').trim();
    // Faixa etária sem sexo
    t = t.replace(/^(?:de\s+)?\d+\s*(?:a|[-–])\s*\d+\s*(?:anos?|a)\s*:/gi, '').trim();
    // Operadores textuais + idade
    t = t.replace(/^(?:acima|maior|superior)\s+(?:de|que)\s+\d+\s*(?:anos?|a)(?:\s+e\s+adultos?)?\s*:?\s*/gi, '').trim();
    t = t.replace(/^(?:abaixo|menor|inferior)\s+(?:de|que)\s+\d+\s*(?:anos?|a)\s*:?\s*/gi, '').trim();
    // Faixas genéricas
    t = t.replace(/\d+\s*[-–]\s*\d+\s*(?:anos?|a)\s*:/gi, '').trim();
    t = t.replace(/>=?\s*\d+\s*(?:anos?|a)\s*:/gi, '').trim();
    t = t.replace(/<=?\s*\d+\s*(?:anos?|a)\s*:/gi, '').trim();
    // Fases de vida
    t = t.replace(/^(?:pr[eé]-?p[uú]beres?|p[oó]s-?menopausa|menopausa|adultos?)\s*:?\s*/gi, '').trim();

    // Se após limpeza o texto ainda contém "anos", é texto etário puro → descartar
    if (/^\d+\s*(?:a|[-–])\s*\d+\s*anos?\s*$/i.test(t) || /^\d+\s*anos?\s*$/i.test(t)) {
      delete r.lab_ref_text;
      continue;
    }

    // ── Detecção de qualitativo ──
    if (/^(n[aã]o\s*reag|reag|negativ|positiv|ausente|presente|normal|indeterminad)/i.test(t)) {
      continue;
    }

    // ── Detecção de operador ──
    let matched = false;
    for (const { pattern, operator } of OPERATOR_PATTERNS) {
      if (pattern.test(t)) {
        const numStr = t.replace(pattern, '').trim();
        const numMatch = numStr.match(/[\d.,]+/);
        if (numMatch) {
          const val = toFloat(numMatch[0]);
          if (val !== null) {
            if (operator === '<' || operator === '<=') {
              r.lab_ref_max = val;
              r.lab_ref_text = `${operator} ${val}`;
            } else {
              r.lab_ref_min = val;
              r.lab_ref_text = `${operator} ${val}`;
            }
            matched = true;
            break;
          }
        }
      }
    }
    if (matched) continue;

    // ── Textos com prefixos descritivos ou multi-categoria de risco ──
    const riskCategoryPattern = /(?:desej[áa]vel|[oó]timo|normal|limit[ír]ofe|borderline|elevado|alto|muito\s+alto|baixo)/i;
    if (riskCategoryPattern.test(t)) {
      const riskSegments = t.split(/[\/\n]/).map(s => s.trim()).filter(Boolean);
      let cleanedInput: string | null = null;
      if (riskSegments.length > 1) {
        const desejavel = riskSegments.find(s => /desej[áa]vel/i.test(s));
        const otimo = riskSegments.find(s => /[oó]timo/i.test(s));
        const normal = riskSegments.find(s => /^normal\b/i.test(s.replace(/^\s*/, '')));
        const chosen = desejavel || otimo || normal || riskSegments[0];
        cleanedInput = chosen.replace(/^[^:]*:\s*/, '').trim();
      } else {
        cleanedInput = t.replace(/^[^:]*:\s*/, '').trim();
      }
      if (cleanedInput && cleanedInput.length > 0) {
        cleanedInput = cleanedInput.replace(/\s*mg\/[dDlL][lL]?\s*$/i, '').trim();
        let riskMatched = false;
        for (const { pattern: op, operator } of OPERATOR_PATTERNS) {
          if (op.test(cleanedInput)) {
            const numStr = cleanedInput.replace(op, '').trim();
            const numMatch = numStr.match(/[\d.,]+/);
            if (numMatch) {
              const val = toFloat(numMatch[0]);
              if (val !== null) {
                if (operator === '<' || operator === '<=') {
                  r.lab_ref_max = val;
                  r.lab_ref_text = `${operator} ${val}`;
                } else {
                  r.lab_ref_min = val;
                  r.lab_ref_text = `${operator} ${val}`;
                }
                riskMatched = true;
                break;
              }
            }
          }
        }
        if (riskMatched) continue;
        const rangeM = cleanedInput.match(/([\d.,]+)\s*(?:a|até|to|-|–|—)\s*([\d.,]+)/i);
        if (rangeM) {
          const rMin = toFloat(rangeM[1]);
          const rMax = toFloat(rangeM[2]);
          if (rMin !== null && rMax !== null && rMin < rMax) {
            r.lab_ref_min = rMin;
            r.lab_ref_max = rMax;
            r.lab_ref_text = `${rMin} a ${rMax}`;
            continue;
          }
        }
      }
    }

    // ── Detecção de range (X a Y, X - Y, X–Y) ──
    const rangeMatch = t.match(
      /([\d.,]+)\s*(?:a|até|to|-|–|—)\s*([\d.,]+)/i
    );
    if (rangeMatch) {
      const min = toFloat(rangeMatch[1]);
      const max = toFloat(rangeMatch[2]);
      if (min !== null && max !== null && min < max) {
        r.lab_ref_min = min;
        r.lab_ref_max = max;
        r.lab_ref_text = `${min} a ${max}`;
        continue;
      }
    }

    // ── Número isolado (sem operador) — tratar como máximo ──
    const singleNum = t.match(/^([\d.,]+)\s*$/);
    if (singleNum) {
      const val = toFloat(singleNum[1]);
      if (val !== null) {
        r.lab_ref_max = val;
        r.lab_ref_text = `<= ${val}`;
        continue;
      }
    }

    // Texto muito longo sem intervalo numérico extraível → descartar
    if (t.length > 60) {
      delete r.lab_ref_text;
      continue;
    }

    // Texto qualitativo curto — mantém apenas lab_ref_text
  }
  return results;
}
