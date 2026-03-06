/**
 * convert.ts
 *
 * Camada de conversão centralizada de unidades.
 * SOMENTE conversões de unidade vivem aqui — NÃO ajustes de escala, NÃO derivados.
 *
 * Regras:
 * 1. Tabela declarativa única — toda conversão é definida em UNIT_CONVERSIONS
 * 2. Valor e referência são convertidos JUNTOS (mesmo fator, mesma chamada)
 * 3. Idempotente: marca `_converted` no resultado; se já marcado, pula
 * 4. Só converte quando a unidade fonte foi inferida (por unit_raw ou heurística)
 * 5. Log explícito: "[CONVERT] marker: value from→to, unit from→to"
 */

// ---------------------------------------------------------------------------
// Tabela declarativa de conversões
// ---------------------------------------------------------------------------

interface ConversionRule {
  /** Regex para detectar a unidade fonte (case-insensitive) */
  from_unit_pattern: RegExp;
  /** Nome legível da unidade fonte */
  from_unit_label: string;
  /** Unidade alvo canônica */
  to_unit: string;
  /** Fator de multiplicação: valor_destino = valor_origem × factor */
  factor: number;
  /** Heurística de valor: se unit_raw ausente, aplica se valor satisfaz esta condição */
  value_heuristic?: (v: number) => boolean;
}

/**
 * Tabela de conversão por marker_id.
 * A primeira regra que casa (por unit_raw ou heurística) é aplicada.
 * ADICIONAR NOVAS CONVERSÕES APENAS AQUI.
 */
export const UNIT_CONVERSIONS: Record<string, ConversionRule[]> = {
  t3_livre: [
    {
      from_unit_pattern: /ng\/d/i,
      from_unit_label: "ng/dL",
      to_unit: "pg/mL",
      factor: 10,
      value_heuristic: (v) => v < 1.0, // ng/dL values are typically < 1
    },
    {
      from_unit_pattern: /pmol/i,
      from_unit_label: "pmol/L",
      to_unit: "pg/mL",
      factor: 1 / 15.36,
      value_heuristic: (v) => v > 10, // pmol/L values are typically > 10
    },
  ],

  estradiol: [
    {
      from_unit_pattern: /ng\/d/i,
      from_unit_label: "ng/dL",
      to_unit: "pg/mL",
      factor: 10,
      value_heuristic: (v) => v < 1, // ng/dL estradiol is typically < 1
    },
    {
      from_unit_pattern: /pmol/i,
      from_unit_label: "pmol/L",
      to_unit: "pg/mL",
      factor: 0.2724,
    },
  ],

  zinco: [
    {
      from_unit_pattern: /[uµ]g\/m[lL]/i,
      from_unit_label: "µg/mL",
      to_unit: "µg/dL",
      factor: 100,
      value_heuristic: (v) => v < 10, // µg/mL values are typically < 10
    },
    {
      from_unit_pattern: /mg\/[lL]/i,
      from_unit_label: "mg/L",
      to_unit: "µg/dL",
      factor: 100,
    },
  ],

  testosterona_livre: [
    {
      from_unit_pattern: /pmol/i,
      from_unit_label: "pmol/L",
      to_unit: "ng/dL",
      factor: 1 / 34.7,
      value_heuristic: (v) => v > 100, // pmol/L values are typically > 100
    },
    {
      from_unit_pattern: /pg\/m/i,
      from_unit_label: "pg/mL",
      to_unit: "ng/dL",
      factor: 0.001,
    },
  ],

  pcr: [
    {
      from_unit_pattern: /mg\/d/i,
      from_unit_label: "mg/dL",
      to_unit: "mg/L",
      factor: 10,
      // PCR heuristic: if value < 0.5 and ref_max ≤ 1 → likely mg/dL
      value_heuristic: (v) => v > 0 && v < 0.5,
    },
  ],

  igfbp3: [
    {
      from_unit_pattern: /ng\/m/i,
      from_unit_label: "ng/mL",
      to_unit: "µg/mL",
      factor: 0.001,
      value_heuristic: (v) => v > 100, // ng/mL values are in thousands
    },
  ],

  magnesio: [
    {
      from_unit_pattern: /mmol/i,
      from_unit_label: "mmol/L",
      to_unit: "mg/dL",
      factor: 2.4305,
    },
    {
      from_unit_pattern: /mEq/i,
      from_unit_label: "mEq/L",
      to_unit: "mg/dL",
      factor: 1.2153,
    },
  ],

  vitamina_d: [
    {
      from_unit_pattern: /nmol/i,
      from_unit_label: "nmol/L",
      to_unit: "ng/mL",
      factor: 0.4006,
    },
  ],
};

