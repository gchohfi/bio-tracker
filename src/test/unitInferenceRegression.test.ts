/**
 * unitInferenceRegression.test.ts
 *
 * Regression tests to prevent false-positive conversions caused by
 * contaminated lab_ref_text (multi-line headers leaking stray unit mentions).
 *
 * Covers:
 * 1. Estradiol already in pg/mL must NOT infer ng/dL from spurious lab_ref_text
 * 2. Testosterona livre already in pg/mL must NOT infer pmol/L from spurious lab_ref_text
 * 3. Inference must only fire on strong, local signals
 * 4. Conflict between apparent value and inferred unit must reduce confidence / block conversion
 * 5. EvolutionReportData passthrough: only persisted value matters
 */

import { describe, it, expect } from "vitest";
import {
  inferSourceUnit,
} from "../../supabase/functions/extract-lab-results/unitInference";
import {
  applyUnitConversions,
} from "../../supabase/functions/extract-lab-results/convert";

/** Helper: run the full infer+convert pipeline */
function convertPipeline(results: any[]): any[] {
  inferSourceUnit(results);
  applyUnitConversions(results);
  return results;
}

function makeResult(
  marker_id: string,
  value: number,
  opts: {
    unit?: string;
    lab_ref_min?: number;
    lab_ref_max?: number;
    lab_ref_text?: string;
    _converted?: boolean;
  } = {}
) {
  return { marker_id, value, ...opts };
}

// ═══════════════════════════════════════════════════════════════════
// 1. Estradiol: spurious ng/dL in lab_ref_text must NOT trigger conversion
// ═══════════════════════════════════════════════════════════════════

