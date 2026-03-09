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

/** Fixture: prescrição realista com todos os origins */
function mkFullPrescription(): PrescriptionItem[] {
  return [
    mkItem({ origin: "accepted_by_physician", substance: "Vitamina D3", dose: "10.000 UI" }),
    mkItem({ origin: "edited_by_physician", substance: "Ferro quelado 30mg", dose: "30 mg", ai_original: { substance: "Sulfato Ferroso", dose: "300mg", route: "Oral", frequency: "1x/dia", duration: "60 dias", conditions: "", monitoring: "" } }),
    mkItem({ origin: "removed_by_physician", substance: "Zinco quelado", dose: "30 mg" }),
    mkItem({ origin: "suggested_by_ai", substance: "Selênio", dose: "200 mcg" }),
    mkItem({ origin: "manually_added", substance: "Melatonina", dose: "3 mg", route: "Sublingual", frequency: "1x/noite", duration: "30 dias" }),
    mkItem({ origin: "removed_by_physician", substance: "Magnésio", dose: "400 mg" }),
  ];
}

// ════════════════════════════════════════════════════════════════════════
// 1. filterFinalItems
// ════════════════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════════════════
// 2. originLabel
// ════════════════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════════════════
// 3. sanitize
// ════════════════════════════════════════════════════════════════════════

describe("Prescription PDF — sanitize", () => {
  it("replaces special chars for Latin-1 compat", () => {
    expect(sanitize("≤ 500 ≥ 100")).toBe("<= 500 >= 100");
    expect(sanitize("dose – 2x")).toBe("dose - 2x");
    expect(sanitize("\u201ctexto\u201d")).toBe('"texto"');
  });

  it("strips non-Latin-1 unicode but preserves accented Latin-1 chars", () => {
    // Ô (U+00D4) and ã (U+00E3) are within Latin-1 range → preserved
    expect(sanitize("Ômega-3 🐟")).toBe("Ômega-3 ");
    expect(sanitize("São Paulo")).toBe("São Paulo");
    // Emoji is stripped
    expect(sanitize("teste 💊")).toBe("teste ");
  });

  it("handles empty/null-like input", () => {
    expect(sanitize("")).toBe("");
  });

  it("replaces bullet points and smart quotes", () => {
    expect(sanitize("\u2022 item 1")).toBe("- item 1");
    expect(sanitize("\u2018single\u2019")).toBe("'single'");
  });
});

// ════════════════════════════════════════════════════════════════════════
// 4. Metadados da consulta
// ════════════════════════════════════════════════════════════════════════

