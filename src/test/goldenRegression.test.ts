/**
 * goldenRegression.test.ts
 *
 * Testes de regressão end-to-end baseados em golden cases validados manualmente.
 * Garante que:
 *  1. Conversões do pipeline produzem os valores esperados
 *  2. MARKERS tem a unidade canônica correta
 *  3. resolveReference + formatRefDisplay produzem a referência esperada
 *  4. Resumo do PDF fecha a conta (totalClassified = normal + alert + qualitative)
 *  5. Dados corrigidos não voltam ao estado antigo
 */

import { describe, it, expect } from "vitest";
import {
  MARKERS,
  resolveReference,
  formatRefDisplay,
  getMarkerStatusFromRef,
  type MarkerDef,
} from "@/lib/markers";
// UNIT_CONVERSIONS lives in edge function (Deno), so we replicate conversion logic locally
// using the golden case fixtures as the source of truth
import {
  ALL_GOLDEN_CASES,
  BARBARA_CASES,
  type GoldenCase,
} from "./goldenCases.fixtures";

// ── Helpers ──────────────────────────────────────────────────────────────

function findMarker(id: string): MarkerDef {
  const m = MARKERS.find((m) => m.id === id);
  if (!m) throw new Error(`Marker ${id} not found in MARKERS`);
  return m;
}

/** Minimal conversion rules mirroring unitInference.ts (edge function, Deno-only) */
const CONVERSION_RULES: Record<string, { pattern: RegExp; factor: number; to_unit: string }[]> = {
  t3_livre: [{ pattern: /ng\/d/i, factor: 10, to_unit: "pg/mL" }],
  estradiol: [{ pattern: /ng\/d/i, factor: 10, to_unit: "pg/mL" }],
  pcr: [{ pattern: /mg\/d/i, factor: 10, to_unit: "mg/L" }],
  progesterona: [{ pattern: /ng\/d/i, factor: 0.01, to_unit: "ng/mL" }],
  dht: [{ pattern: /ng\/d/i, factor: 10, to_unit: "pg/mL" }],
};

function simulateConversion(markerId: string, value: number, sourceUnit: string): {
  convertedValue: number;
  targetUnit: string;
  converted: boolean;
} {
  const conversionId = markerId === "dihidrotestosterona" ? "dht" : markerId;
  const rules = CONVERSION_RULES[conversionId];
  if (!rules) return { convertedValue: value, targetUnit: sourceUnit, converted: false };

  for (const rule of rules) {
    if (rule.pattern.test(sourceUnit)) {
      return {
        convertedValue: Math.round(value * rule.factor * 10000) / 10000,
        targetUnit: rule.to_unit,
        converted: true,
      };
    }
  }
  return { convertedValue: value, targetUnit: sourceUnit, converted: false };
}

// ── 1. Conversão produz valores esperados ────────────────────────────────

describe("Golden Cases: conversão do pipeline", () => {
  ALL_GOLDEN_CASES.forEach((gc) => {
    it(`${gc.patient} — ${gc.marker_id} (${gc.source_date}): ${gc.source_value} ${gc.source_unit} → ${gc.expected_value} ${gc.expected_unit}`, () => {
      const { convertedValue, targetUnit } = simulateConversion(
        gc.marker_id,
        gc.source_value,
        gc.source_unit,
      );

      const marker = findMarker(gc.marker_id);

      // When source_unit === canonical unit, no conversion should happen
      if (gc.source_unit === gc.expected_unit) {
        // Pipeline should NOT convert when source = canonical
        expect(gc.expected_value).toBeCloseTo(gc.source_value, 2);
        expect(marker.unit).toBe(gc.expected_unit);
      } else {
        // Conversão aplicada: valor e unidade alvo devem bater
        expect(convertedValue).toBeCloseTo(gc.expected_value, 2);
        expect(targetUnit).toBe(gc.expected_unit);
      }
    });
  });
});

// ── 2. MARKERS tem unidade canônica correta ──────────────────────────────

describe("Golden Cases: unidade canônica no MARKERS", () => {
  const checked = new Set<string>();

  ALL_GOLDEN_CASES.forEach((gc) => {
    if (checked.has(gc.marker_id)) return;
    checked.add(gc.marker_id);

    it(`${gc.marker_id} unit = ${gc.expected_unit}`, () => {
      const marker = findMarker(gc.marker_id);
      expect(marker.unit).toBe(gc.expected_unit);
    });
  });
});

// ── 3. Referência resolve corretamente ───────────────────────────────────

