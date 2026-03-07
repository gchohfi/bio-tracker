/**
 * buildV2.ts
 *
 * Constrói AnalysisResponseV2 a partir de:
 *   1. Dados determinísticos (ClinicalContext) → red_flags, clinical_findings
 *   2. Saída V1 do LLM → executive_summary, hypotheses, actions, follow_up
 *
 * Nenhuma chamada de rede. Puro mapeamento.
 */

import type { ClinicalContext, CanonicalLabResult, LabTrend } from "./clinicalContext.types.ts";
import type {
  AnalysisResponseV2,
  RedFlagItem,
  ClinicalFindingItem,
  DiagnosticHypothesisItem,
  SuggestedActionItem,
  FollowUp,
  ClinicalPriority,
  RedFlagSeverity,
} from "./analysisResponseV2.types.ts";

// ══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════════════════════

let _counter = 0;
function uid(): string {
  return "v2_" + Date.now().toString(36) + "_" + (++_counter).toString(36);
}

// ══════════════════════════════════════════════════════════════════════════════
// BUILDER 1: RED FLAGS (determinístico)
// Valores critical_low / critical_high → red flag automático
// ══════════════════════════════════════════════════════════════════════════════

const CRITICAL_ACTION_MAP: Record<string, string> = {
  glicose_jejum: "Avaliar emergência glicêmica. Considerar HbA1c e insulina se não disponíveis.",
  potassio: "Risco de arritmia. Considerar ECG e monitorização.",
  sodio: "Avaliar hidratação e função renal. Risco de alteração neurológica.",
  calcio_total: "Risco de arritmia ou tetania. Avaliar PTH e vitamina D.",
  hemoglobina: "Avaliar necessidade de transfusão ou investigação de causa.",
  plaquetas: "Risco hemorrágico ou trombótico. Avaliar esfregaço periférico.",
  creatinina: "Avaliar função renal. Considerar clearance de creatinina.",
  tsh: "Avaliar função tireoidiana. Considerar T3/T4 livre.",
  troponina: "Risco de evento coronariano agudo. Avaliar ECG e enzimas cardíacas.",
  pcr: "Processo inflamatório significativo. Investigar causa.",
};

export function buildDeterministicRedFlags(ctx: ClinicalContext): RedFlagItem[] {
  const flags: RedFlagItem[] = [];

  for (const r of ctx.labs.outOfRange) {
    if (r.status !== "critical_low" && r.status !== "critical_high") continue;

    const severity: RedFlagSeverity = "critical";
    const direction = r.status === "critical_high" ? "criticamente elevado" : "criticamente baixo";
    const valueStr = r.value !== null ? `${r.value} ${r.unit}` : r.text_value ?? "—";

    const evidence: string[] = [
      `${r.marker_name}: ${valueStr} (${direction})`,
    ];
    if (r.lab_ref_min !== undefined && r.lab_ref_max !== undefined) {
      evidence.push(`Referência: ${r.lab_ref_min}–${r.lab_ref_max} ${r.unit}`);
    }

    const defaultAction = "Avaliar clinicamente e considerar investigação complementar.";
    const suggestedAction = CRITICAL_ACTION_MAP[r.marker_id] ?? defaultAction;

    flags.push({
      id: uid(),
      source_type: "deterministic",
      specialty_relevant: true,
      cross_specialty_alert: true, // valores críticos alertam todas as especialidades
      finding: `${r.marker_name} ${direction}: ${valueStr}`,
      severity,
      suggested_action: suggestedAction,
      evidence,
    });
  }

  return flags;
}

// ══════════════════════════════════════════════════════════════════════════════
// BUILDER 2: CLINICAL FINDINGS (determinístico)
// Agrupa marcadores fora da faixa por sistema/eixo clínico
// ══════════════════════════════════════════════════════════════════════════════

