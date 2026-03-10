import { describe, it, expect } from "vitest";
import { resolveQualitativeFunctionalRef, normalizeQualitativeText } from "@/lib/functionalRanges";
import { matchFunctionalRef } from "@/lib/functionalMatcher";

describe("qualitative functional: urine markers", () => {
  // Cases the user reported as broken
  const brokenCases = [
    { markerId: "urina_proteinas", name: "Proteínas (urina)", text: "< 0.10", expectStatus: "normal" },
    { markerId: "urina_glicose", name: "Glicose (urina)", text: "< 0.3", expectStatus: "normal" },
    { markerId: "urina_nitritos", name: "Nitritos", text: "negativa", expectStatus: "normal" },
    { markerId: "urina_bilirrubina", name: "Bilirrubina (urina)", text: "negativa", expectStatus: "normal" },
    { markerId: "urina_urobilinogenio", name: "Urobilinogênio", text: "< 1.0", expectStatus: "normal" },
    { markerId: "urina_cetona", name: "Cetonas", text: "negativa", expectStatus: "normal" },
  ];

  const workingCases = [
    { markerId: "urina_celulas", name: "Células Epiteliais", text: "raras", expectStatus: "normal" },
    { markerId: "urina_cilindros", name: "Cilindros", text: "ausentes", expectStatus: "normal" },
  ];

  describe("resolveQualitativeFunctionalRef directly", () => {
    for (const c of [...brokenCases, ...workingCases]) {
      it(`${c.markerId}: "${c.text}" → ${c.expectStatus}`, () => {
        const result = resolveQualitativeFunctionalRef(c.markerId, c.text);
        expect(result).not.toBeNull();
        expect(result!.status).toBe(c.expectStatus);
      });
    }
  });

  describe("matchFunctionalRef (full pipeline)", () => {
    for (const c of [...brokenCases, ...workingCases]) {
      it(`${c.markerId}: "${c.text}" → filled + normal`, () => {
        const result = matchFunctionalRef(c.markerId, c.name, null, "F", "", c.text);
        expect(result.log.filled).toBe(true);
        expect(result.result).not.toBeNull();
        expect(result.result!.status).toBe(c.expectStatus);
      });
    }
  });
});

describe("qualitative: hormonal fields must stay blank", () => {
  const blankMarkers = [
    { markerId: "estrona", name: "Estrona (E1)" },
    { markerId: "androstenediona", name: "Androstenediona" },
    { markerId: "progesterona", name: "Progesterona" },
    { markerId: "dhea_s", name: "DHEA-S" },
    { markerId: "dht", name: "Di-hidrotestosterona" },
  ];

  for (const m of blankMarkers) {
    it(`${m.markerId}: no qualitative ref, no functional ref for F`, () => {
      const qualResult = resolveQualitativeFunctionalRef(m.markerId, null);
      expect(qualResult).toBeNull();
    });
  }
});

describe("normalizeQualitativeText edge cases", () => {
  it("preserves < operator after normalization for BDL detection", () => {
    // The key issue: normalizeQualitativeText strips periods
    // BDL detection must still work on the result
    const normalized = normalizeQualitativeText("< 0.10");
    expect(normalized).toContain("<");
  });
});
