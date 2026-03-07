/**
 * analysisResponseV2.types.ts
 *
 * Contrato canônico para o relatório clínico IA v2.
 *
 * Princípios:
 *   1. Payload da IA = dados puros. Estado de revisão vive no frontend.
 *   2. Cada item tem proveniência (deterministic | llm | hybrid).
 *   3. Cross-specialty alerts sinalizam achados relevantes fora da especialidade ativa.
 *   4. Prescrição/protocolos = fase posterior (compat layer).
 *
 * Fases de implementação:
 *   A1: Edge Function retorna V2 em paralelo ao V1 (campo `analysis_v2`)
 *   A2: Frontend consome V2 com fallback para V1
 *   B:  Prescrição/protocolos migram para V2
 *   C:  V1 removido
 */

// ══════════════════════════════════════════════════════════════════════════════
// ENUMS & PRIMITIVOS
// ══════════════════════════════════════════════════════════════════════════════

/** Prioridade clínica do item */
export type ClinicalPriority = "critical" | "high" | "medium" | "low";

/** Nível de confiança da IA na sugestão */
export type ConfidenceLevel = "high" | "moderate" | "low";

/** Ação sugerida ao médico */
export type SuggestedActionType = "investigate" | "treat" | "monitor" | "refer";

/** Origem do dado/inferência */
export type SourceType = "deterministic" | "llm" | "hybrid";

/** Severidade de red flag */
export type RedFlagSeverity = "critical" | "high" | "moderate";

// ══════════════════════════════════════════════════════════════════════════════
// ITEM BASE — campos compartilhados por todos os itens estruturados
// ══════════════════════════════════════════════════════════════════════════════

export interface ClinicalItemBase {
  /** UUID gerado pela IA ou pelo pipeline determinístico */
  id: string;
  /** De onde veio este item */
  source_type: SourceType;
  /** Este item é relevante para a especialidade ativa? */
  specialty_relevant: boolean;
  /** Este item deveria alertar outra especialidade? */
  cross_specialty_alert: boolean;
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 1 — RED FLAGS
// ══════════════════════════════════════════════════════════════════════════════

export interface RedFlagItem extends ClinicalItemBase {
  /** Achado objetivo que gerou o alerta */
  finding: string;
  /** Severidade clínica */
  severity: RedFlagSeverity;
  /** Ação sugerida (ex: "Solicitar ecocardiograma de urgência") */
  suggested_action: string;
  /** Marcadores/dados que sustentam este red flag */
  evidence: string[];
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 2 — ACHADOS CLÍNICOS (agrupados por sistema/eixo)
// ══════════════════════════════════════════════════════════════════════════════

export interface ClinicalFindingItem extends ClinicalItemBase {
  /** Eixo clínico (ex: "metabolico", "tireoidiano", "hepatico") */
  system: string;
  /** Marcadores envolvidos neste achado */
  markers: string[];
  /** Interpretação clínica do conjunto de marcadores */
  interpretation: string;
  /** Prioridade para decisão médica */
  priority: ClinicalPriority;
  /** Nível de confiança da interpretação */
  confidence: ConfidenceLevel;
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 3 — HIPÓTESES DIAGNÓSTICAS
// ══════════════════════════════════════════════════════════════════════════════

export interface DiagnosticHypothesisItem extends ClinicalItemBase {
  /** Hipótese (ex: "Resistência insulínica em estágio inicial") */
  hypothesis: string;
  /** Achados que sustentam */
  supporting_findings: string[];
  /** Achados que enfraquecem */
  contradicting_findings?: string[];
  /** Exames confirmatórios sugeridos */
  confirmatory_exams?: string[];
  /** Probabilidade qualitativa */
  likelihood: "probable" | "possible" | "unlikely";
  /** Prioridade de investigação */
  priority: ClinicalPriority;
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 4 — AÇÕES SUGERIDAS (plano terapêutico + investigação)
// ══════════════════════════════════════════════════════════════════════════════

export interface SuggestedActionItem extends ClinicalItemBase {
  /** Categoria da ação */
  action_type: SuggestedActionType;
  /** Descrição da ação (ex: "Suplementar vitamina D 10.000 UI/dia por 8 semanas") */
  description: string;
  /** Justificativa clínica */
  rationale: string;
  /** Prioridade */
  priority: ClinicalPriority;
  /** Confiança */
  confidence: ConfidenceLevel;
  /** Categoria terapêutica quando action_type = "treat" */
  therapeutic_category?: "supplementation" | "medication" | "lifestyle" | "diet" | "referral";
}

// ══════════════════════════════════════════════════════════════════════════════
// BLOCO 5 — FOLLOW-UP
// ══════════════════════════════════════════════════════════════════════════════

export interface FollowUp {
  /** Exames sugeridos para próxima avaliação */
  suggested_exams: string[];
  /** Prazo sugerido para retorno (dias) */
  suggested_return_days?: number;
  /** Observações adicionais */
  notes?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// RESPONSE V2 — payload completo retornado pela IA
// ══════════════════════════════════════════════════════════════════════════════

export interface AnalysisResponseV2 {
  /** Sumário executivo em texto livre (1-3 parágrafos) */
  executive_summary: string;

