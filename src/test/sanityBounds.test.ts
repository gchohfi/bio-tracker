import { describe, it, expect } from "vitest";
import { resolveReference, MARKERS, getMarkerStatusFromRef } from "@/lib/markers";

describe("resolveReference sanity bounds", () => {
  const find = (id: string) => MARKERS.find((m) => m.id === id)!;

  // Casos que DEVEM ser rejeitados (lab_ref_text lixo)
  describe("rejeita referências absurdas", () => {
    it("Creatinina: '> 12' deve ser rejeitado (labRange 0.7-1.3)", () => {
      const ref = resolveReference(find("creatinina"), "M", "> 12");
      expect(ref.operator).toBe("range"); // fallback para labRange
      expect(ref.min).toBeCloseTo(0.7);
    });

    it("Fósforo: '> 13' deve ser rejeitado (labRange 2.5-4.5)", () => {
      const ref = resolveReference(find("fosforo"), "M", "> 13");
      expect(ref.operator).toBe("range");
    });

    it("Magnésio: '> 20' deve ser rejeitado (labRange 1.6-2.6)", () => {
      const ref = resolveReference(find("magnesio"), "M", "> 20");
      expect(ref.operator).toBe("range");
    });

    it("T4 Livre: '> 20' deve ser rejeitado (labRange 0.7-1.8)", () => {
      const ref = resolveReference(find("t4_livre"), "M", "> 20");
      expect(ref.operator).toBe("range");
    });

    it("TSH: '20 a 59' (faixa etária) deve ser rejeitado", () => {
      const ref = resolveReference(find("tsh"), "M", "20 a 59");
      expect(ref.operator).toBe("range");
      expect(ref.min).toBeCloseTo(0.27);
    });

    it("DHEA-S: '35 a 44' deve ser rejeitado (labRange 80-560)", () => {
      const ref = resolveReference(find("dhea_s"), "M", "35 a 44");
      expect(ref.operator).toBe("range");
      expect(ref.min).toBe(80);
    });

    it("LDL: '>= 20' deve ser rejeitado (labRange 0-130)", () => {
      const ref = resolveReference(find("ldl"), "M", ">= 20");
      // labMin=0 → operador >= não pode ser validado → rejeitado
      expect(ref.operator).toBe("range");
    });

    // ── Fix 2: operador > com valor muito baixo vs labMin ──
    it("HDL: '> 20' deve ser rejeitado (labRange M: 40-999, parsedVal < labMin*0.8)", () => {
      const ref = resolveReference(find("hdl"), "M", "> 20");
      expect(ref.operator).toBe("range"); // fallback para labRange
      expect(ref.min).toBe(40);
    });

    it("Colesterol Total: '> 20' deve ser rejeitado (labMin=0)", () => {
      const ref = resolveReference(find("colesterol_total"), "M", "> 20");
      expect(ref.operator).toBe("range");
      expect(ref.min).toBe(0);
      expect(ref.max).toBe(200);
    });

    it("Triglicerídeos: '> 20' deve ser rejeitado (labMin=0)", () => {
      const ref = resolveReference(find("triglicerides"), "M", "> 20");
      expect(ref.operator).toBe("range");
      expect(ref.min).toBe(0);
      expect(ref.max).toBe(150);
    });

    it("Colesterol Não-HDL: '> 20' deve ser rejeitado (labMin=0)", () => {
      const ref = resolveReference(find("colesterol_nao_hdl"), "M", "> 20");
      expect(ref.operator).toBe("range");
      expect(ref.min).toBe(0);
      expect(ref.max).toBe(160);
    });
  });

  // Casos que DEVEM ser aceitos (lab_ref_text válido)
  describe("aceita referências válidas", () => {
    it("Anti-TPO: '< 34' deve ser aceito (labRange 0-34)", () => {
      const ref = resolveReference(find("anti_tpo"), "F", "< 34");
      expect(ref.operator).toBe("<");
      expect(ref.max).toBe(34);
    });

    it("TSH: '0,27 a 4,20' deve ser aceito", () => {
      const ref = resolveReference(find("tsh"), "F", "0,27 a 4,20");
      expect(ref.operator).toBe("range");
      expect(ref.min).toBeCloseTo(0.27);
      expect(ref.max).toBeCloseTo(4.2);
    });

    it("Ferritina: '26 a 446' deve ser aceito (labRange 22-322)", () => {
      const ref = resolveReference(find("ferritina"), "M", "26 a 446");
      expect(ref.operator).toBe("range");
      expect(ref.min).toBe(26);
      expect(ref.max).toBe(446);
    });

    it("TFG: '> 60' deve ser aceito (labRange 60-9999)", () => {
      const ref = resolveReference(find("tfg"), "M", "> 60");
      expect(ref.operator).toBe(">");
      expect(ref.min).toBe(60);
    });

    it("HDL: '> 40' deve ser aceito (labRange M: 40-999)", () => {
      const ref = resolveReference(find("hdl"), "M", "> 40");
      expect(ref.operator).toBe(">");
      expect(ref.min).toBe(40);
    });
  });

  // Fluxo completo: valor + referência → status correto
  describe("classificação correta end-to-end", () => {
    it("Creatinina 1.24 com '> 12' lixo → NORMAL (não LOW)", () => {
      const ref = resolveReference(find("creatinina"), "M", "> 12");
      const status = getMarkerStatusFromRef(1.24, ref);
      expect(status).toBe("normal");
    });

    it("TSH 4.0 com '20 a 59' lixo → NORMAL (não LOW)", () => {
      const ref = resolveReference(find("tsh"), "M", "20 a 59");
      const status = getMarkerStatusFromRef(4.0, ref);
      expect(status).toBe("normal");
    });

    it("LDL 148 com '>= 20' lixo → HIGH (não NORMAL)", () => {
      const ref = resolveReference(find("ldl"), "M", ">= 20");
      const status = getMarkerStatusFromRef(148, ref);
      expect(status).toBe("high");
    });

    it("DHEA-S 96 com '35 a 44' lixo → NORMAL (não HIGH)", () => {
      const ref = resolveReference(find("dhea_s"), "M", "35 a 44");
      const status = getMarkerStatusFromRef(96, ref);
      expect(status).toBe("normal");
    });
  });
});
