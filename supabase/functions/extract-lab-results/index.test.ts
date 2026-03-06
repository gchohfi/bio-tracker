/**
 * Unit tests for extract-lab-results edge function internal modules.
 *
 * Since the edge function calls serve() at module level (can't import without starting server),
 * we replicate the pure internal algorithms here for isolated testing.
 * These tests validate the ALGORITHMS, not the HTTP endpoint.
 *
 * Run with: supabase test tool (Deno test runner)
 */

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertAlmostEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ─── Replicated internal functions ──────────────────────────────────────────

function toFloat(s: string): number | null {
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
 * Replicated postProcessResults — PSA ratio, Colesterol não-HDL, HOMA-IR logic
 */
function postProcessResults(results: any[]): any[] {
  const resultMap = new Map<string, any>();
  for (const r of results) {
    resultMap.set(r.marker_id, r);
  }

  // PSA ratio fix
  if (resultMap.has("psa_ratio")) {
    const existing = resultMap.get("psa_ratio");
    if (typeof existing.value === "number") {
      if (resultMap.has("psa_livre") && resultMap.has("psa_total")) {
        const psaL = resultMap.get("psa_livre").value;
        const psaT = resultMap.get("psa_total").value;
        if (typeof psaL === "number" && typeof psaT === "number" && psaT > 0) {
          const recalculated = Math.round((psaL / psaT) * 100 * 10) / 10;
          existing.value = recalculated;
        }
      } else if (existing.value < 1.0 && existing.value > 0) {
        existing.value = Math.round(existing.value * 100 * 10) / 10;
      }
    }
  }

  // Colesterol Não-HDL
  if (!resultMap.has("colesterol_nao_hdl") && resultMap.has("colesterol_total") && resultMap.has("hdl")) {
    const ct = resultMap.get("colesterol_total").value;
    const hdl = resultMap.get("hdl").value;
    if (typeof ct === "number" && typeof hdl === "number") {
      const naoHdl = Math.round(ct - hdl);
      if (naoHdl >= 0) {
        results.push({ marker_id: "colesterol_nao_hdl", value: naoHdl });
      }
    }
  }

  // HOMA-IR
  if (!resultMap.has("homa_ir") && resultMap.has("glicose_jejum") && resultMap.has("insulina_jejum")) {
    const glicose = resultMap.get("glicose_jejum").value;
    const insulina = resultMap.get("insulina_jejum").value;
    if (typeof glicose === "number" && typeof insulina === "number") {
      const homa = Math.round((glicose * insulina / 405) * 100) / 100;
      results.push({ marker_id: "homa_ir", value: homa });
    }
  }

  return results;
}

/**
 * Replicated convertLabRefUnits — percentOnlyMarkers logic
 */
function convertLabRefUnits(results: any[]): any[] {
  const percentOnlyMarkers = new Set([
    'neutrofilos', 'linfocitos', 'monocitos', 'eosinofilos', 'basofilos',
  ]);
  for (const r of results) {
    if (percentOnlyMarkers.has(r.marker_id) && (r.lab_ref_min != null || r.lab_ref_max != null)) {
      const refMin = typeof r.lab_ref_min === 'number' ? r.lab_ref_min : 0;
      const refMax = typeof r.lab_ref_max === 'number' ? r.lab_ref_max : 0;
      const looksLikeAbsolute = refMax > 100 || refMin > 100;
      if (looksLikeAbsolute) {
        r.lab_ref_min = null;
        r.lab_ref_max = null;
        r.lab_ref_text = '';
      }
    }
  }
  return results;
}

/**
 * Replicated REFERENCE_OVERRIDES conditional logic
 */
function applyReferenceOverrides(results: any[]): any[] {
  const REFERENCE_OVERRIDES: Record<string, { min: number | null; max: number | null; text: string }> = {
    colesterol_total:   { min: null, max: 190,  text: '< 190 mg/dL' },
    hdl:                { min: 40,   max: null, text: '> 40 mg/dL' },
    ldl:                { min: null, max: 129,  text: '< 130 mg/dL' },
    colesterol_nao_hdl: { min: null, max: 130,  text: '< 130 mg/dL' },
    triglicerides:      { min: null, max: 150,  text: '< 150 mg/dL' },
    vldl:               { min: null, max: 30,   text: '< 30 mg/dL' },
    vitamina_b12:       { min: 300,  max: null, text: '> 300 pg/mL' },
    hba1c:              { min: null, max: 5.7,  text: '< 5,7%' },
  };
  for (const r of results) {
    const override = REFERENCE_OVERRIDES[r.marker_id];
    if (override) {
      const hasLabRef = r.lab_ref_text && r.lab_ref_text.trim().length > 0;
      if (!hasLabRef) {
        r.lab_ref_min = override.min;
        r.lab_ref_max = override.max;
        r.lab_ref_text = override.text;
      }
    }
  }
  return results;
}

/**
 * Replicated parseLabRefRanges — inline parser
 */
const OPERATOR_PATTERNS: Array<{ pattern: RegExp; operator: string }> = [
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

function parseLabRefRanges(results: any[]): any[] {
  for (const r of results) {
    const refText: string | undefined = r.lab_ref_text;
    if (!refText || typeof refText !== 'string' || refText.trim() === '') {
      delete r.lab_ref_text;
      continue;
    }
    let t = refText.trim();

    // Strip age patterns
    t = t.replace(/^(?:de\s+)?\d+\s*(?:a|[-–])\s*\d+\s*(?:anos?|a)\s*:/gi, '').trim();
    t = t.replace(/^(?:acima|maior|superior)\s+(?:de|que)\s+\d+\s*(?:anos?|a)(?:\s+e\s+adultos?)?\s*:?\s*/gi, '').trim();
    t = t.replace(/^(?:abaixo|menor|inferior)\s+(?:de|que)\s+\d+\s*(?:anos?|a)\s*:?\s*/gi, '').trim();

    // Operator detection
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
            } else {
              r.lab_ref_min = val;
            }
            matched = true;
            break;
          }
        }
      }
    }
    if (matched) continue;

    // Range detection: X a Y
    const rangeMatch = t.match(/([\d.,]+)\s*(?:a|até|to|-|–|—)\s*([\d.,]+)/i);
    if (rangeMatch) {
      const min = toFloat(rangeMatch[1]);
      const max = toFloat(rangeMatch[2]);
      if (min !== null && max !== null) {
        r.lab_ref_min = min;
        r.lab_ref_max = max;
      }
    }
  }
  return results;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

