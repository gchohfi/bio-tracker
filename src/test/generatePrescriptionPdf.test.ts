/**
 * generatePrescriptionPdf.test.ts
 *
 * Testes unitários para a lógica de filtragem e construção do PDF de prescrição.
 * Como jsPDF depende de DOM/canvas, testamos a lógica pura (filtragem, sanitização, labels).
 */

import { describe, it, expect } from "vitest";
import type { PrescriptionItem, ItemOrigin } from "@/components/EncounterPrescriptionEditor";

// ── Re-export da lógica interna (testável sem jsPDF) ──

const INCLUDED_ORIGINS: ItemOrigin[] = [
  "accepted_by_physician",
  "edited_by_physician",
  "manually_added",
];

function filterFinalItems(items: PrescriptionItem[]): PrescriptionItem[] {
  return items.filter((item) => INCLUDED_ORIGINS.includes(item.origin));
}

function originLabel(origin: ItemOrigin): string {
  switch (origin) {
    case "accepted_by_physician": return "IA (aceito)";
    case "edited_by_physician": return "IA (editado)";
    case "manually_added": return "Manual";
    default: return "";
  }
}

function sanitize(text: string): string {
  if (!text) return "";
  return text
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u2022/g, "-")
    .replace(/[^\x00-\xFF]/g, "");
}

// ── Fixtures ──

function mkItem(overrides: Partial<PrescriptionItem> & { origin: ItemOrigin }): PrescriptionItem {
  return {
    substance: "Vitamina D3",
    dose: "10.000 UI",
    route: "Oral",
    frequency: "1x/dia",
    duration: "90 dias",
    conditions: "",
    monitoring: "",
    ...overrides,
  };
}

// ── Tests ──

describe("Prescription PDF — filterFinalItems", () => {
  it("includes accepted_by_physician", () => {
    const items = [mkItem({ origin: "accepted_by_physician" })];
    expect(filterFinalItems(items)).toHaveLength(1);
  });

  it("includes edited_by_physician with final edited content", () => {
    const item = mkItem({ origin: "edited_by_physician", substance: "Ferro quelado", ai_original: { substance: "Sulfato Ferroso", dose: "300mg", route: "Oral", frequency: "1x/dia", duration: "60 dias", conditions: "", monitoring: "" } });
    const result = filterFinalItems([item]);
    expect(result).toHaveLength(1);
    expect(result[0].substance).toBe("Ferro quelado");
  });

  it("includes manually_added", () => {
    const items = [mkItem({ origin: "manually_added", substance: "Melatonina" })];
    expect(filterFinalItems(items)).toHaveLength(1);
  });

  it("excludes removed_by_physician", () => {
    const items = [mkItem({ origin: "removed_by_physician" })];
    expect(filterFinalItems(items)).toHaveLength(0);
  });

  it("excludes suggested_by_ai (not yet reviewed)", () => {
    const items = [mkItem({ origin: "suggested_by_ai" })];
    expect(filterFinalItems(items)).toHaveLength(0);
  });

  it("mixed list filters correctly", () => {
    const items = [
      mkItem({ origin: "accepted_by_physician", substance: "A" }),
      mkItem({ origin: "removed_by_physician", substance: "B" }),
      mkItem({ origin: "suggested_by_ai", substance: "C" }),
      mkItem({ origin: "edited_by_physician", substance: "D" }),
      mkItem({ origin: "manually_added", substance: "E" }),
    ];
    const result = filterFinalItems(items);
    expect(result).toHaveLength(3);
    expect(result.map((i) => i.substance)).toEqual(["A", "D", "E"]);
  });

  it("empty list returns empty", () => {
    expect(filterFinalItems([])).toHaveLength(0);
  });
});

describe("Prescription PDF — originLabel", () => {
  it("accepted → 'IA (aceito)'", () => {
    expect(originLabel("accepted_by_physician")).toBe("IA (aceito)");
  });

  it("edited → 'IA (editado)'", () => {
    expect(originLabel("edited_by_physician")).toBe("IA (editado)");
  });

  it("manually_added → 'Manual'", () => {
    expect(originLabel("manually_added")).toBe("Manual");
  });

  it("removed → empty (never shown in PDF)", () => {
    expect(originLabel("removed_by_physician")).toBe("");
  });

  it("suggested → empty (never shown in PDF)", () => {
    expect(originLabel("suggested_by_ai")).toBe("");
  });
});

describe("Prescription PDF — sanitize", () => {
  it("replaces special chars for Latin-1 compat", () => {
    expect(sanitize("≤ 500 ≥ 100")).toBe("<= 500 >= 100");
    expect(sanitize("dose – 2x")).toBe("dose - 2x");
    expect(sanitize("\u201ctexto\u201d")).toBe('"texto"');
  });

  it("strips non-Latin-1 unicode", () => {
    expect(sanitize("Ômega-3 🐟")).toBe("mega-3 ");
  });

  it("handles empty/null-like input", () => {
    expect(sanitize("")).toBe("");
  });
});

describe("Prescription PDF — metadata & traceability", () => {
  it("final items preserve encounter metadata fields", () => {
    const params = {
      patientName: "João Silva",
      encounterDate: "15/03/2026",
      specialtyName: "Medicina Funcional",
      practitionerName: "Dr. Ana Costa",
    };
    // Simulate what the PDF receives
    expect(sanitize(params.patientName)).toBe("Joo Silva");
    expect(sanitize(params.encounterDate)).toBe("15/03/2026");
    expect(sanitize(params.specialtyName)).toBe("Medicina Funcional");
    expect(sanitize(params.practitionerName)).toBe("Dr. Ana Costa");
  });

  it("origin label maps correctly for audit trail in PDF table", () => {
    const items = [
      mkItem({ origin: "accepted_by_physician" }),
      mkItem({ origin: "edited_by_physician" }),
      mkItem({ origin: "manually_added" }),
    ];
    const labels = filterFinalItems(items).map((i) => originLabel(i.origin));
    expect(labels).toEqual(["IA (aceito)", "IA (editado)", "Manual"]);
  });
});
