import { describe, it, expect } from "vitest";
import { MARKERS, resolveReference, getMarkerStatusFromRef } from "./markers";

const find = (id: string) => MARKERS.find((m) => m.id === id)!;

const cases = [
  // Gustavo (M, 40 anos)
  { marker: "urina_densidade", value: 1.030, lab_ref_text: "1,005 a 1,030", sex: "M" as const, expected: "normal" },
  { marker: "urina_ph",        value: 5.0,   lab_ref_text: "5,0 a 8,0",     sex: "M" as const, expected: "normal" },
  { marker: "pcr",             value: 1.2,   lab_ref_text: "< 5,0 mg/L",    sex: "M" as const, expected: "normal" },
  { marker: "ldl",             value: 80,    lab_ref_text: "",               sex: "M" as const, expected: "normal" },
  { marker: "ldl",             value: 135,   lab_ref_text: "",               sex: "M" as const, expected: "high" },
  // Julia (F)
  { marker: "colesterol_total", value: 210, lab_ref_text: "< 190",          sex: "F" as const, expected: "high" },
  { marker: "amilase",          value: 68,  lab_ref_text: "28 a 100 U/L",   sex: "F" as const, expected: "normal" },
  { marker: "fsh",              value: 30,  lab_ref_text: "Fase folicular: 3,5 a 12,5 / Ovulatória: 4,7 a 21,5 / Lútea: 1,7 a 7,7 / Pós-menopausa: 25,8 a 134,8", sex: "F" as const, expected: "normal" },
  { marker: "monocitos",        value: 9,   lab_ref_text: "2 a 8 %",        sex: "F" as const, expected: "high" },
];

describe("Integração: classificação de marcadores (cenários reais)", () => {
  for (const c of cases) {
    it(`${c.marker} = ${c.value} (${c.sex}, ref: "${c.lab_ref_text || 'labRange'}") → ${c.expected}`, () => {
      const marker = find(c.marker);
      const ref = resolveReference(marker, c.sex, c.lab_ref_text || undefined);
      const status = getMarkerStatusFromRef(c.value, ref);
      expect(status).toBe(c.expected);
    });
  }
});
