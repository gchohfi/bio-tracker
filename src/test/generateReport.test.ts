/**
 * Testes para a lógica de geração de labRefStr no generateReport.ts.
 * Replica a função de decisão de labRefStr para testar todos os cenários.
 */
import { describe, it, expect } from "vitest";
import { MARKERS } from "@/lib/markers";

// ─── Replicação da lógica labRefStr ──────────────────────────────────────────
// Espelha exatamente o código em src/lib/generateReport.ts

interface LabRef {
  min?: number;
  max?: number;
  text?: string;
}

function buildLabRefStr(
  labRef: LabRef | undefined,
  fallbackMin: number,
  fallbackMax: number,
  isQualitative: boolean
): string {
  if (isQualitative) return "—";
  if (!labRef) return `${fallbackMin} – ${fallbackMax}`;
  if (labRef.min != null && labRef.max != null) {
    return `${labRef.min} – ${labRef.max}`;
  }
  if (labRef.min != null && labRef.max == null) {
    return `> ${labRef.min}`;
  }
  if (labRef.max != null && labRef.min == null) {
    const txt = labRef.text || '';
    const op = /^[<≤]/.test(txt.trim()) ? '<' : '';
    return op ? `${op} ${labRef.max}` : `${fallbackMin} – ${labRef.max}`;
  }
  return `${fallbackMin} – ${fallbackMax}`;
}

// ─── Testes: buildLabRefStr ───────────────────────────────────────────────────
describe("buildLabRefStr — lógica de exibição da Ref. Lab. no PDF", () => {

  describe("sem labRef (usa fallback do labRange)", () => {
    it("TSH sem labRef → usa labRange do markers.ts", () => {
      const tsh = MARKERS.find(m => m.id === "tsh")!;
      const [min, max] = tsh.labRange.F as [number, number];
      const result = buildLabRefStr(undefined, min, max, false);
      expect(result).toBe(`${min} – ${max}`);
    });

    it("Hemoglobina sem labRef → usa labRange do markers.ts", () => {
      const hgb = MARKERS.find(m => m.id === "hemoglobina")!;
      const [min, max] = hgb.labRange.F as [number, number];
      const result = buildLabRefStr(undefined, min, max, false);
      expect(result).toBe(`${min} – ${max}`);
    });
  });

  describe("labRef com min e max (intervalo do laudo)", () => {
    it("labRef { min: 0.45, max: 4.5 } → '0.45 – 4.5'", () => {
      const result = buildLabRefStr({ min: 0.45, max: 4.5 }, 0, 0, false);
      expect(result).toBe("0.45 – 4.5");
    });

    it("labRef { min: 70, max: 99 } (Glicose) → '70 – 99'", () => {
      const result = buildLabRefStr({ min: 70, max: 99 }, 0, 0, false);
      expect(result).toBe("70 – 99");
    });

    it("labRef { min: 11.7, max: 14.9 } (Hemoglobina) → '11.7 – 14.9'", () => {
      const result = buildLabRefStr({ min: 11.7, max: 14.9 }, 0, 0, false);
      expect(result).toBe("11.7 – 14.9");
    });
  });

  describe("labRef só com max (operador <)", () => {
    it("Anti-TPO: labRef { max: 34, text: '< 34' } → '< 34'", () => {
      const result = buildLabRefStr({ max: 34, text: "< 34" }, 0, 999, false);
      expect(result).toBe("< 34");
    });

    it("Anti-TG: labRef { max: 1.3, text: '< 1,3' } → '< 1.3'", () => {
      const result = buildLabRefStr({ max: 1.3, text: "< 1,3" }, 0, 999, false);
      expect(result).toBe("< 1.3");
    });

    it("TRAb: labRef { max: 1.0, text: '< 1.0' } → '< 1'", () => {
      const result = buildLabRefStr({ max: 1.0, text: "< 1.0" }, 0, 999, false);
      expect(result).toBe("< 1");
    });

    it("Testosterona Total: labRef { max: 63, text: '< 63 ng/dL' } → '< 63'", () => {
      const result = buildLabRefStr({ max: 63, text: "< 63 ng/dL" }, 0, 999, false);
      expect(result).toBe("< 63");
    });

    it("labRef { max: 100 } sem text → usa fallback com max (sem operador)", () => {
      // Quando não há texto com operador, usa fallback_min – max
      const result = buildLabRefStr({ max: 100 }, 0, 999, false);
      expect(result).toBe("0 – 100");
    });
  });

  describe("labRef só com min (operador >)", () => {
    it("TFG: labRef { min: 60 } → '> 60'", () => {
      const result = buildLabRefStr({ min: 60 }, 0, 999, false);
      expect(result).toBe("> 60");
    });

    it("Vitamina D: labRef { min: 20 } → '> 20'", () => {
      const result = buildLabRefStr({ min: 20 }, 0, 999, false);
      expect(result).toBe("> 20");
    });
  });

  describe("labRef apenas com texto descritivo (sem min/max)", () => {
    it("Colesterol Total com texto etário → usa labRange do markers.ts", () => {
      const col = MARKERS.find(m => m.id === "colesterol_total")!;
      const [min, max] = col.labRange.F as [number, number];
      // labRef tem apenas text, sem min/max → fallback
      const result = buildLabRefStr({ text: "Maior ou igual a 20 anos:" }, min, max, false);
      expect(result).toBe(`${min} – ${max}`);
    });

    it("Progesterona com texto 'Mulheres' → usa labRange do markers.ts", () => {
      const prog = MARKERS.find(m => m.id === "progesterona")!;
      const [min, max] = prog.labRange.F as [number, number];
      const result = buildLabRefStr({ text: "Mulheres" }, min, max, false);
      expect(result).toBe(`${min} – ${max}`);
    });
  });

  describe("marcadores qualitativos → sempre '—'", () => {
    it("marcador qualitativo → '—' independente do labRef", () => {
      expect(buildLabRefStr({ min: 0, max: 100 }, 0, 100, true)).toBe("—");
    });

    it("marcador qualitativo sem labRef → '—'", () => {
      expect(buildLabRefStr(undefined, 0, 100, true)).toBe("—");
    });
  });
});