  /** Alertas críticos que exigem ação imediata */
  red_flags: RedFlagItem[];

  /** Achados clínicos agrupados por sistema */
  clinical_findings: ClinicalFindingItem[];

  /** Hipóteses diagnósticas ordenadas por probabilidade */
  diagnostic_hypotheses: DiagnosticHypothesisItem[];

  /** Ações sugeridas (terapêuticas + investigativas) */
  suggested_actions: SuggestedActionItem[];

  /** Follow-up e próximos passos */
  follow_up?: FollowUp;

  /** Metadados do relatório */
  meta: AnalysisV2Meta;
}

export interface AnalysisV2Meta {
  /** Especialidade usada na análise */
  specialty_id: string;
  specialty_name: string;
  /** Modo de análise */
  mode: "full" | "analysis_only" | "protocols_only";
  /** Versão do formato */
  version: "v2";
  /** Modelo de IA utilizado */
  model_used?: string;
}

// ══════════════════════════════════════════════════════════════════════════════
// COMPAT LAYER — envelope que mantém V1 + V2 durante a migração
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Durante as Fases A1/A2, o response da Edge Function retorna:
 * {
 *   analysis: AnalysisResponse,       // V1 (existente, inalterado)
 *   analysis_v2?: AnalysisResponseV2, // V2 (novo, opcional)
 *   specialty_id, _truncated, _context_loaded, _diagnostics // existentes
 * }
 *
 * O frontend checa `analysis_v2` e renderiza o novo layout se presente,
 * com fallback para `analysis` (V1).
 */

// ══════════════════════════════════════════════════════════════════════════════
// MAPPER V1 → V2 — guia de mapeamento incremental
// ══════════════════════════════════════════════════════════════════════════════
//
// V1 field                → V2 field
// ─────────────────────────────────────────────────────────────────────────────
// summary                 → executive_summary (texto direto)
// patterns[]              → clinical_findings[].interpretation (1 pattern = 1 finding)
// trends[]                → clinical_findings[] com source_type="deterministic"
// suggestions[]           → suggested_actions[].description
// full_text               → NÃO migra (redundante no V2)
// technical_analysis      → Alimenta clinical_findings + diagnostic_hypotheses
// patient_plan            → Alimenta suggested_actions + follow_up
// prescription_table[]    → Fase B (compat layer separado)
// protocol_recommendations → Fase B (compat layer separado)
//
// ══════════════════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════════
// FASES DE IMPLEMENTAÇÃO
// ══════════════════════════════════════════════════════════════════════════════
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ FASE A1 — Edge Function (sem mudar frontend)                          │
// │                                                                        │
// │ 1. Importar AnalysisResponseV2 na Edge Function                       │
// │ 2. Criar função mapV1toV2(analysis: V1, context): V2                  │
// │    - Mapeia campos V1 para V2 usando tabela acima                     │
// │    - source_type = "llm" para tudo (saída da IA)                     │
// │    - specialty_relevant = true para tudo (mesma especialidade)        │
// │    - cross_specialty_alert = false (sem lógica cross ainda)           │
// │ 3. Retornar analysis_v2 no response em paralelo ao V1                │
// │ 4. Zero breaking changes                                              │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ FASE A2 — Frontend consome V2                                          │
// │                                                                        │
// │ 1. Criar ClinicalReportV2.tsx com os 5 blocos                         │
// │ 2. Estado de revisão do médico vive em useState local:                │
// │    Map<itemId, "accepted" | "edited" | "removed">                    │
// │ 3. Se analysis_v2 existe → renderiza V2, senão → V1 (fallback)      │
// │ 4. Salvar no patient_analyses com campo analysis_v2_json              │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ FASE B — Prescrição & Protocolos no V2                                │
// │                                                                        │
// │ 1. Adicionar prescription_table e protocols ao V2                     │
// │ 2. Migrar lógica de ACTIVE_THERAPEUTICS para suggested_actions        │
// │ 3. Remover compat layer V1                                            │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ FASE C — Enriquecer com dados determinísticos                         │
// │                                                                        │
// │ 1. Red flags determinísticos (valores críticos) com source_type       │
// │    = "deterministic", injetados ANTES da chamada IA                   │
// │ 2. Trends determinísticos do ClinicalContext.labs.trends              │
// │ 3. Cross-specialty alerts baseados em regras configuráveis            │
// └─────────────────────────────────────────────────────────────────────────┘
