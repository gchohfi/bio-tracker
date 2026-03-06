/**
 * scale.ts
 *
 * Responsável EXCLUSIVAMENTE por:
 *   - Scale adjustments (fixes de OCR/parsing: decimal perdido, milhar)
 *   - Correção de referências WBC absolutas em mil/mm³
 *   - Arredondamento de valores numéricos pós-conversão
 *
 * NÃO faz:
 *   - Conversão de unidade (→ convert.ts)
 *   - Sanity bounds / anti-alucinação (→ validate.ts)
 *   - Cálculos derivados (→ derive.ts)
 *   - Inferência de unidade (→ unitInference.ts)
 *
 * Diferença conceitual:
 *   - Unit Conversion: muda a unidade (mg/dL → mg/L) com fator definido
 *   - Scale Adjustment: corrige magnitude com unidade correta (OCR perdeu decimal)
 *   - Derived Value: calcula novo marcador a partir de outros (HOMA-IR)
 *   - Validation: verifica plausibilidade, sem modificar valores
 */

import { QUALITATIVE_IDS } from "./constants.ts";

// ════════════════════════════════════════════════════════════════════
// SCALE ADJUSTMENTS
// Fix OCR/parsing errors where the unit is correct but the
// decimal point or thousands separator was lost.
// ════════════════════════════════════════════════════════════════════

const scaleAdjustments: Record<string, { min: number; max: number; fix: (v: number) => number; label: string }> = {
  leucocitos: { min: 1000, max: 30000, fix: (v) => {
    if (v < 30) return v * 1000;
    if (v < 100) return v * 100;
    if (v < 1000) return v * 10;
    return v;
  }, label: "[SCALE-FIX] leucocitos scale fix" },
  eritrocitos: { min: 1, max: 10, fix: (v) => v > 1000 ? v / 1000000 : v > 10 ? v / 10 : v, label: "[SCALE-FIX] eritrocitos decimal fix" },
  plaquetas: { min: 50, max: 700, fix: (v) => v > 1000 ? v / 1000 : v, label: "[SCALE-FIX] plaquetas ÷1000" },
  prolactina: { min: 0.5, max: 200, fix: (v) => v > 200 ? v / 100 : v, label: "[SCALE-FIX] prolactina decimal fix" },
  insulina_jejum: { min: 0.5, max: 100, fix: (v) => v > 100 ? v / 100 : v, label: "[SCALE-FIX] insulina decimal fix" },
  tsh: { min: 0.01, max: 100, fix: (v) => v > 200 ? v / 100 : v, label: "[SCALE-FIX] tsh decimal fix" },
  ferritina: { min: 1, max: 2000, fix: (v) => v > 2000 ? v / 10 : v, label: "[SCALE-FIX] ferritina decimal fix" },
  acido_urico: { min: 0.5, max: 15, fix: (v) => v > 15 ? v / 10 : v, label: "[SCALE-FIX] acido_urico decimal fix" },
  tgo_ast: { min: 3, max: 500, fix: (v) => (v > 1000 && v < 10000) ? v / 10 : v, label: "[SCALE-FIX] tgo_ast decimal fix" },
  tgp_alt: { min: 3, max: 500, fix: (v) => (v > 1000 && v < 10000) ? v / 10 : v, label: "[SCALE-FIX] tgp_alt decimal fix" },
  transferrina: { min: 100, max: 500, fix: (v) => v < 100 ? v * 10 : v, label: "[SCALE-FIX] transferrina ×10" },
  neutrofilos_abs: { min: 100, max: 15000, fix: (v) => v < 10 ? v * 1000 : v, label: "[SCALE-FIX] neutrofilos_abs ×1000" },
  linfocitos_abs: { min: 100, max: 10000, fix: (v) => v < 10 ? v * 1000 : v, label: "[SCALE-FIX] linfocitos_abs ×1000" },
  monocitos_abs: { min: 10, max: 3000, fix: (v) => v < 1 ? v * 1000 : v, label: "[SCALE-FIX] monocitos_abs ×1000" },
  eosinofilos_abs: { min: 10, max: 3000, fix: (v) => v < 1 ? v * 1000 : v, label: "[SCALE-FIX] eosinofilos_abs ×1000" },
  basofilos_abs: { min: 1, max: 500, fix: (v) => v < 1 ? v * 1000 : v, label: "[SCALE-FIX] basofilos_abs ×1000" },
};