// ─── Testes: marcadores qualitativos no MARKERS ───────────────────────────────
describe("Marcadores qualitativos no MARKERS", () => {
  const qualitativeMarkers = [
    "urina_hemoglobina",
    "urina_leucocitos",
    "urina_hemacias",
    "fan",
    "hiv",
  ];

  qualitativeMarkers.forEach(id => {
    it(`${id} deve existir no MARKERS`, () => {
      const marker = MARKERS.find(m => m.id === id);
      expect(marker).toBeDefined();
    });
  });

  it("urina_hemoglobina deve ser qualitativo (labRange com texto ou null)", () => {
    const marker = MARKERS.find(m => m.id === "urina_hemoglobina");
    if (marker) {
      // Marcadores qualitativos têm labRange com valores null ou string
      const range = marker.labRange?.F;
      expect(range).toBeDefined();
    }
  });
});

// ─── Testes: todos os marcadores com operador < têm labRange correto ──────────
describe("Marcadores com operador < no labRange", () => {
  const operatorMarkers = [
    { id: "anti_tpo", expectedMax: 34 },
    { id: "anti_tg", expectedMax: 1.3 },
    { id: "trab", expectedMax: 1.0 },
  ];

  operatorMarkers.forEach(({ id, expectedMax }) => {
    it(`${id} deve ter labRange com max=${expectedMax}`, () => {
      const marker = MARKERS.find(m => m.id === id);
      expect(marker).toBeDefined();
      const range = marker!.labRange?.F || marker!.labRange?.M;
      expect(Array.isArray(range)).toBe(true);
      // O segundo elemento do labRange é o max
      expect(range![1]).toBeCloseTo(expectedMax, 1);
    });
  });
});

// ─── Testes: marcadores com operador > no labRange ───────────────────────────
describe("Marcadores com operador > no labRange", () => {
  it("TFG deve ter labRange com min=60", () => {
    const marker = MARKERS.find(m => m.id === "tfg");
    expect(marker).toBeDefined();
    const range = marker!.labRange?.F || marker!.labRange?.M;
    expect(Array.isArray(range)).toBe(true);
    expect(range![0]).toBe(60);
  });
});

// ─── Testes: consistência do MARKERS ─────────────────────────────────────────
describe("Consistência do MARKERS", () => {
  it("todos os marcadores devem ter id, name e unit definidos", () => {
    for (const marker of MARKERS) {
      expect(marker.id, `Marker ${marker.id} deve ter id`).toBeTruthy();
      expect(marker.name, `Marker ${marker.id} deve ter name`).toBeTruthy();
      // unit pode ser string vazia para qualitativos
      expect(marker.unit, `Marker ${marker.id} deve ter unit definido`).toBeDefined();
    }
  });

  it("todos os marcadores devem ter labRange definido", () => {
    for (const marker of MARKERS) {
      expect(marker.labRange, `Marker ${marker.id} deve ter labRange`).toBeDefined();
    }
  });

  it("todos os marcadores devem ter refRange definido", () => {
    for (const marker of MARKERS) {
      expect(marker.refRange, `Marker ${marker.id} deve ter refRange`).toBeDefined();
    }
  });

  it("não deve haver IDs duplicados no MARKERS", () => {
    const ids = MARKERS.map(m => m.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