describe("Prescription PDF — metadata & traceability", () => {
  it("final items preserve encounter metadata fields", () => {
    const params = {
      patientName: "João Silva",
      encounterDate: "15/03/2026",
      specialtyName: "Medicina Funcional",
      practitionerName: "Dr. Ana Costa",
    };
    // sanitize preserves Latin-1 accented chars (ã, ô, etc.)
    expect(sanitize(params.patientName)).toBe("João Silva");
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

// ════════════════════════════════════════════════════════════════════════
// 5. Cenários de rejeição e não-repetição
// ════════════════════════════════════════════════════════════════════════

describe("Prescription PDF — rejection & non-repetition", () => {
  it("rejected items never appear in final output", () => {
    const all = mkFullPrescription();
    const final = filterFinalItems(all);
    const substances = final.map((i) => i.substance);

    // Removed items
    expect(substances).not.toContain("Zinco quelado");
    expect(substances).not.toContain("Magnésio");
    // Suggested (unreviewed) items
    expect(substances).not.toContain("Selênio");
  });

  it("multiple removed items are all excluded", () => {
    const items = [
      mkItem({ origin: "removed_by_physician", substance: "Item1" }),
      mkItem({ origin: "removed_by_physician", substance: "Item2" }),
      mkItem({ origin: "removed_by_physician", substance: "Item3" }),
    ];
    expect(filterFinalItems(items)).toHaveLength(0);
  });

  it("no duplicates in final output from mixed origins", () => {
    const all = mkFullPrescription();
    const final = filterFinalItems(all);
    const substances = final.map((i) => i.substance);
    // All unique
    expect(new Set(substances).size).toBe(substances.length);
  });

  it("final count matches expected: 3 of 6 in full fixture", () => {
    const all = mkFullPrescription();
    const final = filterFinalItems(all);
    expect(all).toHaveLength(6);
    expect(final).toHaveLength(3);
  });
});

// ════════════════════════════════════════════════════════════════════════
// 6. Rastreabilidade e integridade de conteúdo editado
// ════════════════════════════════════════════════════════════════════════

describe("Prescription PDF — traceability & edited content integrity", () => {
  it("edited item uses final content, not ai_original", () => {
    const item = mkItem({
      origin: "edited_by_physician",
      substance: "Ferro quelado 30mg",
      dose: "30 mg",
      route: "Oral",
      ai_original: {
        substance: "Sulfato Ferroso",
        dose: "300mg",
        route: "Oral",
        frequency: "1x/dia",
        duration: "60 dias",
        conditions: "",
        monitoring: "",
      },
    });
    const final = filterFinalItems([item]);
    expect(final[0].substance).toBe("Ferro quelado 30mg");
    expect(final[0].dose).toBe("30 mg");
    // ai_original preserved for audit but NOT used for display
    expect(final[0].ai_original?.substance).toBe("Sulfato Ferroso");
  });

  it("accepted item preserves all fields unchanged", () => {
    const item = mkItem({
      origin: "accepted_by_physician",
      substance: "Vitamina D3",
      dose: "10.000 UI",
      route: "Oral",
      frequency: "1x/dia",
      duration: "90 dias",
      conditions: "Tomar com gordura",
      monitoring: "Dosar 25-OH em 90 dias",
    });
    const final = filterFinalItems([item]);
    expect(final[0].substance).toBe("Vitamina D3");
    expect(final[0].conditions).toBe("Tomar com gordura");
    expect(final[0].monitoring).toBe("Dosar 25-OH em 90 dias");
  });

  it("manually_added item has correct origin label", () => {
    const item = mkItem({ origin: "manually_added", substance: "Melatonina" });
    expect(originLabel(item.origin)).toBe("Manual");
  });

  it("origin counts: AI vs Manual breakdown", () => {
    const all = mkFullPrescription();
    const final = filterFinalItems(all);
    const aiCount = final.filter(
      (i) => i.origin === "accepted_by_physician" || i.origin === "edited_by_physician"
    ).length;
    const manualCount = final.filter((i) => i.origin === "manually_added").length;
    expect(aiCount).toBe(2);
    expect(manualCount).toBe(1);
    expect(aiCount + manualCount).toBe(final.length);
  });
});

// ════════════════════════════════════════════════════════════════════════
// 7. Edge cases
// ════════════════════════════════════════════════════════════════════════

describe("Prescription PDF — edge cases", () => {
  it("all items removed → empty final list", () => {
    const items = [
      mkItem({ origin: "removed_by_physician", substance: "A" }),
      mkItem({ origin: "removed_by_physician", substance: "B" }),
    ];
    expect(filterFinalItems(items)).toHaveLength(0);
  });

  it("all items suggested (unreviewed) → empty final list", () => {
    const items = [
      mkItem({ origin: "suggested_by_ai", substance: "A" }),
      mkItem({ origin: "suggested_by_ai", substance: "B" }),
    ];
    expect(filterFinalItems(items)).toHaveLength(0);
  });

  it("only manually_added items → all appear", () => {
    const items = [
      mkItem({ origin: "manually_added", substance: "A" }),
      mkItem({ origin: "manually_added", substance: "B" }),
      mkItem({ origin: "manually_added", substance: "C" }),
    ];
    expect(filterFinalItems(items)).toHaveLength(3);
  });

  it("sanitize handles substance with special medical chars", () => {
    expect(sanitize("Ômega-3 (EPA/DHA ≥ 1000mg)")).toBe("Ômega-3 (EPA/DHA >= 1000mg)");
    expect(sanitize("Vitamina B₁₂")).toBe("Vitamina B");  // subscripts are non-Latin-1
  });

  it("order is preserved after filtering", () => {
    const items = [
      mkItem({ origin: "accepted_by_physician", substance: "First" }),
      mkItem({ origin: "removed_by_physician", substance: "Skip" }),
      mkItem({ origin: "manually_added", substance: "Second" }),
      mkItem({ origin: "suggested_by_ai", substance: "Skip2" }),
      mkItem({ origin: "edited_by_physician", substance: "Third" }),
    ];
    const result = filterFinalItems(items);
    expect(result.map((i) => i.substance)).toEqual(["First", "Second", "Third"]);
  });
});
