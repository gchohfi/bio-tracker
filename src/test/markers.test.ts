import { describe, it, expect } from "vitest";
import {
  parseOperatorValue,
  getMarkerStatusFromRef,
  resolveReference,
  MARKERS,
} from "@/lib/markers";

// ─── parseOperatorValue ──────────────────────────────────────────────────────
describe("parseOperatorValue", () => {
  it("parses '< 34' correctly", () => {
    const result = parseOperatorValue("< 34");
    expect(result).toEqual({ operator: "<", numericValue: 34 });
  });

  it("parses '<34' (sem espaço) correctly", () => {
    const result = parseOperatorValue("<34");
    expect(result).toEqual({ operator: "<", numericValue: 34 });
  });

  it("parses '< 1,3' (vírgula decimal) correctly", () => {
    const result = parseOperatorValue("< 1,3");
    expect(result).toEqual({ operator: "<", numericValue: 1.3 });
  });

  it("parses '> 60' correctly", () => {
    const result = parseOperatorValue("> 60");
    expect(result).toEqual({ operator: ">", numericValue: 60 });
  });

  it("parses '<= 1.0' correctly", () => {
    const result = parseOperatorValue("<= 1.0");
    expect(result).toEqual({ operator: "<=", numericValue: 1.0 });
  });

  it("parses '>= 6.7' correctly", () => {
    const result = parseOperatorValue(">= 6.7");
    expect(result).toEqual({ operator: ">=", numericValue: 6.7 });
  });

  it("returns null for plain numeric string", () => {
    expect(parseOperatorValue("34")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseOperatorValue("")).toBeNull();
  });

  it("returns null for descriptive text", () => {
    expect(parseOperatorValue("Maior ou igual a 20 anos:")).toBeNull();
  });

  it("parses '≤ 34' (Unicode) and normalizes to '<='", () => {
    const result = parseOperatorValue("≤ 34");
    expect(result).toEqual({ operator: "<=", numericValue: 34 });
  });

  it("parses '≥ 60' (Unicode) and normalizes to '>='", () => {
    const result = parseOperatorValue("≥ 60");
    expect(result).toEqual({ operator: ">=", numericValue: 60 });
  });
});

