import { describe, it, expect } from "vitest";
import { matchFunctionalRef } from "@/lib/functionalMatcher";
import { resolveFunctionalRef } from "@/lib/functionalRanges";

describe("pending functional fixes", () => {
  describe("Anti-TPO (IU/mL func vs UI/mL canonical)", () => {
    it("resolves with unit conversion IU/mL → UI/mL", () => {
      const result = resolveFunctionalRef("anti_tpo", 15, "F", "UI/mL");
      expect(result).not.toBeNull();
      expect(result!.refText).toContain("35");
      expect(result!.status).toBe("normal");
    });

    it("matchFunctionalRef returns filled=true", () => {
      const r = matchFunctionalRef("anti_tpo", "Anti-TPO", 15, "F", "UI/mL");
      expect(r.log.filled).toBe(true);
      expect(r.result).not.toBeNull();
      expect(r.result!.status).toBe("normal");
    });

    it("flags high Anti-TPO as fora", () => {
      const r = matchFunctionalRef("anti_tpo", "Anti-TPO", 80, "F", "UI/mL");
      expect(r.result).not.toBeNull();
      expect(r.result!.status).toBe("fora");
    });
  });

  describe("Anti-TG (IU/mL func vs UI/mL canonical)", () => {
    it("resolves with unit conversion", () => {
      const result = resolveFunctionalRef("anti_tg", 20, "F", "UI/mL");
      expect(result).not.toBeNull();
      expect(result!.refText).toContain("40");
      expect(result!.status).toBe("normal");
    });
  });

  describe("Magnésio (mg/dL — same unit)", () => {
    it("resolves functional ref correctly", () => {
      const result = resolveFunctionalRef("magnesio", 2.3, "F", "mg/dL");
      expect(result).not.toBeNull();
      expect(result!.refText).toContain("2.1");
      expect(result!.status).toBe("normal");
    });

    it("matchFunctionalRef returns filled=true", () => {
      const r = matchFunctionalRef("magnesio", "Magnésio", 2.3, "F", "mg/dL");
      expect(r.log.filled).toBe(true);
      expect(r.result).not.toBeNull();
    });

    it("flags low magnésio as fora", () => {
      const r = matchFunctionalRef("magnesio", "Magnésio", 1.8, "F", "mg/dL");
      expect(r.result).not.toBeNull();
      expect(r.result!.status).toBe("fora");
    });
  });

  describe("Qualitative urine — full pipeline", () => {
    it("urina_proteinas with text '< 0.10' → normal", () => {
      const r = matchFunctionalRef("urina_proteinas", "Proteínas (urina)", null, "F", "", "< 0.10");
      expect(r.log.filled).toBe(true);
      expect(r.result).not.toBeNull();
      expect(r.result!.status).toBe("normal");
    });

    it("urina_proteinas with text null → ref shown, status null", () => {
      const r = matchFunctionalRef("urina_proteinas", "Proteínas (urina)", null, "F", "", null);
      expect(r.log.filled).toBe(true);
      expect(r.result).not.toBeNull();
      expect(r.result!.refText).toBe("Negativo");
      expect(r.result!.status).toBeNull();
    });

    it("urina_nitritos with text 'negativa' → normal", () => {
      const r = matchFunctionalRef("urina_nitritos", "Nitritos", null, "F", "", "negativa");
      expect(r.log.filled).toBe(true);
      expect(r.result!.status).toBe("normal");
    });

    it("urina_urobilinogenio with text '< 1.0' → normal", () => {
      const r = matchFunctionalRef("urina_urobilinogenio", "Urobilinogênio", null, "F", "", "< 1.0");
      expect(r.log.filled).toBe(true);
      expect(r.result!.status).toBe("normal");
    });

    it("urina_proteinas with numeric value only (no text) → ref shown", () => {
      // Some labs store as numeric value with empty text_value
      const r = matchFunctionalRef("urina_proteinas", "Proteínas (urina)", 0.05, "F", "g/L", null);
      // Qualitative ref should still be found (step 0a)
      expect(r.result).not.toBeNull();
      expect(r.result!.refText).toBe("Negativo");
    });
  });

  describe("Insulina Jejum (µIU/mL func vs µU/mL canonical)", () => {
    it("matchFunctionalRef returns filled=true with < 7", () => {
      const r = matchFunctionalRef("insulina_jejum", "Insulina Jejum", 5, "F", "µU/mL");
      expect(r.log.filled).toBe(true);
      expect(r.result).not.toBeNull();
      expect(r.result!.refText).toContain("7");
      expect(r.result!.status).toBe("normal");
    });

    it("flags high insulina as fora", () => {
      const r = matchFunctionalRef("insulina_jejum", "Insulina Jejum", 12, "M", "µU/mL");
      expect(r.result).not.toBeNull();
      expect(r.result!.status).toBe("fora");
    });
  });
});