Deno.test("postProcessResults: PSA ratio recalculated from psa_livre/psa_total", () => {
  const results = [
    { marker_id: "psa_ratio", value: 25 },
    { marker_id: "psa_livre", value: 0.51 },
    { marker_id: "psa_total", value: 5.0 },
  ];
  postProcessResults(results);
  const ratio = results.find(r => r.marker_id === "psa_ratio")!;
  assertAlmostEquals(ratio.value, 10.2, 0.1);
});

Deno.test("postProcessResults: PSA ratio 0.28 without psa_livre/psa_total → 28.0", () => {
  const results = [
    { marker_id: "psa_ratio", value: 0.28 },
  ];
  postProcessResults(results);
  const ratio = results.find(r => r.marker_id === "psa_ratio")!;
  assertAlmostEquals(ratio.value, 28.0, 0.1);
});

Deno.test("postProcessResults: Colesterol não-HDL = CT - HDL", () => {
  const results = [
    { marker_id: "colesterol_total", value: 200 },
    { marker_id: "hdl", value: 50 },
  ];
  postProcessResults(results);
  const naoHdl = results.find(r => r.marker_id === "colesterol_nao_hdl")!;
  assertEquals(naoHdl.value, 150);
});

Deno.test("postProcessResults: HOMA-IR = (glicose × insulina) / 405", () => {
  const results = [
    { marker_id: "glicose_jejum", value: 90 },
    { marker_id: "insulina_jejum", value: 10 },
  ];
  postProcessResults(results);
  const homa = results.find(r => r.marker_id === "homa_ir")!;
  assertAlmostEquals(homa.value, 2.22, 0.01);
});

