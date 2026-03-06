/**
 * historicalTypes.ts
 *
 * Tipos e interfaces para extração de dados históricos/evolutivos de laudos.
 * Suporta: LAUDO EVOLUTIVO, Resultados Anteriores inline, tabelas multi-data.
 */

// ---------------------------------------------------------------------------
// Perfis de documento detectáveis
// ---------------------------------------------------------------------------

/** Tipo de bloco/página detectado no PDF */
export type DocumentProfileType =
  | "evolution_page"      // Página inteira de LAUDO EVOLUTIVO (Fleury, DASA)
  | "inline_history"      // "Resultados Anteriores" dentro de um exame atual
  | "multi_date_table"    // Tabela com múltiplas colunas de data
  | "current_result";     // Resultado atual padrão

/** Bloco detectado no PDF com seu perfil */
export interface DetectedBlock {
  /** Tipo do bloco */
  type: DocumentProfileType;
  /** Posição inicial no texto (char offset) */
  start: number;
  /** Posição final no texto (char offset) */
  end: number;
  /** Texto bruto do bloco */
  text: string;
  /** Datas encontradas no bloco (ISO format) */
  dates: string[];
}

// ---------------------------------------------------------------------------
// Histórico extraído
// ---------------------------------------------------------------------------

/** Uma entrada individual em uma série temporal */
export interface HistoricalEntry {
  /** Data do resultado (ISO: "2024-06-03") */
  date: string;

  // ── Valores normalizados (após pipeline: infer → convert → scale) ──
  /** Valor numérico normalizado (unidade canônica) */
  value?: number;
  /** Valor textual normalizado (operadores padronizados) */
  text_value?: string;
  /** Unidade canônica final (após conversão) */
  unit?: string;

  // ── Valores brutos (auditoria) ──
  /** Valor numérico original como extraído do PDF */
  raw_value?: number;
  /** Texto original como extraído do PDF */
  raw_text_value?: string;
  /** Unidade original como impressa no laudo */
  raw_unit?: string;
  /** Texto de referência original */
  raw_ref_text?: string;

  // ── Metadados de conversão ──
  /** Flag indicando se conversão de unidade foi aplicada */
  conversion_applied?: boolean;
  /** Razão/detalhes da conversão */
  conversion_reason?: string;

  // ── Classificação ──
  /** Flag de classificação em relação à referência */
  flag?: "normal" | "high" | "low" | null;

  // ── Proveniência ──
  /** Tipo de fonte que gerou esta entrada */
  source_type: DocumentProfileType;
  /** Laboratório de origem (se identificável) */
  source_lab?: string;
  /** Identificador do documento de origem */
  source_document?: string;
}

/** Série temporal de um marcador */
export interface HistoricalMarkerTimeline {
  /** ID canônico do marcador */
  marker_id: string;
  /** Nome legível do marcador */
  marker_name: string;
  /** Entradas ordenadas por data (mais recente primeiro) */
  entries: HistoricalEntry[];
  /** Texto da referência do laboratório */
  reference_text?: string;
}

// ---------------------------------------------------------------------------
// Output expandido do pipeline
// ---------------------------------------------------------------------------

/** Saída completa do pipeline de extração (dual output) */
export interface ExtractionOutput {
  /** Resultados atuais (pipeline completo aplicado) */
  currentResults: any[];
  /** Séries temporais históricas por marcador */
  historicalResults: HistoricalMarkerTimeline[];
  /** Data do exame atual */
  exam_date: string | null;
  /** Score de qualidade da extração */
  quality_score: number;
  /** Problemas detectados */
  issues: any[];
}