/** Mapa marker_id → sistema clínico */
const MARKER_SYSTEM_MAP: Record<string, string> = {
  // Metabólico
  glicose_jejum: "metabolico", insulina_jejum: "metabolico", homa_ir: "metabolico",
  hba1c: "metabolico", glicemia_media_estimada: "metabolico",
  // Lipídico
  colesterol_total: "lipidico", hdl: "lipidico", ldl: "lipidico",
  triglicerides: "lipidico", vldl: "lipidico", colesterol_nao_hdl: "lipidico",
  relacao_ct_hdl: "lipidico", relacao_tg_hdl: "lipidico",
  apolipoproteina_b: "lipidico", apolipoproteina_a1: "lipidico",
  // Tireoidiano
  tsh: "tireoidiano", t4_livre: "tireoidiano", t3_livre: "tireoidiano",
  t3_total: "tireoidiano", t4_total: "tireoidiano",
  anti_tpo: "tireoidiano", anti_tg: "tireoidiano",
  // Hepático
  tgo_ast: "hepatico", tgp_alt: "hepatico", ggt: "hepatico",
  fosfatase_alcalina: "hepatico", bilirrubina_total: "hepatico",
  bilirrubina_direta: "hepatico", bilirrubina_indireta: "hepatico",
  albumina: "hepatico", proteina_total: "hepatico",
  // Renal
  creatinina: "renal", ureia: "renal", acido_urico: "renal",
  cistatina_c: "renal", microalbuminuria: "renal",
  // Hematológico
  hemoglobina: "hematologico", hematocrito: "hematologico",
  eritrocitos: "hematologico", vcm: "hematologico", hcm: "hematologico",
  chcm: "hematologico", rdw: "hematologico",
  leucocitos: "hematologico", plaquetas: "hematologico",
  neutrofilos: "hematologico", linfocitos: "hematologico",
  // Inflamatório
  pcr: "inflamatorio", vhs: "inflamatorio", ferritina: "inflamatorio",
  homocisteina: "inflamatorio",
  // Hormonal
  testosterona_total: "hormonal", testosterona_livre: "hormonal",
  estradiol: "hormonal", progesterona: "hormonal",
  cortisol: "hormonal", dhea_s: "hormonal",
  lh: "hormonal", fsh: "hormonal", prolactina: "hormonal",
  igf1: "hormonal", shbg: "hormonal",
  androstenediona: "hormonal", dht: "hormonal",
  // Vitaminas e minerais
  vitamina_d: "nutricional", vitamina_b12: "nutricional",
  acido_folico: "nutricional", ferro_serico: "nutricional",
  zinco: "nutricional", magnesio: "nutricional", selenio: "nutricional",
  calcio_total: "nutricional", calcio_ionico: "nutricional",
  cobre: "nutricional", cromio: "nutricional",
  // Pancreático / Digestivo
  amilase: "pancreatico", lipase: "pancreatico",
  // Hemograma complementar
  basofilos: "hematologico", basofilos_abs: "hematologico",
  eosinofilos: "hematologico", eosinofilos_abs: "hematologico",
  monocitos: "hematologico", monocitos_abs: "hematologico",
  neutrofilos_abs: "hematologico", linfocitos_abs: "hematologico",
  bastonetes: "hematologico",
};

const SYSTEM_LABELS: Record<string, string> = {
  metabolico: "Metabolismo Glicídico",
  lipidico: "Perfil Lipídico",
  tireoidiano: "Função Tireoidiana",
  hepatico: "Função Hepática",
  renal: "Função Renal",
  hematologico: "Hemograma",
  inflamatorio: "Marcadores Inflamatórios",
  hormonal: "Painel Hormonal",
  nutricional: "Vitaminas e Minerais",
  pancreatico: "Função Pancreática",
  outros: "Outros",
};

function priorityFromStatus(status: string): ClinicalPriority {
  if (status === "critical_low" || status === "critical_high") return "critical";
  return "high";
}

