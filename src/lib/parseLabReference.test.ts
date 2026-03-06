import { describe, it, expect } from "vitest";
import { parseLabReference } from "./parseLabReference";

describe("parseLabReference", () => {
  // ─── Ranges simples ──────────────────────────────────────────────
  describe("ranges simples", () => {
    it("'70 a 100 mg/dL' → range 70–100", () => {
      const r = parseLabReference("70 a 100 mg/dL");
      expect(r.operator).toBe("range");
      expect(r.min).toBe(70);
      expect(r.max).toBe(100);
    });

    it("'3,5 a 12,5' → range 3.5–12.5 (vírgula decimal)", () => {
      const r = parseLabReference("3,5 a 12,5");
      expect(r.operator).toBe("range");
      expect(r.min).toBeCloseTo(3.5);
      expect(r.max).toBeCloseTo(12.5);
    });

    it("'1.000 a 5.000 /mm³' → range 1000–5000 (ponto milhar)", () => {
      const r = parseLabReference("1.000 a 5.000 /mm³");
      expect(r.operator).toBe("range");
      expect(r.min).toBe(1000);
      expect(r.max).toBe(5000);
    });

    it("'De 5,0 a 15,0 µmol/L' → range 5.0–15.0", () => {
      const r = parseLabReference("De 5,0 a 15,0 µmol/L");
      expect(r.operator).toBe("range");
      expect(r.min).toBeCloseTo(5.0);
      expect(r.max).toBeCloseTo(15.0);
    });
  });

  // ─── Operadores ──────────────────────────────────────────────────
  describe("operadores", () => {
    it("'< 200' → operator '<', max 200", () => {
      const r = parseLabReference("< 200");
      expect(r.operator).toBe("<");
      expect(r.max).toBe(200);
      expect(r.min).toBeNull();
    });

    it("'>= 10' → operator '>=', min 10", () => {
      const r = parseLabReference(">= 10");
      expect(r.operator).toBe(">=");
      expect(r.min).toBe(10);
    });

    it("'Inferior a 34 UI/mL' → operator '<', max 34", () => {
      const r = parseLabReference("Inferior a 34 UI/mL");
      expect(r.operator).toBe("<");
      expect(r.max).toBe(34);
    });

    it("'Superior ou igual a 20' → operator '>=', min 20", () => {
      const r = parseLabReference("Superior ou igual a 20");
      expect(r.operator).toBe(">=");
      expect(r.min).toBe(20);
    });

    it("'Até 25.000 /mL' → operator '<=', max 25000", () => {
      const r = parseLabReference("Até 25.000 /mL");
      expect(r.operator).toBe("<=");
      expect(r.max).toBe(25000);
    });

    it("'Acima de 20' → operator '>', min 20", () => {
      const r = parseLabReference("Acima de 20");
      expect(r.operator).toBe(">");
      expect(r.min).toBe(20);
    });

    it("'Abaixo de 5' → operator '<', max 5", () => {
      const r = parseLabReference("Abaixo de 5");
      expect(r.operator).toBe("<");
      expect(r.max).toBe(5);
    });

    it("'Menor que 0,30 g/L' → operator '<', max 0.30", () => {
      const r = parseLabReference("Menor que 0,30 g/L");
      expect(r.operator).toBe("<");
      expect(r.max).toBeCloseTo(0.3);
    });
  });

  // ─── Separação por sexo ──────────────────────────────────────────
  describe("separação por sexo", () => {
    const text1 = "Homens: 4,5 a 5,5 / Mulheres: 4,0 a 5,0";

    it("seleciona faixa masculina com sex='M'", () => {
      const r = parseLabReference(text1, "M");
      expect(r.operator).toBe("range");
      expect(r.min).toBeCloseTo(4.5);
      expect(r.max).toBeCloseTo(5.5);
    });

    it("seleciona faixa feminina com sex='F'", () => {
      const r = parseLabReference(text1, "F");
      expect(r.operator).toBe("range");
      expect(r.min).toBeCloseTo(4.0);
      expect(r.max).toBeCloseTo(5.0);
    });

    it("'Masculino: 13,5 a 17,5 Feminino: 12,0 a 16,0' com sex='F'", () => {
      const r = parseLabReference("Masculino: 13,5 a 17,5 Feminino: 12,0 a 16,0", "F");
      expect(r.operator).toBe("range");
      expect(r.min).toBeCloseTo(12.0);
      expect(r.max).toBeCloseTo(16.0);
    });
  });

  // ─── Multi-fase (ciclo menstrual) ────────────────────────────────
  describe("multi-fase (ciclo menstrual)", () => {
    it("FSH multi-fase → range global 1.7–134.8", () => {
      const text = "Fase folicular: 3,5 a 12,5 / Ovulatória: 4,7 a 21,5 / Lútea: 1,7 a 7,7 / Pós-menopausa: 25,8 a 134,8";
      const r = parseLabReference(text, "F");
      expect(r.operator).toBe("range");
      expect(r.min).toBeCloseTo(1.7);
      expect(r.max).toBeCloseTo(134.8);
    });

    it("Estradiol multi-fase com 'até' → range global inclui min 12.4", () => {
      const text = "Folicular: 12,4 a 233,0 / Ovulatória: 41,0 a 398,0 / Lútea: 22,3 a 341,0 / Pós Menopausa: até 46,7";
      const r = parseLabReference(text, "F");
      expect(r.operator).toBe("range");
      expect(r.min).toBeCloseTo(12.4);
      // max should be 398.0 (highest of all phases)
      expect(r.max).toBeCloseTo(398.0);
    });
  });

  // ─── Faixas etárias (devem ser ignoradas) ────────────────────────
  describe("faixas etárias (ignoradas)", () => {
    it("'Homens 20-49 anos: 5,7 a 17,83' → extrai range 5.7–17.83", () => {
      const r = parseLabReference("Homens 20-49 anos: 5,7 a 17,83", "M");
      expect(r.operator).toBe("range");
      expect(r.min).toBeCloseTo(5.7);
      expect(r.max).toBeCloseTo(17.83);
    });

    it("'Acima de 12 anos: 4,0 a 10,0' → extrai range 4.0–10.0", () => {
      const r = parseLabReference("Acima de 12 anos: 4,0 a 10,0");
      expect(r.operator).toBe("range");
      expect(r.min).toBeCloseTo(4.0);
      expect(r.max).toBeCloseTo(10.0);
    });

    it("'20 a 29 anos: 127 a 424' → extrai range 127–424", () => {
      const r = parseLabReference("20 a 29 anos: 127 a 424");
      expect(r.operator).toBe("range");
      expect(r.min).toBe(127);
      expect(r.max).toBe(424);
    });
  });

  // ─── Qualitativos ────────────────────────────────────────────────
  describe("qualitativos", () => {
    it("'Não Reagente' → qualitative", () => {
      const r = parseLabReference("Não Reagente");
      expect(r.operator).toBe("qualitative");
    });

    it("'Negativo' → qualitative", () => {
      const r = parseLabReference("Negativo");
      expect(r.operator).toBe("qualitative");
    });
  });

  // ─── Números brasileiros (toFloat) ───────────────────────────────
  describe("números brasileiros via ranges", () => {
    it("'1.000,50 a 5.000,00' → 1000.5–5000.0", () => {
      const r = parseLabReference("1.000,50 a 5.000,00");
      expect(r.operator).toBe("range");
      expect(r.min).toBeCloseTo(1000.5);
      expect(r.max).toBeCloseTo(5000.0);
    });

    it("'3.500 a 11.000' → 3500–11000 (ponto milhar)", () => {
      const r = parseLabReference("3.500 a 11.000");
      expect(r.operator).toBe("range");
      expect(r.min).toBe(3500);
      expect(r.max).toBe(11000);
    });

    it("'3,80 a 5,20' → 3.8–5.2 (vírgula decimal)", () => {
      const r = parseLabReference("3,80 a 5,20");
      expect(r.operator).toBe("range");
      expect(r.min).toBeCloseTo(3.8);
      expect(r.max).toBeCloseTo(5.2);
    });
  });
});
