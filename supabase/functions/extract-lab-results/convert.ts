/**
 * convert.ts
 *
 * Camada de conversão centralizada de unidades.
 * SOMENTE conversões de unidade vivem aqui — NÃO ajustes de escala, NÃO derivados.
 *
 * Regras:
 * 1. NÃO decide unidade — recebe _sourceUnit/_targetUnit/_conversionFactor de unitInference.ts
 * 2. Valor e referência são convertidos JUNTOS (mesmo fator, mesma chamada)
 * 3. Idempotente: marca `_converted` no resultado; se já marcado, pula
 * 4. Só converte quando _conversionFactor está presente (inferido por unitInference.ts)
 * 5. Log explícito: "[CONVERT] marker: value from→to, unit from→to"
 */

// Re-export table for backward compatibility and tests
export { UNIT_CONVERSIONS } from "./unitInference.ts";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function applyFactor(value: number, factor: number): number {
  return Math.round(value * factor * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// Main conversion function
// ---------------------------------------------------------------------------

/**
 * Aplica conversões de unidade centralizadas a um array de resultados.
 * Opera in-place sobre os resultados (formato legado any[]).
 *
 * REQUER que inferSourceUnit() tenha sido chamado antes, marcando
 * _sourceUnit, _targetUnit e _conversionFactor nos resultados.
 *
 * Converte valor E referência JUNTOS. Marca _converted para idempotência.
 */
export function applyUnitConversions(results: any[]): any[] {
  for (const r of results) {
    // Idempotência: se já convertido, pular
    if (r._converted) continue;

    // Sem valor numérico: pular
    if (typeof r.value !== "number") continue;

    // Sem inferência: pular (unitInference.ts não marcou)
    if (!r._conversionFactor || !r._sourceUnit || !r._targetUnit) continue;

    const factor: number = r._conversionFactor;
    const sourceUnit: string = r._sourceUnit;
    const targetUnit: string = r._targetUnit;

    const originalValue = r.value;
    const originalRefMin = r.lab_ref_min;
    const originalRefMax = r.lab_ref_max;

    // Converter valor
    r.value = applyFactor(r.value, factor);

    // Converter referências JUNTAS
    if (typeof r.lab_ref_min === "number") {
      r.lab_ref_min = applyFactor(r.lab_ref_min, factor);
    }
    if (typeof r.lab_ref_max === "number") {
      r.lab_ref_max = applyFactor(r.lab_ref_max, factor);
    }

    // Atualizar lab_ref_text se continha a unidade fonte
    if (r.lab_ref_text) {
      // Build a pattern to match the source unit in text
      const escaped = sourceUnit.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
      const pattern = new RegExp(escaped, "gi");
      if (pattern.test(r.lab_ref_text)) {
        r.lab_ref_text = r.lab_ref_text.replace(pattern, targetUnit);
      }
    }

    // Marcar como convertido (idempotência)
    r._converted = true;

    console.log(
      `[CONVERT] ${r.marker_id}: ${originalValue} ${sourceUnit} → ${r.value} ${targetUnit}` +
        (originalRefMin !== undefined || originalRefMax !== undefined
          ? ` | ref: [${originalRefMin ?? "—"}–${originalRefMax ?? "—"}] → [${r.lab_ref_min ?? "—"}–${r.lab_ref_max ?? "—"}]`
          : ""),
    );
  }

  return results;
}