// ─── getMarkerStatusFromRef ──────────────────────────────────────────────────
describe("getMarkerStatusFromRef", () => {
  // Operador < (ex: Anti-TPO < 34, Anti-TG < 1.3, TRAb < 1.0)
  describe("operator '<'", () => {
    it("classifica como normal quando valor == limite (< 34 com valor 34)", () => {
      // Bug corrigido: 34 <= 34 deve ser normal
      expect(getMarkerStatusFromRef(34, { min: null, max: 34, operator: "<" })).toBe("normal");
    });

    it("classifica como normal quando valor < limite (< 34 com valor 10)", () => {
      expect(getMarkerStatusFromRef(10, { min: null, max: 34, operator: "<" })).toBe("normal");
    });

    it("classifica como high quando valor > limite (< 34 com valor 50)", () => {
      expect(getMarkerStatusFromRef(50, { min: null, max: 34, operator: "<" })).toBe("high");
    });

    it("Anti-TPO < 34: valor 34 deve ser normal", () => {
      expect(getMarkerStatusFromRef(34, { min: null, max: 34, operator: "<" })).toBe("normal");
    });

    it("Anti-TG < 1.3: valor 1.3 deve ser normal", () => {
      expect(getMarkerStatusFromRef(1.3, { min: null, max: 1.3, operator: "<" })).toBe("normal");
    });

    it("TRAb < 1.0: valor 1.0 deve ser normal", () => {
      expect(getMarkerStatusFromRef(1.0, { min: null, max: 1.0, operator: "<" })).toBe("normal");
    });

    it("Fator Reumatoide < 14: valor 10 deve ser normal", () => {
      expect(getMarkerStatusFromRef(10, { min: null, max: 14, operator: "<" })).toBe("normal");
    });

    it("Fator Reumatoide < 14: valor 20 deve ser high", () => {
      expect(getMarkerStatusFromRef(20, { min: null, max: 14, operator: "<" })).toBe("high");
    });

    // ── Boundary: floating-point near-limit values ──
    it("< 34: valor 34.000001 deve ser high (float boundary)", () => {
      expect(getMarkerStatusFromRef(34.000001, { min: null, max: 34, operator: "<" })).toBe("high");
    });

    it("< 34: valor 33.999999 deve ser normal (float boundary)", () => {
      expect(getMarkerStatusFromRef(33.999999, { min: null, max: 34, operator: "<" })).toBe("normal");
    });

    it("< 1.3: valor 1.3000001 deve ser high (Anti-TG float boundary)", () => {
      expect(getMarkerStatusFromRef(1.3000001, { min: null, max: 1.3, operator: "<" })).toBe("high");
    });

    it("< 1.0: valor 1.0000001 deve ser high (TRAb float boundary)", () => {
      expect(getMarkerStatusFromRef(1.0000001, { min: null, max: 1.0, operator: "<" })).toBe("high");
    });
  });

  // Operador <= 
  describe("operator '<='", () => {
    it("classifica como normal quando valor == limite", () => {
      expect(getMarkerStatusFromRef(34, { min: null, max: 34, operator: "<=" })).toBe("normal");
    });

    it("classifica como normal quando valor < limite", () => {
      expect(getMarkerStatusFromRef(20, { min: null, max: 34, operator: "<=" })).toBe("normal");
    });

    it("classifica como high quando valor > limite", () => {
      expect(getMarkerStatusFromRef(50, { min: null, max: 34, operator: "<=" })).toBe("high");
    });
  });

  // Operador > (ex: TFG > 60)
  describe("operator '>'", () => {
    it("classifica como normal quando valor == limite (> 60 com valor 60)", () => {
      expect(getMarkerStatusFromRef(60, { min: 60, max: null, operator: ">" })).toBe("normal");
    });

    it("classifica como normal quando valor > limite (> 60 com valor 100)", () => {
      expect(getMarkerStatusFromRef(100, { min: 60, max: null, operator: ">" })).toBe("normal");
    });

    it("classifica como low quando valor < limite (> 60 com valor 45)", () => {
      expect(getMarkerStatusFromRef(45, { min: 60, max: null, operator: ">" })).toBe("low");
    });
  });

  // Operador >=
  describe("operator '>='", () => {
    it("classifica como normal quando valor == limite", () => {
      expect(getMarkerStatusFromRef(6.7, { min: 6.7, max: null, operator: ">=" })).toBe("normal");
    });

    it("classifica como normal quando valor > limite", () => {
      expect(getMarkerStatusFromRef(10, { min: 6.7, max: null, operator: ">=" })).toBe("normal");
    });

    it("classifica como low quando valor < limite", () => {
      expect(getMarkerStatusFromRef(5, { min: 6.7, max: null, operator: ">=" })).toBe("low");
    });
  });

  // Operador range (padrão)
  describe("operator 'range'", () => {
    it("classifica como normal quando valor está dentro da faixa", () => {
      expect(getMarkerStatusFromRef(5.0, { min: 0.45, max: 4.5, operator: "range" })).toBe("high");
    });

    it("classifica como low quando valor está abaixo da faixa", () => {
      expect(getMarkerStatusFromRef(0.1, { min: 0.45, max: 4.5, operator: "range" })).toBe("low");
    });

    it("classifica como normal quando valor está dentro da faixa", () => {
      expect(getMarkerStatusFromRef(2.0, { min: 0.45, max: 4.5, operator: "range" })).toBe("normal");
    });

    it("classifica como high quando valor está acima da faixa", () => {
      expect(getMarkerStatusFromRef(10, { min: 0.45, max: 4.5, operator: "range" })).toBe("high");
    });
  });
});

