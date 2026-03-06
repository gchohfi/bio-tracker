/**
 * Regression tests for supabase/functions/extract-lab-results/convert.ts
 *
 * Covers:
 * 1. Value + reference converted together (same factor)
 * 2. _converted flag prevents double conversion
 * 3. unit_raw defines conversion
 * 4. lab_ref_text defines conversion
 * 5. No conversion when no rule matches
 * 6. Idempotency: calling applyUnitConversions twice = same result
 * 7. Critical markers: estradiol, progesterona, DHT, PCR, testosterona_livre, t3_livre, zinco
 */
import { describe, it, expect } from "vitest";
import {
  applyUnitConversions,
  UNIT_CONVERSIONS,
} from "../../supabase/functions/extract-lab-results/convert";

// Helper: create a result object
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
// 1. Value + reference converted together
// ═══════════════════════════════════════════════════════════════════

describe("convert: value + reference together", () => {
  it("estradiol ng/dL → pg/mL converts value, ref_min, ref_max", () => {
    const results = [
      makeResult("estradiol", 2.5, {
        unit: "ng/dL",
        lab_ref_min: 1.0,
        lab_ref_max: 5.0,
        lab_ref_text: "1.0 a 5.0 ng/dL",
      }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBeCloseTo(25, 2);
    expect(results[0].lab_ref_min).toBeCloseTo(10, 2);
    expect(results[0].lab_ref_max).toBeCloseTo(50, 2);
    expect(results[0]._converted).toBe(true);
  });

  it("pcr mg/dL → mg/L converts value and ref together", () => {
    const results = [
      makeResult("pcr", 0.3, {
        unit: "mg/dL",
        lab_ref_min: 0,
        lab_ref_max: 0.5,
        lab_ref_text: "Inferior a 0.5 mg/dL",
      }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBeCloseTo(3, 2);
    expect(results[0].lab_ref_max).toBeCloseTo(5, 2);
  });

  it("t3_livre ng/dL → pg/mL converts value and ref", () => {
    const results = [
      makeResult("t3_livre", 0.35, {
        unit: "ng/dL",
        lab_ref_min: 0.2,
        lab_ref_max: 0.5,
      }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBeCloseTo(3.5, 2);
    expect(results[0].lab_ref_min).toBeCloseTo(2.0, 2);
    expect(results[0].lab_ref_max).toBeCloseTo(5.0, 2);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. _converted prevents double conversion
// ═══════════════════════════════════════════════════════════════════

describe("convert: _converted flag", () => {
  it("skips already converted results", () => {
    const results = [
      makeResult("estradiol", 25, {
        unit: "ng/dL",
        lab_ref_min: 10,
        lab_ref_max: 50,
        _converted: true,
      }),
    ];
    applyUnitConversions(results);
    // Should NOT multiply again
    expect(results[0].value).toBe(25);
    expect(results[0].lab_ref_min).toBe(10);
    expect(results[0].lab_ref_max).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. unit_raw defines conversion
// ═══════════════════════════════════════════════════════════════════

describe("convert: unit_raw match", () => {
  it("zinco µg/mL → µg/dL via unit field", () => {
    const results = [
      makeResult("zinco", 0.8, {
        unit: "µg/mL",
        lab_ref_min: 0.6,
        lab_ref_max: 1.2,
      }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBeCloseTo(80, 1);
    expect(results[0].lab_ref_min).toBeCloseTo(60, 1);
    expect(results[0].lab_ref_max).toBeCloseTo(120, 1);
  });

  it("testosterona_livre pmol/L → ng/dL via unit field", () => {
    const results = [
      makeResult("testosterona_livre", 347, {
        unit: "pmol/L",
        lab_ref_min: 174,
        lab_ref_max: 694,
      }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBeCloseTo(347 / 34.7, 2);
    expect(results[0].lab_ref_min).toBeCloseTo(174 / 34.7, 2);
    expect(results[0].lab_ref_max).toBeCloseTo(694 / 34.7, 2);
  });

  it("progesterona ng/dL → ng/mL via unit field", () => {
    const results = [
      makeResult("progesterona", 50, {
        unit: "ng/dL",
        lab_ref_min: 20,
        lab_ref_max: 100,
      }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBeCloseTo(0.5, 2);
    expect(results[0].lab_ref_min).toBeCloseTo(0.2, 2);
    expect(results[0].lab_ref_max).toBeCloseTo(1.0, 2);
  });

  it("dht ng/dL → pg/mL via unit field", () => {
    const results = [
      makeResult("dht", 3.0, {
        unit: "ng/dL",
        lab_ref_min: 1.0,
        lab_ref_max: 5.0,
      }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBeCloseTo(30, 1);
    expect(results[0].lab_ref_min).toBeCloseTo(10, 1);
    expect(results[0].lab_ref_max).toBeCloseTo(50, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. lab_ref_text defines conversion (no unit_raw)
// ═══════════════════════════════════════════════════════════════════

describe("convert: lab_ref_text match", () => {
  it("estradiol detected via lab_ref_text ng/dL", () => {
    const results = [
      makeResult("estradiol", 2.0, {
        lab_ref_min: 1.0,
        lab_ref_max: 4.0,
        lab_ref_text: "1.0 a 4.0 ng/dL",
      }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBeCloseTo(20, 1);
    expect(results[0]._converted).toBe(true);
  });

  it("pcr detected via lab_ref_text mg/dL", () => {
    const results = [
      makeResult("pcr", 0.2, {
        lab_ref_max: 0.5,
        lab_ref_text: "Inferior a 0.5 mg/dL",
      }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBeCloseTo(2, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. No conversion when no rule matches
// ═══════════════════════════════════════════════════════════════════

describe("convert: no conversion", () => {
  it("unknown marker is left untouched", () => {
    const results = [
      makeResult("hemoglobina", 14.5, {
        unit: "g/dL",
        lab_ref_min: 12,
        lab_ref_max: 17,
      }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBe(14.5);
    expect(results[0].lab_ref_min).toBe(12);
    expect(results[0].lab_ref_max).toBe(17);
    expect(results[0]._converted).toBeUndefined();
  });

  it("estradiol already in pg/mL is not converted", () => {
    const results = [
      makeResult("estradiol", 25, {
        unit: "pg/mL",
        lab_ref_min: 10,
        lab_ref_max: 50,
      }),
    ];
    applyUnitConversions(results);
    // pg/mL doesn't match any from_unit_pattern and value=25 doesn't trigger heuristic (v<1)
    expect(results[0].value).toBe(25);
    expect(results[0]._converted).toBeUndefined();
  });

  it("non-numeric value is skipped", () => {
    const results = [{ marker_id: "pcr", value: "Reagente" as any }];
    applyUnitConversions(results);
    expect(results[0].value).toBe("Reagente");
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. Idempotency: run twice = same result
// ═══════════════════════════════════════════════════════════════════

describe("convert: idempotency", () => {
  it("calling applyUnitConversions twice gives same result", () => {
    const results = [
      makeResult("t3_livre", 0.35, {
        unit: "ng/dL",
        lab_ref_min: 0.2,
        lab_ref_max: 0.5,
      }),
    ];

    applyUnitConversions(results);
    const afterFirst = { ...results[0] };

    applyUnitConversions(results);
    expect(results[0].value).toBe(afterFirst.value);
    expect(results[0].lab_ref_min).toBe(afterFirst.lab_ref_min);
    expect(results[0].lab_ref_max).toBe(afterFirst.lab_ref_max);
  });

  it("mixed array: converted + unconverted handled correctly on second pass", () => {
    const results = [
      makeResult("estradiol", 2.5, { unit: "ng/dL", lab_ref_max: 5 }),
      makeResult("hemoglobina", 14, { unit: "g/dL" }),
      makeResult("zinco", 0.8, { unit: "µg/mL", lab_ref_min: 0.6, lab_ref_max: 1.2 }),
    ];

    applyUnitConversions(results);
    const snapshot = results.map((r) => ({ ...r }));

    applyUnitConversions(results);
    results.forEach((r, i) => {
      expect(r.value).toBe(snapshot[i].value);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. Critical markers comprehensive
// ═══════════════════════════════════════════════════════════════════

describe("convert: critical markers", () => {
  it("t3_livre pmol/L → pg/mL", () => {
    const results = [
      makeResult("t3_livre", 5.2, { unit: "pmol/L", lab_ref_min: 3.1, lab_ref_max: 6.8 }),
    ];
    applyUnitConversions(results);
    const factor = 1 / 15.36;
    expect(results[0].value).toBeCloseTo(5.2 * factor, 3);
    expect(results[0].lab_ref_min).toBeCloseTo(3.1 * factor, 3);
  });

  it("testosterona_livre pg/mL → ng/dL", () => {
    const results = [
      makeResult("testosterona_livre", 8.5, {
        unit: "pg/mL",
        lab_ref_min: 3.0,
        lab_ref_max: 15.0,
      }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBeCloseTo(0.0085, 4);
    expect(results[0].lab_ref_min).toBeCloseTo(0.003, 4);
  });

  it("progesterona nmol/L → ng/mL", () => {
    const results = [
      makeResult("progesterona", 10, {
        unit: "nmol/L",
        lab_ref_min: 3,
        lab_ref_max: 30,
      }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBeCloseTo(3.145, 2);
    expect(results[0].lab_ref_max).toBeCloseTo(9.435, 2);
  });

  it("dht heuristic: value < 5 without unit triggers conversion", () => {
    const results = [
      makeResult("dht", 3.0, { lab_ref_min: 1.0, lab_ref_max: 5.0 }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBeCloseTo(30, 1);
    expect(results[0]._converted).toBe(true);
  });

  it("pcr heuristic: value 0.3 without unit triggers conversion", () => {
    const results = [
      makeResult("pcr", 0.3, { lab_ref_max: 0.5 }),
    ];
    applyUnitConversions(results);
    expect(results[0].value).toBeCloseTo(3, 1);
    expect(results[0].lab_ref_max).toBeCloseTo(5, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Table completeness check
// ═══════════════════════════════════════════════════════════════════

describe("convert: table completeness", () => {
  const requiredMarkers = [
    "t3_livre",
    "estradiol",
    "zinco",
    "testosterona_livre",
    "pcr",
    "igfbp3",
    "magnesio",
    "vitamina_d",
    "progesterona",
    "dht",
  ];

  it.each(requiredMarkers)("%s is in UNIT_CONVERSIONS", (marker) => {
    expect(UNIT_CONVERSIONS[marker]).toBeDefined();
    expect(UNIT_CONVERSIONS[marker].length).toBeGreaterThan(0);
  });
});