// ---------------------------------------------------------------------------
// Funções internas
// ---------------------------------------------------------------------------

function applyFactor(value: number, factor: number): number {
  return Math.round(value * factor * 10000) / 10000;
}

/**
 * Encontra a regra de conversão aplicável para um resultado.
 * Prioridade: unit_raw match > value heuristic > null (sem conversão)
 */
function findApplicableRule(
  markerId: string,
  unitRaw: string | undefined,
  value: number | undefined,
  labRefText: string | undefined,
): ConversionRule | null {
  const rules = UNIT_CONVERSIONS[markerId];
  if (!rules) return null;

  // Prioridade 1: match por unit_raw
  if (unitRaw) {
    const matched = rules.find((r) => r.from_unit_pattern.test(unitRaw));
    if (matched) return matched;
  }

  // Prioridade 1b: match por lab_ref_text (unit embedded in reference)
  if (labRefText) {
    const matched = rules.find((r) => r.from_unit_pattern.test(labRefText));
    if (matched) return matched;
  }

  // Prioridade 2: heurística de valor (apenas se unit_raw ausente ou não reconhecido)
  if (value !== undefined) {
    const matched = rules.find((r) => r.value_heuristic?.(value));
    if (matched) return matched;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Função principal — opera sobre o formato legado any[]
// ---------------------------------------------------------------------------

/**
 * Aplica conversões de unidade centralizadas a um array de resultados.
 * Opera in-place sobre os resultados (formato legado any[]).
 *
 * Converte valor E referência JUNTOS. Marca _converted para idempotência.
 */
export function applyUnitConversions(results: any[]): any[] {
  for (const r of results) {
    // Idempotência: se já convertido, pular
    if (r._converted) continue;

    // Sem valor numérico: pular
    if (typeof r.value !== "number") continue;

    const rule = findApplicableRule(
      r.marker_id,
      r.unit,
      r.value,
      r.lab_ref_text,
    );
    if (!rule) continue;

    const originalValue = r.value;
    const originalRefMin = r.lab_ref_min;
    const originalRefMax = r.lab_ref_max;

    // Converter valor
    r.value = applyFactor(r.value, rule.factor);

    // Converter referências JUNTAS
    if (typeof r.lab_ref_min === "number") {
      r.lab_ref_min = applyFactor(r.lab_ref_min, rule.factor);
    }
    if (typeof r.lab_ref_max === "number") {
      r.lab_ref_max = applyFactor(r.lab_ref_max, rule.factor);
    }

    // Atualizar lab_ref_text se continha a unidade fonte
    if (r.lab_ref_text && rule.from_unit_pattern.test(r.lab_ref_text)) {
      r.lab_ref_text = r.lab_ref_text.replace(
        rule.from_unit_pattern,
        rule.to_unit,
      );
    }

    // Marcar como convertido (idempotência)
    r._converted = true;

    console.log(
      `[CONVERT] ${r.marker_id}: ${originalValue} ${rule.from_unit_label} → ${r.value} ${rule.to_unit}` +
        (originalRefMin !== undefined || originalRefMax !== undefined
          ? ` | ref: [${originalRefMin ?? "—"}–${originalRefMax ?? "—"}] → [${r.lab_ref_min ?? "—"}–${r.lab_ref_max ?? "—"}]`
          : ""),
    );
  }

  return results;
}