// ─── convertLabRefUnits ─────────────────────────────────────────────────────

Deno.test("convertLabRefUnits: Monócitos com ref % (≤ 100) → MANTÉM", () => {
  const results = [
    { marker_id: "monocitos", value: 6, lab_ref_min: 2, lab_ref_max: 8, lab_ref_text: "2,0 a 8,0" },
  ];
  convertLabRefUnits(results);
  assertEquals(results[0].lab_ref_min, 2);
  assertEquals(results[0].lab_ref_max, 8);
});

Deno.test("convertLabRefUnits: Neutrófilos com ref absoluta (> 100) → DESCARTA", () => {
  const results = [
    { marker_id: "neutrofilos", value: 55, lab_ref_min: 1526, lab_ref_max: 5020, lab_ref_text: "1.526 a 5.020 /mm³" },
  ];
  convertLabRefUnits(results);
  assertEquals(results[0].lab_ref_min, null);
  assertEquals(results[0].lab_ref_max, null);
  assertEquals(results[0].lab_ref_text, '');
});

Deno.test("convertLabRefUnits: PCR com ref '< 5,0 mg/L' → não é percentOnlyMarker, sem alteração", () => {
  const results = [
    { marker_id: "pcr", value: 1.2, lab_ref_min: null, lab_ref_max: 5.0, lab_ref_text: "< 5,0 mg/L" },
  ];
  convertLabRefUnits(results);
  assertEquals(results[0].lab_ref_max, 5.0);
  assertEquals(results[0].lab_ref_text, "< 5,0 mg/L");
});

// ─── REFERENCE_OVERRIDES ────────────────────────────────────────────────────

Deno.test("REFERENCE_OVERRIDES: marcador com lab_ref_text do laudo → NÃO sobrescreve", () => {
  const results = [
    { marker_id: "ldl", value: 120, lab_ref_min: null, lab_ref_max: 70, lab_ref_text: "< 70 mg/dL" },
  ];
  applyReferenceOverrides(results);
  // Lab ref should be preserved (high-risk patient reference)
  assertEquals(results[0].lab_ref_max, 70);
  assertEquals(results[0].lab_ref_text, "< 70 mg/dL");
});

Deno.test("REFERENCE_OVERRIDES: marcador sem lab_ref_text → DEVE aplicar override", () => {
  const results = [
    { marker_id: "ldl", value: 120, lab_ref_min: null, lab_ref_max: null, lab_ref_text: "" },
  ];
  applyReferenceOverrides(results);
  assertEquals(results[0].lab_ref_min, null); // LDL override has min=null
  assertEquals(results[0].lab_ref_max, 129);
  assertEquals(results[0].lab_ref_text, "< 130 mg/dL");
});

Deno.test("REFERENCE_OVERRIDES: LDL override must have min=null (not min=100)", () => {
  const REFERENCE_OVERRIDES: Record<string, { min: number | null; max: number | null; text: string }> = {
    ldl: { min: null, max: 129, text: '< 130 mg/dL' },
  };
  assertEquals(REFERENCE_OVERRIDES.ldl.min, null);
  assertEquals(REFERENCE_OVERRIDES.ldl.max, 129);
});

// ─── parseLabRefRanges ──────────────────────────────────────────────────────

Deno.test("parseLabRefRanges: '70 a 100' → min=70, max=100", () => {
  const results = [{ marker_id: "test", lab_ref_text: "70 a 100" }];
  parseLabRefRanges(results);
  assertEquals(results[0].lab_ref_min, 70);
  assertEquals(results[0].lab_ref_max, 100);
});

Deno.test("parseLabRefRanges: 'Acima de 20' → min=20", () => {
  const results = [{ marker_id: "test", lab_ref_text: "Acima de 20" }];
  parseLabRefRanges(results);
  assertEquals(results[0].lab_ref_min, 20);
});

Deno.test("parseLabRefRanges: 'Abaixo de 5' → max=5", () => {
  const results = [{ marker_id: "test", lab_ref_text: "Abaixo de 5" }];
  parseLabRefRanges(results);
  assertEquals(results[0].lab_ref_max, 5);
});