/**
 * Aplica scale adjustments (correção de magnitude por OCR/parsing),
 * corrige referências WBC absolutas, e arredonda valores numéricos.
 *
 * Etapa do pipeline: após CONVERT, antes de VALIDATE.
 */
export function applyScaleAdjustments(results: any[]): any[] {
  // ── 1. Aplicar fixes de escala ──
  for (const r of results) {
    if (typeof r.value !== "number") continue;
    if (QUALITATIVE_IDS.has(r.marker_id)) continue;
    if (r.text_value && /^[<>≤≥]=?\s*\d/.test(r.text_value.trim())) continue;

    const adj = scaleAdjustments[r.marker_id];
    if (!adj) continue;

    if (r.value < adj.min || r.value > adj.max) {
      const original = r.value;
      r.value = adj.fix(r.value);
      if (r.value < adj.min * 0.3 || r.value > adj.max * 3) {
        r.value = original; // revert — fix didn't help
      } else {
        console.log(`Fixed ${r.marker_id}: ${original} → ${r.value} (${adj.label})`);
      }
    }
  }

  // ── 2. Fix lab references for absolute WBC markers that came in mil/mm³ ──
  const absWbcMarkers = new Set(['neutrofilos_abs', 'linfocitos_abs', 'monocitos_abs', 'eosinofilos_abs', 'basofilos_abs']);
  for (const r of results) {
    if (!absWbcMarkers.has(r.marker_id)) continue;
    if (typeof r.lab_ref_max === 'number' && r.lab_ref_max < 20) {
      console.log(`[wbc-ref-fix] Multiplying lab_ref for ${r.marker_id}: ${r.lab_ref_min}-${r.lab_ref_max} → ${(r.lab_ref_min || 0) * 1000}-${r.lab_ref_max * 1000}`);
      if (typeof r.lab_ref_min === 'number') r.lab_ref_min = r.lab_ref_min * 1000;
      r.lab_ref_max = r.lab_ref_max * 1000;
    }
  }

  // ── 3. Leucogram absolute → percent conversion ──
  // Differentials reported as absolute counts are converted to % using leucocitos total.
  // This is a scale adjustment (correct magnitude), not a unit conversion (same concept: %).
  const percentDifferentials = new Set([
    'neutrofilos', 'linfocitos', 'monocitos', 'eosinofilos', 'basofilos', 'segmentados', 'bastonetes',
  ]);
  const leucocitosResult = results.find((r: any) => r.marker_id === 'leucocitos');
  const leucocitosTotal = leucocitosResult ? leucocitosResult.value : null;
  for (const r of results) {
    if (percentDifferentials.has(r.marker_id) && typeof r.value === 'number' && r.value > 100) {
      if (leucocitosTotal && leucocitosTotal > 0) {
        const pct = parseFloat(((r.value / leucocitosTotal) * 100).toFixed(1));
        console.log(`[leucogram-fix] Converting ${r.marker_id} absolute ${r.value} /mm³ → ${pct}% (leucocitos=${leucocitosTotal})`);
        r.value = pct;
        r.unit = '%';
      } else {
        console.log(`[leucogram-fix] Removing ${r.marker_id} absolute ${r.value} /mm³ (no leucocitos total available)`);
        r._remove = true;
      }
    }
  }
  results = results.filter((r: any) => !r._remove);

  // ── 4. Fix leucocitos ref thousands separator bug ──
  for (const r of results) {
    if (r.marker_id === 'leucocitos' && typeof r.lab_ref_max === 'number' && r.lab_ref_max < 100) {
      console.log(`[leucocitos] Fixing thousands separator bug: ref [${r.lab_ref_min}, ${r.lab_ref_max}] → [${(r.lab_ref_min ?? 0) * 1000}, ${r.lab_ref_max * 1000}]`);
      if (typeof r.lab_ref_min === 'number') r.lab_ref_min = Math.round(r.lab_ref_min * 1000);
      r.lab_ref_max = Math.round(r.lab_ref_max * 1000);
    }
  }

  // ── 5. Round all numeric values to avoid floating point artifacts ──
  for (const r of results) {
    if (typeof r.value === 'number' && !QUALITATIVE_IDS.has(r.marker_id)) {
      if (r.value === 0) continue;
      const abs = Math.abs(r.value);
      let decimals: number;
      if (abs >= 100) decimals = 0;
      else if (abs >= 10) decimals = 1;
      else if (abs >= 1) decimals = 2;
      else if (abs >= 0.1) decimals = 3;
      else decimals = 4;
      r.value = parseFloat(r.value.toFixed(decimals));
    }
  }

  return results;
}
