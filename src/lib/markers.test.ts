import { describe, it, expect } from "vitest";
import { resolveReference, getMarkerStatusFromRef, MARKERS } from "./markers";

const find = (id: string) => MARKERS.find((m) => m.id === id)!;

describe("resolveReference", () => {
  it("lab_ref_text válido dentro do sanity check → retorna parsed do lab_ref_text", () => {
    const ref = resolveReference(find("tsh"), "F", "0,27 a 4,2");
    expect(ref.operator).toBe("range");
    expect(ref.min).toBeCloseTo(0.27);
    expect(ref.max).toBeCloseTo(4.2);
  });

  it("lab_ref_text fora do sanity check (ratio > 5x) → retorna labRange como fallback", () => {
    // TSH labRange is [0.45, 4.5]; "20 a 59" is an age range that fails sanity
    const ref = resolveReference(find("tsh"), "F", "20 a 59");
    expect(ref.operator).toBe("range");
    expect(ref.min).toBe(find("tsh").labRange.F[0]);
    expect(ref.max).toBe(find("tsh").labRange.F[1]);
  });

  it("sem lab_ref_text → retorna labRange", () => {
    const marker = find("hemoglobina");
    const ref = resolveReference(marker, "F", undefined);
    expect(ref.operator).toBe("range");
    expect(ref.min).toBe(marker.labRange.F[0]);
    expect(ref.max).toBe(marker.labRange.F[1]);
  });

  it("marcador com sentinel (99999) no labRange → funciona sem crash", () => {
    const marker = find("vitamina_d");
    const ref = resolveReference(marker, "F", undefined);
    expect(ref.operator).toBe("range");
    expect(ref.min).toBe(marker.labRange.F[0]);
    expect(ref.max).toBe(marker.labRange.F[1]);
  });

  it("referência multi-fase → sanity check rejeita range global, retorna labRange", () => {
    // Multi-phase ref (1.7–134.8) fails sanity check vs FSH labRange (3.5–12.5)
    // because the ratio is too large. resolveReference correctly falls back to labRange.
    const marker = find("fsh");
    const ref = resolveReference(
      marker,
      "F",
      "Fase folicular: 3,5 a 12,5 / Ovulatória: 4,7 a 21,5 / Lútea: 1,7 a 7,7 / Pós-menopausa: 25,8 a 134,8"
    );
    expect(ref.operator).toBe("range");
    expect(ref.min).toBe(marker.labRange.F[0]);
    expect(ref.max).toBe(marker.labRange.F[1]);
  });
});

describe("getMarkerStatusFromRef", () => {
  it("valor dentro do range → normal", () => {
    expect(getMarkerStatusFromRef(5.0, { min: 3.5, max: 10.5, operator: "range" })).toBe("normal");
  });

  it("valor abaixo do min → low", () => {
    expect(getMarkerStatusFromRef(2.0, { min: 3.5, max: 10.5, operator: "range" })).toBe("low");
  });

  it("valor acima do max → high", () => {
    expect(getMarkerStatusFromRef(12.0, { min: 3.5, max: 10.5, operator: "range" })).toBe("high");
  });

  it("operador '<' com max=200, value=150 → normal", () => {
    expect(getMarkerStatusFromRef(150, { min: null, max: 200, operator: "<" })).toBe("normal");
  });

  it("operador '<' com max=200, value=250 → high", () => {
    expect(getMarkerStatusFromRef(250, { min: null, max: 200, operator: "<" })).toBe("high");
  });

  it("operador '>' com min=20, value=30 → normal", () => {
    expect(getMarkerStatusFromRef(30, { min: 20, max: null, operator: ">" })).toBe("normal");
  });

  it("operador '>' com min=20, value=15 → low", () => {
    expect(getMarkerStatusFromRef(15, { min: 20, max: null, operator: ">" })).toBe("low");
  });

  it("LDL value=80 com labRange [0,129] → normal (não low)", () => {
    const ref = resolveReference(find("ldl"), "M", undefined);
    expect(ref.min).toBe(0);
    expect(ref.max).toBe(129);
    expect(getMarkerStatusFromRef(80, ref)).toBe("normal");
  });

  it("Monócitos value=9 com labRange [2,8] → high", () => {
    const ref = resolveReference(find("monocitos"), "F", undefined);
    expect(ref.min).toBe(2);
    expect(ref.max).toBe(8);
    expect(getMarkerStatusFromRef(9, ref)).toBe("high");
  });

  it("PCR value=1.2 com ref '< 5 mg/L' → normal", () => {
    const ref = resolveReference(find("pcr"), "M", "< 5 mg/L");
    expect(getMarkerStatusFromRef(1.2, ref)).toBe("normal");
  });
});