// ─── resolveReference ────────────────────────────────────────────────────────
describe("resolveReference", () => {
  const antiTpoMarker = MARKERS.find((m) => m.id === "anti_tpo")!;
  const tshMarker = MARKERS.find((m) => m.id === "tsh")!;
  const tfgMarker = MARKERS.find((m) => m.id === "tfg")!;
  const colesterolMarker = MARKERS.find((m) => m.id === "colesterol_total")!;

  it("Anti-TPO: resolve '< 34' como operador < com max=34", () => {
    const ref = resolveReference(antiTpoMarker, "F", "< 34");
    expect(ref.operator).toBe("<");
    expect(ref.max).toBe(34);
    expect(ref.min).toBeNull();
  });

  it("TSH: resolve '0,45 a 4,5' como range numérico", () => {
    const ref = resolveReference(tshMarker, "F", "0,45 a 4,5");
    expect(ref.operator).toBe("range");
    expect(ref.min).toBeCloseTo(0.45, 2);
    expect(ref.max).toBeCloseTo(4.5, 1);
  });

  it("TFG: resolve '> 60' como operador > com min=60", () => {
    const ref = resolveReference(tfgMarker, "F", "> 60");
    expect(ref.operator).toBe(">");
    expect(ref.min).toBe(60);
    expect(ref.max).toBeNull();
  });

  it("Colesterol Total: texto descritivo 'Maior ou igual a 20 anos:' usa labRange como fallback", () => {
    const ref = resolveReference(colesterolMarker, "F", "Maior ou igual a 20 anos:");
    // Deve usar labRange do markers.ts como fallback
    expect(ref.operator).toBe("range");
    expect(ref.min).toBe(colesterolMarker.labRange.F[0]);
    expect(ref.max).toBe(colesterolMarker.labRange.F[1]);
  });

  it("Sem lab_ref_text: usa labRange do markers.ts", () => {
    const ref = resolveReference(tshMarker, "F", undefined);
    expect(ref.operator).toBe("range");
    expect(ref.min).toBe(tshMarker.labRange.F[0]);
    expect(ref.max).toBe(tshMarker.labRange.F[1]);
  });
});

// ─── Integração: fluxo completo Anti-TPO ─────────────────────────────────────
describe("Fluxo completo Anti-TPO (bug fix)", () => {
  const antiTpoMarker = MARKERS.find((m) => m.id === "anti_tpo")!;

  it("Anti-TPO com valor 34 e lab_ref_text '< 34' deve ser normal (não high)", () => {
    // Simula o fluxo: laudo diz "< 34", valor armazenado é 34
    const ref = resolveReference(antiTpoMarker, "F", "< 34");
    const status = getMarkerStatusFromRef(34, ref);
    expect(status).toBe("normal");
  });

  it("Anti-TPO com valor 50 e lab_ref_text '< 34' deve ser high", () => {
    const ref = resolveReference(antiTpoMarker, "F", "< 34");
    const status = getMarkerStatusFromRef(50, ref);
    expect(status).toBe("high");
  });
});

// ─── Integração: fluxo completo TFG ─────────────────────────────────────────
describe("Fluxo completo TFG (operador >)", () => {
  const tfgMarker = MARKERS.find((m) => m.id === "tfg")!;

  it("TFG com valor 60 e lab_ref_text '> 60' deve ser normal", () => {
    const ref = resolveReference(tfgMarker, "F", "> 60");
    const status = getMarkerStatusFromRef(60, ref);
    expect(status).toBe("normal");
  });

  it("TFG com valor 103 e lab_ref_text '> 60' deve ser normal", () => {
    const ref = resolveReference(tfgMarker, "F", "> 60");
    const status = getMarkerStatusFromRef(103, ref);
    expect(status).toBe("normal");
  });

  it("TFG com valor 45 e lab_ref_text '> 60' deve ser low", () => {
    const ref = resolveReference(tfgMarker, "F", "> 60");
    const status = getMarkerStatusFromRef(45, ref);
    expect(status).toBe("low");
  });
});