describe("regression: estradiol — spurious lab_ref_text must NOT convert", () => {
  it("estradiol 44 pg/mL with multi-line lab_ref_text containing ng/dL header stays 44", () => {
    // Real scenario: lab_ref_text inherited from multi-line header
    // e.g. "Fase folicular:\nng/dL\n12.5 a 166 pg/mL"
    // The ng/dL is from a DIFFERENT marker's header, not adjacent to numbers
    const results = [
      makeResult("estradiol", 44, {
        lab_ref_text: "Fase folicular:\nng/dL\n12.5 a 166 pg/mL",
        lab_ref_min: 12.5,
        lab_ref_max: 166,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBe(44);
    expect(results[0]._converted).toBeUndefined();
  });

  it("estradiol 44 with stray 'ng/dL' not adjacent to numbers stays 44", () => {
    const results = [
      makeResult("estradiol", 44, {
        lab_ref_text: "Unidade: ng/dL\nValor de referência: 12,5 a 166,0 pg/mL",
        lab_ref_min: 12.5,
        lab_ref_max: 166,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBe(44);
    expect(results[0]._converted).toBeUndefined();
  });

  it("estradiol 396 with lab_ref_text mentioning ng/dL in header stays 396", () => {
    const results = [
      makeResult("estradiol", 396, {
        lab_ref_text: "Hormônio: ng/dL\nFase lútea: 43,8 a 211,0 pg/mL",
        lab_ref_min: 43.8,
        lab_ref_max: 211,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBe(396);
    expect(results[0]._converted).toBeUndefined();
  });

  it("estradiol 44 with NO unit info at all stays 44 (value > 10 blocks heuristic)", () => {
    // Value 44 is > 10, so the ng/dL heuristic (v < 10) should NOT fire
    const results = [
      makeResult("estradiol", 44, {
        lab_ref_min: 12.5,
        lab_ref_max: 166,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBe(44);
    expect(results[0]._converted).toBeUndefined();
  });

  it("estradiol with GENUINE unit ng/dL and low value DOES convert", () => {
    // Legitimate case: value 4.4 with explicit unit ng/dL
    const results = [
      makeResult("estradiol", 4.4, {
        unit: "ng/dL",
        lab_ref_min: 1.5,
        lab_ref_max: 6.0,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBeCloseTo(44, 1);
    expect(results[0]._converted).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Testosterona livre: spurious pmol/L in lab_ref_text must NOT convert
// ═══════════════════════════════════════════════════════════════════

describe("regression: testosterona_livre — spurious lab_ref_text must NOT convert", () => {
  it("testosterona_livre 0.44 with lab_ref_text mentioning pmol/L in header stays 0.44", () => {
    const results = [
      makeResult("testosterona_livre", 0.44, {
        lab_ref_text: "pmol/L\nHomem: 2,4 a 37,0 pg/mL",
        lab_ref_min: 2.4,
        lab_ref_max: 37,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBe(0.44);
    expect(results[0]._converted).toBeUndefined();
  });

  it("testosterona_livre 0.57 with stray pmol/L not adjacent to numbers stays 0.57", () => {
    const results = [
      makeResult("testosterona_livre", 0.57, {
        lab_ref_text: "Método: pmol/L\nReferência: 2,4 a 37,0",
        lab_ref_min: 2.4,
        lab_ref_max: 37,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBe(0.57);
    expect(results[0]._converted).toBeUndefined();
  });

  it("testosterona_livre 0.44 with NO unit or lab_ref_text stays 0.44 (value < 100 blocks heuristic)", () => {
    // pmol/L heuristic requires v > 100
    const results = [
      makeResult("testosterona_livre", 0.44, {
        lab_ref_min: 2.4,
        lab_ref_max: 37,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBe(0.44);
    expect(results[0]._converted).toBeUndefined();
  });

  it("testosterona_livre with GENUINE pmol/L unit and high value DOES convert", () => {
    const results = [
      makeResult("testosterona_livre", 347, {
        unit: "pmol/L",
        lab_ref_min: 174,
        lab_ref_max: 694,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBeCloseTo(347 / 34.7, 2);
    expect(results[0]._converted).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Inference requires strong, local signal
// ═══════════════════════════════════════════════════════════════════

describe("regression: inference requires strong local signal", () => {
  it("lab_ref_text with unit adjacent to number IS a valid signal", () => {
    // "1.0 a 4.0 ng/dL" — ng/dL is adjacent to numeric values
    const results: any[] = [
      makeResult("estradiol", 2.0, {
        lab_ref_text: "1.0 a 4.0 ng/dL",
        lab_ref_min: 1.0,
        lab_ref_max: 4.0,
      }),
    ];
    inferSourceUnit(results);
    expect(results[0]._sourceUnit).toBe("ng/dL");
    expect(results[0]._conversionConfidence).toBe("medium");
  });

  it("lab_ref_text with unit NOT adjacent to number is NOT a valid signal", () => {
    // "ng/dL\n12.5 a 166" — ng/dL is on its own line, not next to numbers
    const results: any[] = [
      makeResult("estradiol", 44, {
        lab_ref_text: "ng/dL\n12.5 a 166",
        lab_ref_min: 12.5,
        lab_ref_max: 166,
      }),
    ];
    inferSourceUnit(results);
    expect(results[0]._sourceUnit).toBeUndefined();
  });

  it("unit_raw is always authoritative regardless of lab_ref_text", () => {
    const results: any[] = [
      makeResult("estradiol", 4.4, {
        unit: "ng/dL",
        lab_ref_text: "whatever text doesn't matter",
      }),
    ];
    inferSourceUnit(results);
    expect(results[0]._sourceUnit).toBe("ng/dL");
    expect(results[0]._conversionConfidence).toBe("high");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Conflict: value vs inferred unit → prefer NOT converting
// ═══════════════════════════════════════════════════════════════════

describe("regression: value-unit conflict blocks conversion", () => {
  it("estradiol 44 with heuristic (v < 10) does NOT trigger — value too high", () => {
    const results: any[] = [makeResult("estradiol", 44, {})];
    inferSourceUnit(results);
    // No heuristic should fire because 44 > 10
    expect(results[0]._sourceUnit).toBeUndefined();
  });

  it("testosterona_livre 0.44 with pg/mL heuristic (v > 1) does NOT trigger — value too low", () => {
    // pg/mL heuristic requires v > 1, but 0.44 < 1
    const results: any[] = [makeResult("testosterona_livre", 0.44, {})];
    inferSourceUnit(results);
    expect(results[0]._sourceUnit).toBeUndefined();
  });

  it("progesterona 19 without unit does NOT trigger ng/dL heuristic (v > 50 required)", () => {
    const results: any[] = [makeResult("progesterona", 19, {})];
    inferSourceUnit(results);
    expect(results[0]._sourceUnit).toBeUndefined();
  });

  it("progesterona 19 with explicit unit ng/mL does NOT convert (no rule for ng/mL)", () => {
    const results = [
      makeResult("progesterona", 19, {
        unit: "ng/mL",
        lab_ref_min: 0.1,
        lab_ref_max: 25,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBe(19);
    expect(results[0]._converted).toBeUndefined();
  });

  it("dht 13 with explicit unit ng/dL does NOT convert (already canonical)", () => {
    const results = [
      makeResult("dht", 13, {
        unit: "ng/dL",
        lab_ref_min: 5,
        lab_ref_max: 46,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBe(13);
    expect(results[0]._converted).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. Metadata auditability
// ═══════════════════════════════════════════════════════════════════

describe("regression: inference metadata for auditability", () => {
  it("unit_raw match includes _inferenceEvidence with unit_raw value", () => {
    const results: any[] = [makeResult("pcr", 0.3, { unit: "mg/dL" })];
    inferSourceUnit(results);
    expect(results[0]._inferenceEvidence).toBeDefined();
    expect(results[0]._inferenceEvidence).toContain("unit_raw");
    expect(results[0]._conversionReason).toContain("unit field");
  });

  it("lab_ref_text match includes evidence trail", () => {
    const results: any[] = [
      makeResult("pcr", 0.2, { lab_ref_text: "Inferior a 0.5 mg/dL" }),
    ];
    inferSourceUnit(results);
    expect(results[0]._inferenceEvidence).toContain("lab_ref_text");
    expect(results[0]._conversionConfidence).toBe("medium");
  });

  it("heuristic match includes value in evidence", () => {
    const results: any[] = [makeResult("dht", 130, {})];
    inferSourceUnit(results);
    expect(results[0]._inferenceEvidence).toContain("value=130");
    expect(results[0]._conversionConfidence).toBe("low");
  });

  it("no match → no metadata fields added", () => {
    const results: any[] = [makeResult("hemoglobina", 14, { unit: "g/dL" })];
    inferSourceUnit(results);
    expect(results[0]._sourceUnit).toBeUndefined();
    expect(results[0]._conversionReason).toBeUndefined();
    expect(results[0]._inferenceEvidence).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. EvolutionReportData passthrough — persisted value is final
// ═══════════════════════════════════════════════════════════════════

describe("regression: EvolutionReportData reflects persisted values only", () => {
  // The evolutionReportBuilder reads directly from lab_results.value.
  // These tests verify that the pipeline output (what gets persisted)
  // is correct, so the report will be correct by extension.

  it("Barbara estradiol scenario: value 44, no conversion → persisted as 44", () => {
    const results = [
      makeResult("estradiol", 44, {
        lab_ref_text: "Fase folicular:\nng/dL\n12.5 a 166 pg/mL",
        lab_ref_min: 12.5,
        lab_ref_max: 166,
      }),
    ];
    convertPipeline(results);
    // This is what would be persisted → what the report reads
    expect(results[0].value).toBe(44);
  });

  it("Barbara testosterona_livre scenario: value 0.44, no conversion → persisted as 0.44", () => {
    const results = [
      makeResult("testosterona_livre", 0.44, {
        lab_ref_text: "pmol/L\nHomem: 2,4 a 37,0 pg/mL",
        lab_ref_min: 2.4,
        lab_ref_max: 37,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBe(0.44);
  });

  it("Barbara DHT scenario: value 13, unit ng/dL, no conversion → persisted as 13", () => {
    const results = [
      makeResult("dht", 13, {
        unit: "ng/dL",
        lab_ref_min: 5,
        lab_ref_max: 46,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBe(13);
  });

  it("Barbara PCR scenario: value 0.07 mg/dL → converted to 0.7 mg/L (legitimate)", () => {
    const results = [
      makeResult("pcr", 0.07, {
        unit: "mg/dL",
        lab_ref_max: 0.5,
        lab_ref_text: "Inferior a 0.5 mg/dL",
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBeCloseTo(0.7, 2);
    expect(results[0]._converted).toBe(true);
  });

  it("Barbara progesterona scenario: value 19 ng/mL, no conversion → persisted as 19", () => {
    const results = [
      makeResult("progesterona", 19, {
        unit: "ng/mL",
        lab_ref_min: 0.1,
        lab_ref_max: 25,
      }),
    ];
    convertPipeline(results);
    expect(results[0].value).toBe(19);
    expect(results[0]._converted).toBeUndefined();
  });
});
