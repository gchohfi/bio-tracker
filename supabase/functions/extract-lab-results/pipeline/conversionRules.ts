/**
 * conversionRules.ts
 *
 * Fonte ÚNICA de verdade para regras de conversão de unidade.
 * Formato serializável (sem RegExp) para ser compartilhável entre:
 *   - Edge functions (Deno)
 *   - Testes de regressão (Vitest/Node)
 *
 * Cada regra define:
 *   - from_unit_pattern: string que será compilada em RegExp case-insensitive
 *   - from_unit_label: nome legível
 *   - to_unit: unidade alvo canônica
 *   - factor: multiplicador (valor_destino = valor_origem × factor)
 *
 * ADICIONAR NOVAS REGRAS APENAS AQUI.
 * Os módulos unitInference.ts e convert.ts devem importar deste arquivo.
 */

import { resolveMarkerId } from "./markerAliases.ts";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface ConversionRuleDef {
  /** Regex source string para detectar a unidade fonte (compilado com flag "i") */
  from_unit_pattern: string;
  /** Nome legível da unidade fonte */
  from_unit_label: string;
  /** Unidade alvo canônica */
  to_unit: string;
  /** Fator de multiplicação: valor_destino = valor_origem × factor */
  factor: number;
  /** Descrição legível da conversão */
  description: string;
}

// ---------------------------------------------------------------------------
// Tabela central de regras (usa IDs canônicos — resolve via markerAliases)
// ---------------------------------------------------------------------------

/**
 * Regras de conversão indexadas por marker_id CANÔNICO.
 * Use getConversionRules() para buscar regras com resolução de alias.
 */
export const CONVERSION_RULES: Record<string, ConversionRuleDef[]> = {
  estradiol: [
    {
      from_unit_pattern: "ng\\/d",
      from_unit_label: "ng/dL",
      to_unit: "pg/mL",
      factor: 10,
      description: "Estradiol ng/dL → pg/mL (×10)",
    },
    {
      from_unit_pattern: "pmol",
      from_unit_label: "pmol/L",
      to_unit: "pg/mL",
      factor: 0.2724,
      description: "Estradiol pmol/L → pg/mL (÷3.671)",
    },
  ],

  progesterona: [
    {
      from_unit_pattern: "ng\\/d",
      from_unit_label: "ng/dL",
      to_unit: "ng/mL",
      factor: 0.01,
      description: "Progesterona ng/dL → ng/mL (÷100)",
    },
    {
      from_unit_pattern: "nmol",
      from_unit_label: "nmol/L",
      to_unit: "ng/mL",
      factor: 0.3145,
      description: "Progesterona nmol/L → ng/mL (÷3.18)",
    },
  ],

  dihidrotestosterona: [
    {
      from_unit_pattern: "pg\\/m",
      from_unit_label: "pg/mL",
      to_unit: "ng/dL",
      factor: 0.1,
      description: "DHT pg/mL → ng/dL (÷10)",
    },
  ],

  testosterona_livre: [
    {
      from_unit_pattern: "pmol",
      from_unit_label: "pmol/L",
      to_unit: "ng/dL",
      factor: 1 / 34.7,
      description: "Testosterona Livre pmol/L → ng/dL (÷34.7)",
    },
    {
      from_unit_pattern: "pg\\/m",
      from_unit_label: "pg/mL",
      to_unit: "ng/dL",
      factor: 0.001,
      description: "Testosterona Livre pg/mL → ng/dL (÷1000)",
    },
  ],

  t3_livre: [
    {
      from_unit_pattern: "ng\\/d",
      from_unit_label: "ng/dL",
      to_unit: "pg/mL",
      factor: 10,
      description: "T3 Livre ng/dL → pg/mL (×10)",
    },
    {
      from_unit_pattern: "pmol",
      from_unit_label: "pmol/L",
      to_unit: "pg/mL",
      factor: 1 / 15.36,
      description: "T3 Livre pmol/L → pg/mL (÷15.36)",
    },
  ],

  t3_reverso: [
    {
      from_unit_pattern: "ng\\/m[lL]",
      from_unit_label: "ng/mL",
      to_unit: "ng/dL",
      factor: 100,
      description: "T3 Reverso ng/mL → ng/dL (×100)",
    },
  ],

  zinco: [
    {
      from_unit_pattern: "[uµ]g\\/m[lL]",
      from_unit_label: "µg/mL",
      to_unit: "µg/dL",
      factor: 100,
      description: "Zinco µg/mL → µg/dL (×100)",
    },
    {
      from_unit_pattern: "mg\\/[lL]",
      from_unit_label: "mg/L",
      to_unit: "µg/dL",
      factor: 100,
      description: "Zinco mg/L → µg/dL (×100)",
    },
  ],

  pcr: [
    {
      from_unit_pattern: "mg\\/d",
      from_unit_label: "mg/dL",
      to_unit: "mg/L",
      factor: 10,
      description: "PCR mg/dL → mg/L (×10)",
    },
  ],

  igfbp3: [
    {
      from_unit_pattern: "ng\\/m",
      from_unit_label: "ng/mL",
      to_unit: "µg/mL",
      factor: 0.001,
      description: "IGFBP-3 ng/mL → µg/mL (÷1000)",
    },
  ],

  magnesio: [
    {
      from_unit_pattern: "mmol",
      from_unit_label: "mmol/L",
      to_unit: "mg/dL",
      factor: 2.4305,
      description: "Magnésio mmol/L → mg/dL (×2.4305)",
    },
    {
      from_unit_pattern: "mEq",
      from_unit_label: "mEq/L",
      to_unit: "mg/dL",
      factor: 1.2153,
      description: "Magnésio mEq/L → mg/dL (×1.2153)",
    },
  ],

  vitamina_d: [
    {
      from_unit_pattern: "nmol",
      from_unit_label: "nmol/L",
      to_unit: "ng/mL",
      factor: 0.4006,
      description: "Vitamina D nmol/L → ng/mL (÷2.496)",
    },
  ],

  urina_albumina: [
    {
      from_unit_pattern: "g\\/L",
      from_unit_label: "g/L",
      to_unit: "mg/L",
      factor: 1000,
      description: "Albumina urinária g/L → mg/L (×1000)",
    },
  ],

  calcio_ionico: [
    {
      from_unit_pattern: "mg\\/d",
      from_unit_label: "mg/dL",
      to_unit: "mmol/L",
      factor: 0.2495,
      description: "Cálcio Iônico mg/dL → mmol/L (÷4.008)",
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Busca regras de conversão para um marker_id, resolvendo aliases.
 * Uso: getConversionRules("dht") → regras de "dihidrotestosterona"
 */
export function getConversionRules(markerId: string): ConversionRuleDef[] | undefined {
  const canonical = resolveMarkerId(markerId);
  return CONVERSION_RULES[canonical];
}

/**
 * Compila uma ConversionRuleDef em RegExp para matching.
 */
export function compilePattern(rule: ConversionRuleDef): RegExp {
  return new RegExp(rule.from_unit_pattern, "i");
}

/**
 * Encontra a regra que casa com uma string de unidade.
 */
export function findMatchingRule(
  markerId: string,
  unitString: string
): ConversionRuleDef | undefined {
  const rules = getConversionRules(markerId);
  if (!rules) return undefined;
  return rules.find((r) => compilePattern(r).test(unitString));
}