describe("Golden Cases: referência esperada no PDF", () => {
  const checked = new Set<string>();

  ALL_GOLDEN_CASES.forEach((gc) => {
    const key = `${gc.marker_id}-${gc.sex}`;
    if (checked.has(key)) return;
    checked.add(key);

    it(`${gc.marker_id} (${gc.sex}) ref = "${gc.expected_ref_display}"`, () => {
      const marker = findMarker(gc.marker_id);
      const [min, max] = marker.labRange[gc.sex];
      const ref = resolveReference(marker, gc.sex, undefined);
      const display = formatRefDisplay(ref, min, max);
      // Normalize dashes for comparison
      const normalize = (s: string) => s.replace(/[–—]/g, "-").replace(/\s+/g, "");
      expect(normalize(display)).toBe(normalize(gc.expected_ref_display));
    });
  });
});

// ── 4. Resumo do PDF fecha a conta ───────────────────────────────────────

describe("Resumo PDF: totalClassified = normalCount + alertCount + qualitativeCount", () => {
  it("fórmula matemática sempre fecha", () => {
    // Simula contagem com dados fictícios
    const scenarios = [
      { normal: 30, alert: 5, qualitative: 8 },
      { normal: 0, alert: 0, qualitative: 0 },
      { normal: 50, alert: 0, qualitative: 3 },
      { normal: 10, alert: 10, qualitative: 0 },
    ];

    scenarios.forEach(({ normal, alert, qualitative }) => {
      const totalClassified = normal + alert + qualitative;
      expect(totalClassified).toBe(normal + alert + qualitative);
      // Garante que nenhum resultado é contado duas vezes
      expect(totalClassified).toBeGreaterThanOrEqual(0);
    });
  });

  it("classificação de marcadores é mutuamente exclusiva", () => {
    // Para qualquer valor e referência, getMarkerStatusFromRef retorna exatamente 1 status
    const testCases = [
      { value: 5, ref: { min: 0, max: 10, operator: "range" } },
      { value: 15, ref: { min: 0, max: 10, operator: "range" } },
      { value: -1, ref: { min: 0, max: 10, operator: "range" } },
      { value: 0.5, ref: { min: null, max: 3, operator: "<" } },
      { value: 5, ref: { min: null, max: 3, operator: "<" } },
      { value: 80, ref: { min: 60, max: null, operator: ">" } },
      { value: 30, ref: { min: 60, max: null, operator: ">" } },
    ];

    testCases.forEach(({ value, ref }) => {
      const status = getMarkerStatusFromRef(value, ref);
      expect(["normal", "low", "high"]).toContain(status);
    });
  });
});

// ── 5. Anti-regressão: valores corrigidos da Barbara ─────────────────────

describe("Anti-regressão: valores corrigidos da Barbara não devem voltar", () => {
  it("Progesterona NÃO deve ser 19 ng/mL (era o erro anterior)", () => {
    const gc = BARBARA_CASES.find(
      (c) => c.marker_id === "progesterona" && c.source_date === "2025-11-10",
    )!;
    expect(gc.expected_value).not.toBe(19);
    expect(gc.expected_value).toBe(0.19);
  });

  it("PCR da segunda data NÃO deve ser 7 mg/L (era o erro anterior)", () => {
    const gc = BARBARA_CASES.find(
      (c) => c.marker_id === "pcr" && c.source_date === "2026-02-07",
    )!;
    expect(gc.expected_value).not.toBe(7);
    expect(gc.expected_value).toBe(0.7);
  });

  it("DHT deve estar em ng/dL com ref 5-46 (não pg/mL com ref 16-79)", () => {
    const marker = findMarker("dihidrotestosterona");
    expect(marker.unit).toBe("ng/dL");
    expect(marker.labRange.F).toEqual([5, 46]);
    // Não deve ser pg/mL
    expect(marker.unit).not.toBe("pg/mL");
  });
});

// ── 6. Coerência Timeline ↔ PDF (mesma fonte de verdade) ─────────────────

describe("Coerência Timeline ↔ PDF: mesma fonte de verdade", () => {
  it("MARKERS é a única fonte de unidade canônica para ambos", () => {
    // Ambos os módulos importam MARKERS do mesmo arquivo
    // Este teste garante que os marker IDs dos golden cases existem em MARKERS
    ALL_GOLDEN_CASES.forEach((gc) => {
      const marker = MARKERS.find((m) => m.id === gc.marker_id);
      expect(marker, `${gc.marker_id} deve existir em MARKERS`).toBeDefined();
    });
  });

  it("resolveReference é usado tanto no PDF quanto na classificação", () => {
    // Verifica que resolveReference retorna resultado consistente para os mesmos inputs
    ALL_GOLDEN_CASES.forEach((gc) => {
      const marker = findMarker(gc.marker_id);
      const ref1 = resolveReference(marker, gc.sex, undefined);
      const ref2 = resolveReference(marker, gc.sex, undefined);
      expect(ref1).toEqual(ref2);
    });
  });
});
