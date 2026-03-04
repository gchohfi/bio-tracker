/**
 * Testes para o fluxo: regexFallback + validateAndFixValues (anti-alucinação).
 * 
 * Bug original: regexFallback re-adicionava marcadores de urina contaminados com
 * valores do hemograma (ex: urina_hemoglobina = 14.9 g/dL). validateAndFixValues
 * era chamado mas o resultado era descartado — os marcadores contaminados persistiam.
 * 
 * SYNC NOTE: manter sincronizado com supabase/functions/extract-lab-results/index.ts
 */
import { describe, it, expect } from "vitest";

// ─── Réplica simplificada da lógica anti-alucinação de validateAndFixValues ───
function validateAndFixValues(results: any[], _patientSex?: string): any[] {
  const bloodHemoglobina = results.find((r: any) => r.marker_id === 'hemoglobina' && typeof r.value === 'number');
  const bloodEritrocitos = results.find((r: any) => r.marker_id === 'eritrocitos' && typeof r.value === 'number');

  for (const r of results) {
    if (r.marker_id === 'urina_hemoglobina') {
      const numVal = typeof r.value === 'number' ? r.value : (typeof r.value === 'string' ? parseFloat(String(r.value).replace(',', '.')) : NaN);
      if (!isNaN(numVal) && numVal > 5) {
        r._remove = true;
      }
      if (typeof r.value === 'string') {
        const v = r.value as string;
        if (/g\/dL/i.test(v) || /milh[õo]es/i.test(v) || /\d+[,.]\d+\s+a\s+\d+[,.]\d+/.test(v) || /\d{2,}[,.]\d+/.test(v)) {
          r._remove = true;
        }
      }
      if (typeof r.text_value === 'string') {
        const tv = r.text_value;
        if (/g\/[dD]?[lL]/i.test(tv) || /milh[õo]es/i.test(tv) || /mm[³3]/i.test(tv) || /µL/i.test(tv) ||
          (/\d{2,}[,.]\d+/.test(tv) && /\d+[,.]\d+\s+a\s+\d+[,.]\d+/.test(tv))) {
          r._remove = true;
        }
      }
      if (!r._remove && bloodHemoglobina && !isNaN(numVal)) {
        if (Math.abs(numVal - bloodHemoglobina.value) < 1) {
          r._remove = true;
        }
      }
    }

    if (r.marker_id === 'urina_hemacias') {
      if (typeof r.value === 'number' && r.value > 100) {
        r._remove = true;
      }
      if (typeof r.value === 'string') {
        const v = r.value as string;
        if (/milh[õo]es/i.test(v) || /mm[³3]/i.test(v) || /µL/i.test(v) || /\d+[,.]\d+\s+a\s+\d+[,.]\d+/.test(v)) {
          r._remove = true;
        }
      }
      if (typeof r.text_value === 'string') {
        const tv = r.text_value;
        if (/milh[õo]es/i.test(tv) || /mm[³3]/i.test(tv) || /µL/i.test(tv) || /g\/[dD]?[lL]/i.test(tv) ||
          (/\d+[,.]\d+\s+a\s+\d+[,.]\d+/.test(tv) && /\d{2,}[,.]\d+/.test(tv))) {
          r._remove = true;
        }
      }
      if (!r._remove && bloodEritrocitos && typeof r.value === 'number') {
        if (Math.abs(r.value - bloodEritrocitos.value) < 0.5) {
          r._remove = true;
        }
      }
    }
  }

  return results.filter((r: any) => !r._remove);
}

// ─── Réplica do pipeline de merge do fallback (versão corrigida) ───
function mergeValidatedFallback(
  validResults: any[],
  beforeFallbackIds: Set<string>,
  patientSex?: string
): any[] {
  const fallbackAdded = validResults.filter((r: any) => !beforeFallbackIds.has(r.marker_id));
  if (fallbackAdded.length > 0) {
    const fallbackValidated = validateAndFixValues(fallbackAdded, patientSex);
    const fallbackValidatedIds = new Set(fallbackValidated.map((r: any) => r.marker_id));
    validResults = validResults.filter((r: any) =>
      beforeFallbackIds.has(r.marker_id) || fallbackValidatedIds.has(r.marker_id)
    );
    validResults = validResults.map((r: any) => {
      if (!beforeFallbackIds.has(r.marker_id)) {
        return fallbackValidated.find((fv: any) => fv.marker_id === r.marker_id) || r;
      }
      return r;
    });
  }
  return validResults;
}

// ─── Réplica do pipeline BUGADO (antes da correção) ───
function mergeValidatedFallbackBuggy(
  validResults: any[],
  beforeFallbackIds: Set<string>,
  patientSex?: string
): any[] {
  const fallbackAdded = validResults.filter((r: any) => !beforeFallbackIds.has(r.marker_id));
  if (fallbackAdded.length > 0) {
    // Bug: resultado da validação é descartado
    const _fallbackValidated = validateAndFixValues(fallbackAdded, patientSex);
    // validResults NÃO é filtrado — marcadores contaminados permanecem
  }
  return validResults;
}

// ─── Testes ───────────────────────────────────────────────────────────────────