export function buildDeterministicFindings(ctx: ClinicalContext): ClinicalFindingItem[] {
  const grouped: Record<string, CanonicalLabResult[]> = {};

  for (const r of ctx.labs.outOfRange) {
    const system = MARKER_SYSTEM_MAP[r.marker_id] ?? "outros";
    if (!grouped[system]) grouped[system] = [];
    grouped[system].push(r);
  }

  const findings: ClinicalFindingItem[] = [];

  for (const [system, markers] of Object.entries(grouped)) {
    // Determine priority: highest severity in the group
    const hasCritical = markers.some(m => m.status === "critical_low" || m.status === "critical_high");
    const priority: ClinicalPriority = hasCritical ? "critical" : "high";

    const markerDescriptions = markers.map(m => {
      const dir = m.status === "high" || m.status === "critical_high" ? "↑" : "↓";
      const val = m.value !== null ? `${m.value} ${m.unit}` : m.text_value ?? "—";
      return `${m.marker_name} ${dir} (${val})`;
    });

    findings.push({
      id: uid(),
      source_type: "deterministic",
      specialty_relevant: true,
      cross_specialty_alert: false,
      system: SYSTEM_LABELS[system] ?? system,
      markers: markers.map(m => m.marker_id),
      interpretation: `Marcadores alterados: ${markerDescriptions.join("; ")}`,
      priority,
      confidence: "high", // dados laboratoriais objetivos
    });
  }

  // Add trend-based findings
  if (ctx.labs.trends && ctx.labs.trends.length > 0) {
    const worseningTrends = ctx.labs.trends.filter(t => {
      // Markers where "up" is bad
      const upIsBad = ["glicose_jejum", "insulina_jejum", "homa_ir", "hba1c", "pcr", "vhs",
        "homocisteina", "tgo_ast", "tgp_alt", "ggt", "creatinina", "ureia",
        "triglicerides", "ldl", "colesterol_total", "cortisol", "tsh"];
      // Markers where "down" is bad
      const downIsBad = ["hdl", "vitamina_d", "vitamina_b12", "ferritina", "hemoglobina",
        "t3_livre", "t4_livre", "testosterona_total", "igf1"];

      if (t.direction === "up" && upIsBad.includes(t.marker_id) && Math.abs(t.delta_percent) > 10) return true;
      if (t.direction === "down" && downIsBad.includes(t.marker_id) && Math.abs(t.delta_percent) > 10) return true;
      return false;
    });

    if (worseningTrends.length > 0) {
      findings.push({
        id: uid(),
        source_type: "deterministic",
        specialty_relevant: true,
        cross_specialty_alert: false,
        system: "Tendências Desfavoráveis",
        markers: worseningTrends.map(t => t.marker_id),
        interpretation: worseningTrends.map(t => {
          const dir = t.direction === "up" ? "↑" : "↓";
          return `${t.marker_name}: ${t.first_value} → ${t.last_value} (${dir}${Math.abs(t.delta_percent)}%)`;
        }).join("; "),
        priority: "medium",
        confidence: "high",
      });
    }
  }

  // Sort: critical first, then high, then medium
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3));

  return findings;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAPPER V1 → V2 (campos do LLM)
// ══════════════════════════════════════════════════════════════════════════════

interface V1DiagnosticHypothesis {
  hypothesis?: string;
  supporting_findings?: string[];
  contradicting_findings?: string[];
  confirmatory_exams?: string[];
  likelihood?: "probable" | "possible" | "unlikely";
  priority?: string;
}

interface V1FollowUp {
  suggested_exams?: string[];
  suggested_return_days?: number;
  notes?: string;
}

interface AnalysisV1 {
  summary?: string;
  patterns?: string[];
  trends?: string[];
  suggestions?: string[];
  full_text?: string;
  technical_analysis?: string;
  patient_plan?: string;
  prescription_table?: unknown[];
  protocol_recommendations?: unknown[];
  diagnostic_hypotheses?: V1DiagnosticHypothesis[];
  follow_up?: V1FollowUp;
}

