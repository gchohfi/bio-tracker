/**
 * validate.ts
 *
 * Responsável EXCLUSIVAMENTE por:
 *   - Sanity bounds (validação de plausibilidade — sem correção de valor)
 *   - Anti-alucinação (urina_hemoglobina, urina_hemacias, toxicologia)
 *   - Sanitização de referências (percent markers, age ranges, sanity bounds)
 *   - Cross-check contra texto PDF (anti-hallucination)
 *   - Validação estrutural final (marker_id, NaN, negativos, duplicatas)
 *   - Quality score
 *
 * NÃO faz:
 *   - Conversão de unidade (→ convert.ts)
 *   - Ajuste de escala / OCR fix (→ scale.ts)
 *   - Inferência de unidade (→ unitInference.ts)
 *   - Cálculo derivado (→ derive.ts)
 */

import { QUALITATIVE_IDS, VALID_MARKER_IDS, CALCULATED_MARKERS, ALLOW_NEGATIVE, MARKER_TEXT_TERMS } from "./constants.ts";
import { parseBrNum } from "./utils.ts";

// ════════════════════════════════════════════════════════════════════
// validateAndFixValues — Sanity bounds + anti-hallucination
// Scale adjustments foram movidos para scale.ts (applyScaleAdjustments)
// ════════════════════════════════════════════════════════════════════

