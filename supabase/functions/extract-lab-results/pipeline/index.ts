/**
 * pipeline/index.ts
 *
 * Ponto de entrada do novo pipeline de importação de exames.
 * Conecta todas as etapas em sequência:
 *
 *   extract → normalize → infer_unit → convert → validate → persist
 *
 * Este módulo expõe a função principal `runPipeline` que substitui
 * a sequência atual de chamadas no index.ts da edge function.
 */

export * from "./types.ts";
export * from "./normalize.ts";
export * from "./infer_unit.ts";
export * from "./convert.ts";
export * from "./validate.ts";
export * from "./markerAliases.ts";
export * from "./conversionRules.ts";

import type { RawExamResult, PersistedExamResult, PipelineContext } from "./types.ts";
import { normalizeResults } from "./normalize.ts";
import { inferUnits } from "./infer_unit.ts";
import { convertResults } from "./convert.ts";
import { validateResults } from "./validate.ts";

/**
 * Executa o pipeline completo de processamento de exames.
 *
 * @param rawResults - Resultados brutos da IA
 * @param context - Contexto do pipeline (sexo do paciente, texto do PDF, etc.)
 * @returns Array de resultados prontos para persistência
 */
export function runPipeline(
  rawResults: RawExamResult[],
  context: PipelineContext = {}
): PersistedExamResult[] {
  if (context.debug) {
    console.log(`[pipeline] Iniciando com ${rawResults.length} resultados brutos`);
  }

  // Etapa 1: Normalização
  const normalized = normalizeResults(rawResults);
  if (context.debug) {
    console.log(`[pipeline] Normalização: ${normalized.length} resultados normalizados`);
  }

  // Etapa 2: Inferência de unidade
  const unitInferences = inferUnits(normalized);
  if (context.debug) {
    let conversionsNeeded = 0;
    unitInferences.forEach((inf) => { if (inf.needs_conversion) conversionsNeeded++; });
    console.log(`[pipeline] Inferência: ${conversionsNeeded} conversões necessárias`);
  }

  // Etapa 3: Conversão centralizada
  const converted = convertResults(normalized, unitInferences);
  if (context.debug) {
    const applied = converted.filter((c) => c.metadata.conversion_applied).length;
    console.log(`[pipeline] Conversão: ${applied} conversões aplicadas`);
  }

  // Etapa 4: Validação e cálculo de status
  const validated = validateResults(converted);
  if (context.debug) {
    const invalid = validated.filter((r) => r.validation?.is_valid === false).length;
    const outOfRange = validated.filter((r) => r.status === "low" || r.status === "high").length;
    console.log(`[pipeline] Validação: ${invalid} inválidos, ${outOfRange} fora da faixa`);
  }

  return validated;
}