export function mapV1toV2(
  v1: AnalysisV1,
  ctx: ClinicalContext,
  specialtyId: string,
  specialtyName: string,
  mode: "full" | "analysis_only" | "protocols_only",
  modelUsed?: string,
): AnalysisResponseV2 {
  // 1. Red flags: determinísticos + patterns do LLM que parecem alertas
  const deterministicRedFlags = buildDeterministicRedFlags(ctx);
  const llmRedFlags: RedFlagItem[] = [];
  // Patterns que contêm palavras de alerta → promover a red_flag
  const alertWords = ["urgente", "crítico", "emergência", "imediato", "grave", "atenção especial"];
  for (const pattern of v1.patterns ?? []) {
    const isAlert = alertWords.some(w => pattern.toLowerCase().includes(w));
    if (isAlert) {
      llmRedFlags.push({
        id: uid(),
        source_type: "llm",
        specialty_relevant: true,
        cross_specialty_alert: false,
        finding: pattern,
        severity: "high",
        suggested_action: "Avaliar clinicamente.",
        evidence: [],
      });
    }
  }

  // 2. Clinical findings: determinísticos + patterns restantes do LLM (deduplicados)
  const deterministicFindings = buildDeterministicFindings(ctx);
  const usedAsRedFlag = new Set(llmRedFlags.map(r => r.finding));

  // Build set of deterministic marker_ids para deduplicação
  const deterministicMarkerIds = new Set<string>();
  for (const f of deterministicFindings) {
    for (const m of f.markers) deterministicMarkerIds.add(m);
  }

  // Deduplica: se o pattern LLM menciona um marker_id já coberto deterministicamente, filtra
  const llmFindings: ClinicalFindingItem[] = (v1.patterns ?? [])
    .filter(p => !usedAsRedFlag.has(p))
    .filter(p => {
      // Se o pattern é basicamente uma repetição de um achado determinístico, pular
      const pLower = p.toLowerCase();
      const isDuplicate = deterministicFindings.some(df =>
        df.markers.some(m => pLower.includes(m.replace(/_/g, " "))) &&
        (pLower.includes("elevad") || pLower.includes("baixo") || pLower.includes("alto") || pLower.includes("reduzid"))
      );
      return !isDuplicate;
    })
    .map(p => ({
      id: uid(),
      source_type: "llm" as const,
      specialty_relevant: true,
      cross_specialty_alert: false,
      system: "Padrões Identificados (IA)",
      markers: [],
      interpretation: p,
      priority: "medium" as ClinicalPriority,
      confidence: "moderate" as const,
    }));

  // 3. Diagnostic hypotheses: usar campo nativo da IA se disponível, fallback para placeholder
  let hypotheses: DiagnosticHypothesisItem[] = [];
  if (v1.diagnostic_hypotheses && Array.isArray(v1.diagnostic_hypotheses) && v1.diagnostic_hypotheses.length > 0) {
    hypotheses = v1.diagnostic_hypotheses.map(h => ({
      id: uid(),
      source_type: "llm" as const,
      specialty_relevant: true,
      cross_specialty_alert: false,
      hypothesis: h.hypothesis ?? "Hipótese não especificada",
      supporting_findings: h.supporting_findings ?? [],
      contradicting_findings: h.contradicting_findings,
      confirmatory_exams: h.confirmatory_exams,
      likelihood: (h.likelihood as "probable" | "possible" | "unlikely") ?? "possible",
      priority: (h.priority as ClinicalPriority) ?? "medium",
    }));
  } else if (v1.technical_analysis && v1.technical_analysis.length > 50) {
    // Fallback: hipótese-resumo genérica (backward compat)
    hypotheses.push({
      id: uid(),
      source_type: "llm",
      specialty_relevant: true,
      cross_specialty_alert: false,
      hypothesis: "Análise técnica completa disponível",
      supporting_findings: (v1.patterns ?? []).slice(0, 3),
      likelihood: "probable",
      priority: "medium",
    });
  }

  // 4. Suggested actions: suggestions do V1 + patient_plan
  const investigateKeywords = ["solicitar", "exame", "investigar", "investigação", "dosar", "avaliar", "descartar"];
  const treatKeywords = ["suplementar", "suplementação", "prescrever", "tratar", "iniciar"];
  const referKeywords = ["encaminhar", "referir", "especialista"];

  function classifyAction(text: string): "investigate" | "treat" | "monitor" | "refer" {
    const lower = text.toLowerCase();
    if (referKeywords.some(k => lower.includes(k))) return "refer";
    if (investigateKeywords.some(k => lower.includes(k))) return "investigate";
    if (treatKeywords.some(k => lower.includes(k))) return "treat";
    return "monitor";
  }

  const actions: SuggestedActionItem[] = (v1.suggestions ?? []).map(s => ({
    id: uid(),
    source_type: "llm" as const,
    specialty_relevant: true,
    cross_specialty_alert: false,
    action_type: classifyAction(s),
    description: s,
    rationale: "Sugestão da análise clínica.",
    priority: "medium" as ClinicalPriority,
    confidence: "moderate" as const,
  }));

  // 5. Follow-up: usar campo nativo da IA se disponível, fallback para extração de suggestions
  let followUp: FollowUp | undefined;
  if (v1.follow_up && typeof v1.follow_up === "object") {
    const fu = v1.follow_up;
    followUp = {
      suggested_exams: fu.suggested_exams ?? [],
      suggested_return_days: fu.suggested_return_days,
      notes: fu.notes,
    };
  } else {
    // Fallback: extrair de suggestions
    const examSuggestions = (v1.suggestions ?? []).filter(s =>
      s.toLowerCase().includes("exame") || s.toLowerCase().includes("solicitar") ||
      s.toLowerCase().includes("dosar") || s.toLowerCase().includes("repetir")
    );
    followUp = examSuggestions.length > 0
      ? { suggested_exams: examSuggestions }
      : undefined;
  }

  return {
    executive_summary: v1.summary ?? "",
    red_flags: [...deterministicRedFlags, ...llmRedFlags],
    clinical_findings: [...deterministicFindings, ...llmFindings],
    diagnostic_hypotheses: hypotheses,
    suggested_actions: actions,
    follow_up: followUp,
    meta: {
      specialty_id: specialtyId,
      specialty_name: specialtyName,
      mode,
      version: "v2",
      model_used: modelUsed,
    },
  };
}