export function validateAndFixValues(results: any[], patientSex?: string, patientAge?: number | null): any[] {

  // ── Remove urina_densidade e urina_ph com valores implausíveis ──
  for (const r of results) {
    if (r.marker_id === 'urina_densidade') {
      if (typeof r.value === 'number' && (r.value === 0 || r.value > 2 || (r.value >= 900 && r.value <= 1100))) {
        console.log(`Removing implausible urina_densidade: ${r.value}`);
        (r as any)._remove = true;
      }
    }
    if (r.marker_id === 'urina_ph') {
      if (typeof r.value === 'number' && (r.value === 0 || r.value > 14)) {
        console.log(`Removing implausible urina_ph: ${r.value}`);
        (r as any)._remove = true;
      }
    }
  }
  results = results.filter((r: any) => !r._remove);

  // Strip text_value from numeric markers if AI incorrectly set it
  for (const r of results) {
    if (r.text_value && typeof r.value === "number" && !QUALITATIVE_IDS.has(r.marker_id)) {
      if (!/^[<>≤≥]=?\s*\d/.test(r.text_value.trim())) {
        console.log(`Stripped non-operator text_value from ${r.marker_id}: "${r.text_value}"`);
        delete r.text_value;
      }
    }
  }

  // === VALIDAÇÃO DE REFERÊNCIA POR SEXO ===
  if (patientSex) {
    for (const r of results) {
      if (!r.lab_ref_text) continue;
      const text = String(r.lab_ref_text);
      const hasBothSexes = /\b(homens?|masculino)\b/i.test(text) && /\b(mulheres?|feminino)\b/i.test(text);
      if (hasBothSexes) {
        const segments = text.split(/[\/;]|\n/).map((s: string) => s.trim()).filter(Boolean);
        let extracted = '';
        const malePattern = /\b(homens?|masc(?:ulino)?)\b/i;
        const femalePattern = /\b(mulheres?|fem(?:inino)?)\b/i;
        const targetPattern = patientSex === 'M' ? malePattern : femalePattern;
        
        for (const seg of segments) {
          if (targetPattern.test(seg)) {
            extracted = seg
              .replace(/\b(homens?|mulheres?|masc(?:ulino)?|fem(?:inino)?)\b\s*:?\s*/gi, '')
              .trim();
            break;
          }
        }

        if (extracted) {
          console.log(`Extracted ${patientSex}-specific ref for ${r.marker_id}: "${text}" → "${extracted}"`);
          r.lab_ref_text = extracted;
          const rangeMatch = extracted.match(/([\d.,]+)\s*(?:a|até|to|-|–|—)\s*([\d.,]+)/i);
          if (rangeMatch) {
            const min = parseFloat(rangeMatch[1].replace(/\./g, '').replace(',', '.'));
            const max = parseFloat(rangeMatch[2].replace(/\./g, '').replace(',', '.'));
            if (!isNaN(min) && !isNaN(max) && min < max) {
              r.lab_ref_min = min;
              r.lab_ref_max = max;
            }
          }
        } else {
          console.log(`Could not extract ${patientSex}-specific ref for ${r.marker_id}: "${text}" — clearing`);
          r.lab_ref_text = '';
        }
      }
    }
  }

  // === ANTI-ALUCINAÇÃO: urina_hemoglobina e urina_hemacias ===
  const bloodHemoglobina = results.find((r: any) => r.marker_id === 'hemoglobina' && typeof r.value === 'number');
  const bloodEritrocitos = results.find((r: any) => r.marker_id === 'eritrocitos' && typeof r.value === 'number');

  for (const r of results) {
    // --- urina_hemoglobina ---
    if (r.marker_id === 'urina_hemoglobina') {
      const numVal = typeof r.value === 'number' ? r.value : (typeof r.value === 'string' ? parseFloat(String(r.value).replace(',', '.')) : NaN);
      if (!isNaN(numVal) && numVal > 5) {
        console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina numeric ${r.value} (likely from hemograma)`);
        r._remove = true;
      }
      if (typeof r.value === 'string') {
        const v = r.value as string;
        if (/g\/dL/i.test(v) || /milh[õo]es/i.test(v) || /\d+[,.]\d+\s+a\s+\d+[,.]\d+/.test(v) || /\d{2,}[,.]\d+/.test(v)) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina string "${v}" (likely from hemograma)`);
          r._remove = true;
        }
      }
      if (typeof r.text_value === 'string') {
        const tv = r.text_value;
        if (/g\/[dD]?[lL]/i.test(tv) || /milh[õo]es/i.test(tv) || /mm[³3]/i.test(tv) || /µL/i.test(tv) ||
            (/\d{2,}[,.]\d+/.test(tv) && /\d+[,.]\d+\s+a\s+\d+[,.]\d+/.test(tv))) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina text_value "${tv}" (hemograma in text_value)`);
          r._remove = true;
        }
      }
      const refText = r.lab_ref_text || r.lab_ref_range || '';
      if (/g\/dL/i.test(refText) || /\d{2,}[,.]\d+\s*a\s*\d{2,}[,.]\d+/.test(refText)) {
        console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina with hemograma ref "${refText}"`);
        r._remove = true;
      }
      if (r.lab_ref_min != null && r.lab_ref_max != null) {
        const refMin = parseFloat(r.lab_ref_min);
        const refMax = parseFloat(r.lab_ref_max);
        if (!isNaN(refMin) && !isNaN(refMax) && refMin >= 5 && refMax <= 20 && refMax > refMin) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina with hemograma-like lab_ref range ${refMin}-${refMax}`);
          r._remove = true;
        }
      }
      if (!r._remove && bloodHemoglobina && !isNaN(numVal)) {
        const bloodVal = bloodHemoglobina.value;
        if (Math.abs(numVal - bloodVal) < 1) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemoglobina ${numVal} (matches blood hemoglobina ${bloodVal})`);
          r._remove = true;
        }
      }
    }
    // --- urina_hemacias ---
    if (r.marker_id === 'urina_hemacias') {
      if (typeof r.value === 'number' && r.value > 100) {
        console.log(`ANTI-HALLUCINATION: removed urina_hemacias numeric ${r.value} (likely from hemograma)`);
        r._remove = true;
      }
      if (typeof r.value === 'string') {
        const v = r.value as string;
        if (/milh[õo]es/i.test(v) || /mm[³3]/i.test(v) || /µL/i.test(v) || /\d+[,.]\d+\s+a\s+\d+[,.]\d+/.test(v)) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemacias string "${v}" (likely from hemograma)`);
          r._remove = true;
        }
      }
      if (typeof r.text_value === 'string') {
        const tv = r.text_value;
        if (/milh[õo]es/i.test(tv) || /mm[³3]/i.test(tv) || /µL/i.test(tv) || /g\/[dD]?[lL]/i.test(tv) ||
            (/\d+[,.]\d+\s+a\s+\d+[,.]\d+/.test(tv) && /\d{2,}[,.]\d+/.test(tv))) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemacias text_value "${tv}" (hemograma in text_value)`);
          r._remove = true;
        }
      }
      if (r.lab_ref_min != null && r.lab_ref_max != null) {
        const refMin = parseFloat(r.lab_ref_min);
        const refMax = parseFloat(r.lab_ref_max);
        if (!isNaN(refMin) && !isNaN(refMax) && refMin > 1 && refMax > 3 && refMax < 10) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemacias with hemograma-like lab_ref range ${refMin}-${refMax}`);
          r._remove = true;
        }
      }
      if (!r._remove && bloodEritrocitos && typeof r.value === 'number') {
        const bloodVal = bloodEritrocitos.value;
        if (Math.abs(r.value - bloodVal) < 0.5) {
          console.log(`ANTI-HALLUCINATION: removed urina_hemacias ${r.value} (matches blood eritrocitos ${bloodVal})`);
          r._remove = true;
        }
      }
    }
  }

  // === LIMPEZA: urina qualitative cleanup ===
  const URINA_QUALITATIVE_CLEANUP = new Set(['urina_leucocitos', 'urina_hemacias', 'urina_hemoglobina']);
  for (const r of results) {
    if (!URINA_QUALITATIVE_CLEANUP.has(r.marker_id)) continue;
    const tv: string | undefined = r.text_value;
    if (!tv || typeof tv !== 'string') continue;

    if (/[\d.,]+\s*(?:g\/[dD]?[lL]|milh[õo]es|mm[³3]|µL)/i.test(tv)) {
      console.log(`ANTI-HALLUCINATION: removed ${r.marker_id} text_value "${tv}" (hemograma hallucination)`);
      r._remove = true;
      continue;
    }

    const splitMatch = tv.match(/^(\d[\d.,]*\s*(?:\/mL|\/campo)?)\s+(Até|até|inferior\s+a|superior\s+a|menor\s+que|maior\s+que|Ref\.?|ref\.?|[<>≤≥]=?\s*)\s*(.+)$/i);
    if (splitMatch) {
      const resultPart = splitMatch[1].trim();
      const refPart = `${splitMatch[2].trim()} ${splitMatch[3].trim()}`;
      console.log(`Split text_value for ${r.marker_id}: "${tv}" → result="${resultPart}", ref="${refPart}"`);
      r.text_value = resultPart;
      if (!r.lab_ref_text) {
        r.lab_ref_text = refPart;
      }
      continue;
    }

    const numRefMatch = tv.match(/^(\d+[.,]?\d*)\s+(\d+[.,]?\d*\s+a\s+\d+[.,]?\d*)$/i);
    if (numRefMatch) {
      console.log(`Split num+ref text_value for ${r.marker_id}: "${tv}" → result="${numRefMatch[1]}", ref="${numRefMatch[2]}"`);
      r.text_value = numRefMatch[1];
      if (!r.lab_ref_text) {
        r.lab_ref_text = numRefMatch[2];
      }
      continue;
    }
  }

  // === DEDUP: redirect qualitative urina markers with quantitative values ===
  const QUALITATIVE_TO_QUANT_MAP: Record<string, string> = {
    'urina_leucocitos': 'urina_leucocitos_quant',
    'urina_hemacias': 'urina_hemacias_quant',
  };

  for (const r of results) {
    const quantId = QUALITATIVE_TO_QUANT_MAP[r.marker_id];
    if (!quantId) continue;

    const hasMLUnit = typeof r.text_value === 'string' && /\/mL/i.test(r.text_value);
    const hasNumericTextValue = typeof r.text_value === 'string' && /^\d[\d.\s]*\s*\/?\s*m?L?$/i.test(r.text_value.trim());
    const hasHighNumeric = typeof r.value === 'number' && r.value > 50;

    if (hasMLUnit || hasNumericTextValue || hasHighNumeric) {
      const quantExists = results.some((q: any) => q.marker_id === quantId && !q._remove);
      if (quantExists) {
        console.log(`DEDUP: removed ${r.marker_id} (quantitative data "${r.text_value || r.value}"; ${quantId} already exists)`);
        r._remove = true;
      } else {
        const numVal = hasHighNumeric ? r.value : parseFloat(String(r.text_value).replace(/[.\s]/g, '').replace(',', '.').replace(/\/mL/i, ''));
        console.log(`DEDUP: redirected ${r.marker_id} → ${quantId} (value: ${numVal})`);
        r.marker_id = quantId;
        r.value = isNaN(numVal) ? r.value : numVal;
        delete r.text_value;
      }
    }
  }

  return results.filter((r: any) => !r._remove);
}

// ════════════════════════════════════════════════════════════════════
// sanitizeLabReferences — Sanitize lab reference ranges
// ════════════════════════════════════════════════════════════════════

export function sanitizeLabReferences(results: any[]): any[] {

  // Percent-only markers: discard absolute-count references
  const percentOnlyMarkers = new Set([
    'neutrofilos', 'linfocitos', 'monocitos', 'eosinofilos', 'basofilos',
  ]);
  for (const r of results) {
    if (percentOnlyMarkers.has(r.marker_id) && (r.lab_ref_min != null || r.lab_ref_max != null)) {
      const refMin = typeof r.lab_ref_min === 'number' ? r.lab_ref_min : 0;
      const refMax = typeof r.lab_ref_max === 'number' ? r.lab_ref_max : 0;
      const looksLikeAbsolute = refMax > 100 || refMin > 100;
      if (looksLikeAbsolute) {
        console.log(`Discarding absolute-unit lab_ref for percent marker ${r.marker_id}: ${r.lab_ref_min}-${r.lab_ref_max} (text: ${r.lab_ref_text})`);
        r.lab_ref_min = null;
        r.lab_ref_max = null;
        r.lab_ref_text = '';
      } else {
        console.log(`Keeping percentage lab_ref for ${r.marker_id}: ${r.lab_ref_min}-${r.lab_ref_max} (text: ${r.lab_ref_text})`);
      }
    }
  }

  // NOTE: Leucogram absolute → percent conversion moved to scale.ts (applyLeucogramPercentConversion)

  // Marker-specific ref sanitization
  for (const r of results) {
    if (r.marker_id === 'calcio_total' && typeof r.lab_ref_max === 'number' && r.lab_ref_max > 15) {
      console.log(`Discarding out-of-range lab_ref for calcio_total: ${r.lab_ref_min}-${r.lab_ref_max} (likely captured from PTH)`);
      r.lab_ref_min = null; r.lab_ref_max = null; r.lab_ref_text = '';
    }
    if (r.marker_id === 'amh' && typeof r.lab_ref_max === 'number' && r.lab_ref_max > 10) {
      console.log(`Discarding age-range lab_ref for amh: ${r.lab_ref_min}-${r.lab_ref_max}`);
      r.lab_ref_min = null; r.lab_ref_max = null; r.lab_ref_text = '';
    }
    if (r.marker_id === 'igf1' && typeof r.lab_ref_max === 'number' && r.lab_ref_max < 50) {
      console.log(`Discarding age-range lab_ref for igf1: ${r.lab_ref_min}-${r.lab_ref_max}`);
      r.lab_ref_min = null; r.lab_ref_max = null; r.lab_ref_text = '';
    }
    if (r.marker_id === 'pth' && typeof r.lab_ref_max === 'number' && typeof r.lab_ref_min === 'number' && r.lab_ref_max < 50 && r.lab_ref_min > 30) {
      console.log(`Discarding age-range lab_ref for pth: ${r.lab_ref_min}-${r.lab_ref_max}`);
      r.lab_ref_min = null; r.lab_ref_max = null; r.lab_ref_text = '';
    }
    if (r.marker_id === 'homocisteina' && typeof r.lab_ref_min === 'number' && typeof r.lab_ref_max === 'number') {
      if (r.lab_ref_min >= 10 && r.lab_ref_max >= 40) {
        console.log(`Discarding age-range lab_ref for homocisteina: ${r.lab_ref_min}-${r.lab_ref_max}`);
        r.lab_ref_min = null; r.lab_ref_max = null; r.lab_ref_text = '';
      }
    }
    if (r.marker_id === 'testosterona_livre' && typeof r.value === 'number' && r.value > 5 && typeof r.lab_ref_max === 'number' && r.lab_ref_max <= 2.0) {
      console.log(`Discarding female lab_ref for testosterona_livre: value=${r.value} ng/dL (male) but ref max=${r.lab_ref_max} ng/dL (female)`);
      r.lab_ref_min = null; r.lab_ref_max = null; r.lab_ref_text = '';
    }
    // NOTE: leucocitos ref thousands fix moved to scale.ts (applyScaleAdjustments)
    if (r.marker_id === 'hba1c' && typeof r.lab_ref_min === 'number' && r.lab_ref_min >= 5.0 && typeof r.lab_ref_max === 'number' && r.lab_ref_max <= 7.0) {
      console.log(`Discarding pre-diabetes lab_ref for hba1c: ${r.lab_ref_min}-${r.lab_ref_max}`);
      r.lab_ref_min = null; r.lab_ref_max = null; r.lab_ref_text = '';
    }
  }

  // Age header filter
  const ageHeaderPatterns = [
    /maior ou igual a \d+ anos/i,
    /^até \d+ anos/i,
    /^de \d+ a \d+ anos/i,
    /^\d+ a \d+ anos:/i,
    /^maior que \d+ anos:/i,
  ];
  for (const r of results) {
    if (r.lab_ref_text && ageHeaderPatterns.some((p: RegExp) => p.test(r.lab_ref_text as string))) {
      const textWithoutAge = (r.lab_ref_text as string).replace(/\d+\s*anos?/gi, '').trim();
      const hasValueRange = /\d+[,.]?\d*\s*(a|até|-)\s*\d+[,.]?\d*/.test(textWithoutAge);
      if (!hasValueRange) {
        console.log(`[age-header] Discarding age-header lab_ref_text for ${r.marker_id}: "${r.lab_ref_text}"`);
        r.lab_ref_text = ''; r.lab_ref_min = null; r.lab_ref_max = null;
      }
    }
  }

  // Generic sanity bounds for lab references
  const labRefSanityRanges: Record<string, { min: number; max: number }> = {
    hemoglobina: { min: 8, max: 20 }, hematocrito: { min: 25, max: 60 },
    eritrocitos: { min: 2, max: 8 }, vcm: { min: 50, max: 120 },
    hcm: { min: 15, max: 45 }, chcm: { min: 25, max: 40 },
    rdw: { min: 8, max: 20 }, leucocitos: { min: 1000, max: 20000 },
    plaquetas: { min: 50, max: 700 }, vpm: { min: 5, max: 15 },
    glicose_jejum: { min: 40, max: 500 }, hba1c: { min: 3, max: 15 },
    insulina_jejum: { min: 0.5, max: 100 }, colesterol_total: { min: 50, max: 500 },
    hdl: { min: 10, max: 150 }, ldl: { min: 10, max: 400 },
    triglicerides: { min: 20, max: 2000 }, tsh: { min: 0.01, max: 100 },
    t4_livre: { min: 0.1, max: 5 }, t3_livre: { min: 0.1, max: 1.0 },
    t3_total: { min: 30, max: 300 }, testosterona_total: { min: 1, max: 1500 },
    testosterona_livre: { min: 0.01, max: 30 }, estradiol: { min: 5, max: 5000 },
    progesterona: { min: 0, max: 50 }, dhea_s: { min: 10, max: 600 },
    cortisol: { min: 1, max: 50 }, igf1: { min: 50, max: 600 },
    vitamina_d: { min: 3, max: 200 }, vitamina_b12: { min: 50, max: 3000 },
    ferritina: { min: 1, max: 2000 }, ferro_serico: { min: 10, max: 500 },
    calcio_total: { min: 5, max: 15 }, magnesio: { min: 0.5, max: 5 },
    sodio: { min: 100, max: 180 }, potassio: { min: 2, max: 8 },
    creatinina: { min: 0.1, max: 15 }, ureia: { min: 5, max: 200 },
    acido_urico: { min: 0.5, max: 15 }, albumina: { min: 1, max: 8 },
    pcr: { min: 0, max: 200 }, homocisteina: { min: 1, max: 50 },
    zinco: { min: 40, max: 200 },
  };
  for (const r of results) {
    const sanity = labRefSanityRanges[r.marker_id];
    if (!sanity) continue;
    if (typeof r.lab_ref_min !== 'number' && typeof r.lab_ref_max !== 'number') continue;
    const refMin = typeof r.lab_ref_min === 'number' ? r.lab_ref_min : r.lab_ref_max as number;
    const refMax = typeof r.lab_ref_max === 'number' ? r.lab_ref_max : r.lab_ref_min as number;
    const expectedMid = (sanity.min + sanity.max) / 2;
    const parsedMid = (refMin + refMax) / 2;
    if (expectedMid > 0 && parsedMid > 0) {
      const ratio = Math.max(expectedMid / parsedMid, parsedMid / expectedMid);
      if (ratio > 20) {
        console.log(`[sanity] Discarding incompatible lab_ref for ${r.marker_id}: [${refMin}, ${refMax}] ratio=${ratio.toFixed(1)}x vs expected [${sanity.min}, ${sanity.max}]`);
        r.lab_ref_min = null; r.lab_ref_max = null; r.lab_ref_text = '';
      }
    }
  }

  return results;
}

// ════════════════════════════════════════════════════════════════════
// crossCheckAllMarkers — Anti-hallucination cross-check against PDF
// ════════════════════════════════════════════════════════════════════

export function crossCheckAllMarkers(validResults: any[], pdfText: string, beforeFallbackIds: Set<string>, rescuedIds?: Set<string>): any[] {
  const pdfTextLower = pdfText.toLowerCase();

  // Cross-check all markers: verify marker names appear in PDF text
  const crossChecked = validResults.filter((r: any) => {
    // Skip markers added by fallback (already validated), calculated markers, and rescued markers
    if (!beforeFallbackIds.has(r.marker_id) || CALCULATED_MARKERS.has(r.marker_id)) return true;
    if (rescuedIds?.has(r.marker_id)) return true;

    const terms = MARKER_TEXT_TERMS[r.marker_id];
    if (!terms || terms.length === 0) return true; // No search terms defined — keep

    const foundInText = terms.some((t: string) => pdfTextLower.includes(t.toLowerCase()));
    if (!foundInText) {
      console.log(`CROSS-CHECK: discarding ${r.marker_id} = ${r.value ?? r.text_value} — marker name NOT found in PDF text (possible hallucination)`);
      return false;
    }
    return true;
  });

  return crossChecked;
}

// ════════════════════════════════════════════════════════════════════
// validateExtraction — Structural validation + quality score
// ════════════════════════════════════════════════════════════════════

export function validateExtraction(results: any[]): {
  results: any[];
  quality_score: number;
  issues: { level: string; marker_id?: string; message: string }[];
} {
  const issues: { level: string; marker_id?: string; message: string }[] = [];
  const validResults: any[] = [];
  const seenMarkers = new Map<string, any>();

  for (const r of results) {
    // 1. marker_id must be present
    if (!r.marker_id || typeof r.marker_id !== "string" || r.marker_id.trim() === "") {
      issues.push({ level: "error", message: "Item sem marker_id — removido" });
      continue;
    }

    const isQual = QUALITATIVE_IDS.has(r.marker_id);

    // 2. Must have value OR text_value
    const hasValue = typeof r.value === "number";
    const hasTextValue = typeof r.text_value === "string" && r.text_value.trim().length > 0;
    if (!hasValue && !hasTextValue) {
      issues.push({ level: "error", marker_id: r.marker_id, message: `${r.marker_id}: sem value nem text_value — removido` });
      continue;
    }

    // 3. Reject NaN / Infinity
    if (hasValue && (!Number.isFinite(r.value))) {
      issues.push({ level: "error", marker_id: r.marker_id, message: `${r.marker_id}: valor ${r.value} inválido (NaN/Infinity) — removido` });
      continue;
    }

    // 4. Reject negative values where clinically impossible
    if (hasValue && r.value < 0 && !ALLOW_NEGATIVE.has(r.marker_id) && !isQual) {
      issues.push({ level: "warning", marker_id: r.marker_id, message: `${r.marker_id}: valor negativo ${r.value} — zerado` });
      r.value = 0;
    }

    // 5. Duplicate detection
    if (seenMarkers.has(r.marker_id)) {
      const existing = seenMarkers.get(r.marker_id);
      const existingHasRef = typeof existing.lab_ref_text === "string" && existing.lab_ref_text.length > 0;
      const newHasRef = typeof r.lab_ref_text === "string" && r.lab_ref_text.length > 0;

      if (newHasRef && !existingHasRef) {
        const idx = validResults.indexOf(existing);
        if (idx !== -1) validResults[idx] = r;
        seenMarkers.set(r.marker_id, r);
        issues.push({ level: "warning", marker_id: r.marker_id, message: `${r.marker_id}: duplicata — mantido o com referência` });
      } else {
        issues.push({ level: "warning", marker_id: r.marker_id, message: `${r.marker_id}: duplicata descartada` });
      }
      continue;
    }

    seenMarkers.set(r.marker_id, r);
    validResults.push(r);
  }

  // Quality score
  const totalExtracted = results.length || 1;
  const validCount = validResults.length;
  const withRefCount = validResults.filter(
    (r) => typeof r.lab_ref_text === "string" && r.lab_ref_text.trim().length > 0
  ).length;

  const validRatio = validCount / totalExtracted;
  const refRatio = validCount > 0 ? withRefCount / validCount : 0;
  const quality_score = Math.round((validRatio * 0.7 + refRatio * 0.3) * 100) / 100;

  if (quality_score < 0.5) {
    issues.push({ level: "warning", message: `Quality score baixo: ${quality_score}` });
  }

  return { results: validResults, quality_score, issues };
}