describe("Fallback Anti-Hallucination Pipeline", () => {
  // Cenário real: AI extraiu hemoglobina e eritrocitos do hemograma.
  // regexFallback re-adiciona urina_hemoglobina e urina_hemacias com valores do hemograma.
  const baseResults = [
    { marker_id: "hemoglobina", value: 14.9 },
    { marker_id: "eritrocitos", value: 5.09 },
    { marker_id: "hematocrito", value: 44.2 },
    { marker_id: "glicose_jejum", value: 92 },
  ];

  const contaminatedFallback = [
    // Contaminação: valor de hemoglobina do sangue mapeado para urina
    { marker_id: "urina_hemoglobina", value: 14.9, text_value: "14,9 g/dL 13,3 a 16,5" },
    // Contaminação: valor de eritrócitos do sangue mapeado para urina
    { marker_id: "urina_hemacias", value: 5.09, text_value: "5,09 milhões/mm3 4,32 a 5,67" },
    // Marcador legítimo adicionado pelo fallback
    { marker_id: "urina_leucocitos", text_value: "1.000/mL" },
  ];

  const beforeFallbackIds = new Set(baseResults.map(r => r.marker_id));

  it("pipeline corrigido deve remover urina_hemoglobina contaminada", () => {
    const input = [...baseResults, ...contaminatedFallback].map(r => ({ ...r }));
    const result = mergeValidatedFallback(input, beforeFallbackIds, "M");
    const urinaHemo = result.find((r: any) => r.marker_id === "urina_hemoglobina");
    expect(urinaHemo).toBeUndefined();
  });

  it("pipeline corrigido deve remover urina_hemacias contaminada", () => {
    const input = [...baseResults, ...contaminatedFallback].map(r => ({ ...r }));
    const result = mergeValidatedFallback(input, beforeFallbackIds, "M");
    const urinaHemacias = result.find((r: any) => r.marker_id === "urina_hemacias");
    expect(urinaHemacias).toBeUndefined();
  });

  it("pipeline corrigido deve preservar marcadores legítimos do fallback", () => {
    const input = [...baseResults, ...contaminatedFallback].map(r => ({ ...r }));
    const result = mergeValidatedFallback(input, beforeFallbackIds, "M");
    const urinaLeuco = result.find((r: any) => r.marker_id === "urina_leucocitos");
    expect(urinaLeuco).toBeDefined();
    expect(urinaLeuco.text_value).toBe("1.000/mL");
  });

  it("pipeline corrigido deve preservar todos os marcadores originais (pré-fallback)", () => {
    const input = [...baseResults, ...contaminatedFallback].map(r => ({ ...r }));
    const result = mergeValidatedFallback(input, beforeFallbackIds, "M");
    expect(result.find((r: any) => r.marker_id === "hemoglobina")).toBeDefined();
    expect(result.find((r: any) => r.marker_id === "eritrocitos")).toBeDefined();
    expect(result.find((r: any) => r.marker_id === "hematocrito")).toBeDefined();
    expect(result.find((r: any) => r.marker_id === "glicose_jejum")).toBeDefined();
  });

  it("pipeline BUGADO (antes da correção) deixa contaminação passar", () => {
    const input = [...baseResults, ...contaminatedFallback].map(r => ({ ...r }));
    const result = mergeValidatedFallbackBuggy(input, beforeFallbackIds, "M");
    // Bug: urina_hemoglobina contaminada persiste
    const urinaHemo = result.find((r: any) => r.marker_id === "urina_hemoglobina");
    expect(urinaHemo).toBeDefined(); // demonstra o bug
    expect(urinaHemo.value).toBe(14.9); // valor do hemograma, NÃO urina
  });

  it("deve remover urina_hemoglobina com valor numérico > 5", () => {
    const input = [
      { marker_id: "urina_hemoglobina", value: 13.4 },
    ];
    const result = validateAndFixValues(input);
    expect(result.find(r => r.marker_id === "urina_hemoglobina")).toBeUndefined();
  });

  it("deve preservar urina_hemoglobina qualitativa legítima", () => {
    const input = [
      { marker_id: "urina_hemoglobina", text_value: "Negativa" },
    ];
    const result = validateAndFixValues(input);
    expect(result.find(r => r.marker_id === "urina_hemoglobina")).toBeDefined();
  });

  it("deve remover urina_hemacias com text_value contendo milhões/mm³", () => {
    const input = [
      { marker_id: "urina_hemacias", value: 5.09, text_value: "5,09 milhões/mm3 4,32 a 5,67" },
    ];
    const result = validateAndFixValues(input);
    expect(result.find(r => r.marker_id === "urina_hemacias")).toBeUndefined();
  });

  it("deve preservar urina_hemacias qualitativa legítima", () => {
    const input = [
      { marker_id: "urina_hemacias", text_value: "Raras" },
    ];
    const result = validateAndFixValues(input);
    expect(result.find(r => r.marker_id === "urina_hemacias")).toBeDefined();
  });

  it("deve remover urina_hemoglobina por cross-validation com hemoglobina do sangue", () => {
    const input = [
      { marker_id: "hemoglobina", value: 14.5 },
      { marker_id: "urina_hemoglobina", value: 14.5 },
    ];
    const result = validateAndFixValues(input);
    expect(result.find(r => r.marker_id === "urina_hemoglobina")).toBeUndefined();
    expect(result.find(r => r.marker_id === "hemoglobina")).toBeDefined();
  });

  it("deve remover urina_hemacias por cross-validation com eritrocitos do sangue", () => {
    const input = [
      { marker_id: "eritrocitos", value: 5.09 },
      { marker_id: "urina_hemacias", value: 5.09 },
    ];
    const result = validateAndFixValues(input);
    expect(result.find(r => r.marker_id === "urina_hemacias")).toBeUndefined();
    expect(result.find(r => r.marker_id === "eritrocitos")).toBeDefined();
  });
});
