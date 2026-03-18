/**
 * promptBuilder.ts
 *
 * Composes the user prompt from clinical context, scored actives, and matched protocols.
 * Pure string building — no network calls.
 */

import type { AnalysisRequest, EncounterContext } from "./types.ts";
import type { ScoredActive } from "./therapeutics.ts";
import type { EssentiaProtocol } from "./therapeutics.ts";
import type { ClinicalContext, CanonicalLabResult } from "./clinicalContext.types.ts";

// ══════════════════════════════════════════════════════════════════════════════
// HELPER: format a lab result line
// ══════════════════════════════════════════════════════════════════════════════

function formatLabLine(r: CanonicalLabResult, useFunctionalRefs: boolean, includeStatus: boolean): string {
  const valueStr = r.value !== null ? r.value + " " + r.unit : r.text_value ?? "--";
  const labRefStr = r.lab_ref_min !== undefined && r.lab_ref_max !== undefined
    ? "(ref. lab: " + r.lab_ref_min + "-" + r.lab_ref_max + " " + r.unit + ")"
    : "";
  const funcRefStr = useFunctionalRefs && r.functional_min !== undefined && r.functional_max !== undefined
    ? "[faixa funcional: " + r.functional_min + "-" + r.functional_max + "]"
    : "";

  let statusStr = "";
  if (includeStatus) {
    const statusLabels: Record<string, string> = {
      low: "BAIXO", high: "ALTO", critical_low: "CRITICO BAIXO", critical_high: "CRITICO ALTO",
    };
    statusStr = statusLabels[r.status] ?? "";
  }

  let line = "- " + r.marker_name + ": " + valueStr;
  if (statusStr) line += " " + statusStr;
  if (labRefStr) line += " " + labRefStr;
  if (funcRefStr) line += " " + funcRefStr;
  line += " [" + r.session_date + "]";
  return line;
}

// ══════════════════════════════════════════════════════════════════════════════
// BUILD USER PROMPT
// ══════════════════════════════════════════════════════════════════════════════

export function buildUserPrompt(
  req: AnalysisRequest,
  scoredActives: ScoredActive[],
  matchedProtocols: Array<{ protocol: EssentiaProtocol; coverage: number; matched_actives: string[] }>,
  clinicalContext: ClinicalContext,
  specialtyIdOverride?: string,
  encounterCtx?: EncounterContext | null,
): string {
  const activeSpecialty = specialtyIdOverride ?? req.specialty_id ?? "medicina_funcional";
  const useFunctionalRefs = activeSpecialty === "nutrologia";
  const age = req.birth_date
    ? Math.floor((Date.now() - new Date(req.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  const sexLabel = req.sex === "M" ? "Masculino" : "Feminino";
  const ageLabel = age ? age + " anos" : "idade nao informada";
  const labs = clinicalContext.labs;

  const sessionDates = [...new Set(labs.allResults.map((r) => r.session_date))].sort();

  let prompt = "DADOS DO PACIENTE:\n" +
    "- Nome: " + req.patient_name + "\n" +
    "- Sexo: " + sexLabel + "\n" +
    "- Idade: " + ageLabel + "\n" +
    "- Sessoes: " + sessionDates.length + " (" + sessionDates.join(", ") + ")\n";

  // Perfil do paciente
  const p = clinicalContext.patientProfile;
  if (p) {
    if (p.objectives && p.objectives.length > 0) prompt += "- Objetivos: " + p.objectives.join(", ") + "\n";
    if (p.activity_level) prompt += "- Atividade fisica: " + p.activity_level + "\n";
    if (p.sport_modality) prompt += "- Modalidade: " + p.sport_modality + "\n";
    if (p.main_complaints) prompt += "- Queixas: " + p.main_complaints + "\n";
    if (p.restrictions) prompt += "- Restricoes/alergias: " + p.restrictions + "\n";
  }

  // ── Current encounter context (SOAP notes) ──
  const ec = encounterCtx;
  if (ec?.soap) {
    const s = ec.soap;
    const hasContent = s.chief_complaint || s.subjective || s.objective || s.assessment || s.plan;
    if (hasContent) {
      prompt += "\nCONSULTA ATUAL (" + ec.encounter_date + ") — NOTAS CLINICAS DO ATENDIMENTO EM ANDAMENTO:\n";
      prompt += "IMPORTANTE: Esta e a consulta ativa. A analise deve ser direcionada ao contexto desta consulta especifica. Considere a queixa principal, os achados e a conduta ja registrada pelo medico.\n";
      if (s.chief_complaint) prompt += "- Queixa principal: " + s.chief_complaint + "\n";
      if (s.subjective) prompt += "- Subjetivo (relato do paciente): " + s.subjective.slice(0, 500) + "\n";
      if (s.objective) prompt += "- Objetivo (achados): " + s.objective.slice(0, 500) + "\n";
      if (s.assessment) prompt += "- Avaliacao clinica: " + s.assessment.slice(0, 500) + "\n";
      if (s.plan) prompt += "- Conduta/Plano: " + s.plan.slice(0, 500) + "\n";
      if (s.exams_requested) prompt += "- Exames solicitados: " + s.exams_requested.slice(0, 300) + "\n";
      if (s.medications) prompt += "- Medicacoes: " + s.medications.slice(0, 300) + "\n";
      if (s.free_notes) prompt += "- Observacoes: " + s.free_notes.slice(0, 300) + "\n";
    }
    const linkedSources: string[] = [];
    if (ec.linked_lab_session_ids?.length) linkedSources.push(ec.linked_lab_session_ids.length + " sessao(oes) lab");
    if (ec.linked_body_composition_ids?.length) linkedSources.push(ec.linked_body_composition_ids.length + " comp. corporal");
    if (ec.linked_imaging_report_ids?.length) linkedSources.push(ec.linked_imaging_report_ids.length + " laudo(s) imagem");
    if (linkedSources.length > 0) {
      prompt += "\nFONTES VINCULADAS A ESTA CONSULTA: " + linkedSources.join(", ") + "\n";
      prompt += "Os exames laboratoriais, composicao corporal e laudos de imagem abaixo foram explicitamente selecionados pelo medico para este atendimento.\n";
    }
    prompt += "\n";
  }

  // ── Anamnese ──
  const sa = clinicalContext.structuredAnamnese;
  if (sa && clinicalContext.anamneseSource === "structured") {
    prompt += "\nANAMNESE DO PACIENTE (" + activeSpecialty.replace(/_/g, " ") + ") — CAMPOS ESTRUTURADOS:\n";
    if (sa.queixa_principal) prompt += "- Queixa principal: " + sa.queixa_principal + "\n";
    if (sa.objetivos && sa.objetivos.length > 0) prompt += "- Objetivos: " + sa.objetivos.join(", ") + "\n";
    if (sa.sintomas && sa.sintomas.length > 0) prompt += "- Sintomas relevantes: " + sa.sintomas.join(", ") + "\n";
    if (sa.comorbidades && sa.comorbidades.length > 0) prompt += "- Comorbidades: " + sa.comorbidades.join(", ") + "\n";
    if (sa.medicacoes && sa.medicacoes.length > 0) prompt += "- Medicacoes em uso: " + sa.medicacoes.join(", ") + "\n";
    if (sa.suplementos && sa.suplementos.length > 0) prompt += "- Suplementos: " + sa.suplementos.join(", ") + "\n";
    if (sa.alergias && sa.alergias.length > 0) prompt += "- Alergias: " + sa.alergias.join(", ") + "\n";
    if (sa.restricoes_alimentares) prompt += "- Restricoes alimentares: " + sa.restricoes_alimentares + "\n";
    if (sa.cirurgias && sa.cirurgias.length > 0) prompt += "- Cirurgias previas: " + sa.cirurgias.join(", ") + "\n";
    if (sa.historico_familiar) prompt += "- Historico familiar: " + sa.historico_familiar + "\n";
    const habitLines: string[] = [];
    if (sa.atividade_fisica) habitLines.push("Atividade fisica: " + sa.atividade_fisica);
    if (sa.qualidade_sono) habitLines.push("Sono: " + (sa.sono_horas ? sa.sono_horas + "h" : "") + " (" + sa.qualidade_sono + ")");
    if (sa.nivel_estresse) habitLines.push("Estresse: " + sa.nivel_estresse);
    if (sa.tabagismo) habitLines.push("Tabagismo: sim");
    if (sa.etilismo) habitLines.push("Etilismo: " + sa.etilismo);
    if (sa.dieta_resumo) habitLines.push("Dieta: " + sa.dieta_resumo);
    if (habitLines.length > 0) prompt += "- Habitos/Estilo de vida: " + habitLines.join("; ") + "\n";
    if (sa.observacoes) prompt += "\nOBSERVACOES LIVRES DO MEDICO (texto livre complementar):\n" + sa.observacoes + "\n";
  } else if (clinicalContext.anamnese) {
    prompt += "\nANAMNESE DO PACIENTE (" + activeSpecialty.replace(/_/g, " ") + "):\n" + clinicalContext.anamnese + "\n";
  }

  // ── Doctor Notes (deprecated) ──
  if (clinicalContext.doctorNotes) {
    prompt += "\nNOTAS DO MEDICO ASSISTENTE (especialidade: " + activeSpecialty.replace(/_/g, " ") + "):\n" + clinicalContext.doctorNotes + "\n";
    prompt += "INSTRUCAO: Considere estas notas ao formular sua analise. Se o medico ja indicou hipoteses ou conduta, valide ou complemente com base nos exames.\n";
  }

  // ── Body Composition ──
  const bc = clinicalContext.bodyComposition;
  if (bc?.current) {
    prompt += "\nCOMPOSICAO CORPORAL (dados de bioimpedancia):\n";
    const c = bc.current;
    if (c.weight_kg) prompt += "- Peso: " + c.weight_kg + " kg\n";
    if (c.bmi) prompt += "- IMC: " + c.bmi + "\n";
    if (c.skeletal_muscle_kg) prompt += "- Massa muscular esqueletica: " + c.skeletal_muscle_kg + " kg\n";
    if (c.body_fat_pct) prompt += "- Gordura corporal: " + c.body_fat_pct + "%";
    if (c.body_fat_kg) prompt += " (" + c.body_fat_kg + " kg)";
    if (c.body_fat_pct || c.body_fat_kg) prompt += "\n";
    if (c.visceral_fat_level) prompt += "- Gordura visceral (nivel): " + c.visceral_fat_level + "\n";
    if (c.total_body_water_l) prompt += "- Agua corporal total: " + c.total_body_water_l + " L\n";
    if (c.ecw_tbw_ratio) prompt += "- Razao AEC/ACT: " + c.ecw_tbw_ratio + "\n";
    if (c.bmr_kcal) prompt += "- TMB: " + c.bmr_kcal + " kcal\n";
    if (c.waist_cm) prompt += "- Circunferencia abdominal: " + c.waist_cm + " cm\n";
    if (c.waist_hip_ratio) prompt += "- Relacao cintura/quadril: " + c.waist_hip_ratio + "\n";
    prompt += "- Data: " + c.session_date + "\n";
    if (bc.previous) {
      const prev = bc.previous;
      prompt += "\nCOMPOSICAO CORPORAL ANTERIOR (" + prev.session_date + "):\n";
      if (prev.weight_kg && c.weight_kg) {
        const delta = c.weight_kg - prev.weight_kg;
        prompt += "- Peso anterior: " + prev.weight_kg + " kg (variacao: " + (delta > 0 ? "+" : "") + delta.toFixed(1) + " kg)\n";
      }
      if (prev.skeletal_muscle_kg && c.skeletal_muscle_kg) {
        const delta = c.skeletal_muscle_kg - prev.skeletal_muscle_kg;
        prompt += "- Massa muscular anterior: " + prev.skeletal_muscle_kg + " kg (variacao: " + (delta > 0 ? "+" : "") + delta.toFixed(1) + " kg)\n";
      }
      if (prev.body_fat_pct && c.body_fat_pct) {
        const delta = c.body_fat_pct - prev.body_fat_pct;
        prompt += "- Gordura corporal anterior: " + prev.body_fat_pct + "% (variacao: " + (delta > 0 ? "+" : "") + delta.toFixed(1) + "%)\n";
      }
    }
    prompt += "INSTRUCAO: Correlacione a composicao corporal com os achados laboratoriais. Exemplo: gordura visceral elevada + triglicerides alto = sindrome metabolica.\n";
  }

  // ── Imaging Reports ──
  const ir = clinicalContext.imagingReports;
  if (ir?.current) {
    prompt += "\nLAUDOS DE EXAMES DE IMAGEM:\n";
    const formatReport = (report: typeof ir.current, label: string) => {
      if (!report) return;
      prompt += "\n" + label + " (" + report.report_date + ") — " + report.exam_type;
      if (report.exam_region) prompt += " (" + report.exam_region + ")";
      prompt += ":\n";
      if (report.findings) prompt += "- Achados: " + report.findings.slice(0, 500) + "\n";
      if (report.conclusion) prompt += "- Conclusao: " + report.conclusion.slice(0, 300) + "\n";
      if (report.recommendations) prompt += "- Recomendacoes: " + report.recommendations.slice(0, 200) + "\n";
      if (report.incidental_findings) prompt += "- Achados incidentais: " + report.incidental_findings.slice(0, 200) + "\n";
      if (report.classifications) prompt += "- Classificacoes: " + report.classifications + "\n";
    };
    formatReport(ir.current, "LAUDO MAIS RECENTE");
    if (ir.history.length > 0) {
      for (let i = 0; i < Math.min(ir.history.length, 2); i++) {
        formatReport(ir.history[i], "LAUDO ANTERIOR " + (i + 1));
      }
    }
    prompt += "INSTRUCAO: Correlacione achados de imagem com dados laboratoriais. Exemplos: nodulo tireoidiano + anti-TPO elevado; esteatose hepatica + GGT/TGP elevados.\n";
  }

  // ── Clinical History ──
  const ch = clinicalContext.clinicalHistory;
  if (ch) {
    if (ch.previousEncounter) {
      const pe = ch.previousEncounter;
      prompt += "\nHISTORICO CLINICO ANTERIOR — ULTIMA CONSULTA (" + (pe.encounter_date || "").slice(0, 10) + "):\n";
      if (pe.chief_complaint) prompt += "- Motivo da consulta anterior: " + pe.chief_complaint + "\n";
      if (pe.subjective) prompt += "- Subjetivo: " + pe.subjective.slice(0, 300) + "\n";
      if (pe.objective) prompt += "- Objetivo: " + pe.objective.slice(0, 300) + "\n";
      if (pe.assessment) prompt += "- Avaliacao: " + pe.assessment.slice(0, 300) + "\n";
      if (pe.plan) prompt += "- Plano: " + pe.plan.slice(0, 300) + "\n";
      if (pe.medications) prompt += "- Medicacoes prescritas: " + pe.medications.slice(0, 200) + "\n";
      if (pe.exams_requested) prompt += "- Exames solicitados: " + pe.exams_requested.slice(0, 200) + "\n";
    }
    if (ch.previousAnalysis) {
      const pa = ch.previousAnalysis;
      prompt += "\nHISTORICO CLINICO ANTERIOR — ULTIMA ANALISE IA (" + (pa.created_at || "").slice(0, 10) + "):\n";
      if (pa.summary) prompt += "- Resumo: " + pa.summary.slice(0, 300) + "\n";
      if (pa.patterns && pa.patterns.length > 0) prompt += "- Padroes: " + (pa.patterns as string[]).slice(0, 3).join("; ") + "\n";
      if (pa.suggestions && pa.suggestions.length > 0) prompt += "- Sugestoes anteriores: " + (pa.suggestions as string[]).slice(0, 3).join("; ") + "\n";
    }
    if (ch.previousEncounter || ch.previousAnalysis) {
      prompt += "INSTRUCAO: Compare os achados atuais com o historico. Identifique: (1) melhoras ou pioras, (2) resposta a tratamentos anteriores, (3) novos achados nao presentes antes.\n\n";
    }
  }

  // ── Lab results ──
  prompt += "\nRESULTADOS LABORATORIAIS:\n";
  if (labs.outOfRange.length > 0) {
    prompt += "\nMARCADORES FORA DA FAIXA (" + labs.outOfRange.length + "):\n";
    for (const r of labs.outOfRange) {
      prompt += formatLabLine(r, useFunctionalRefs, true) + "\n";
    }
  }

  if (labs.clinicallyRelevantNormals.length > 0) {
    prompt += "\nMARCADORES NORMAIS CLINICAMENTE RELEVANTES (" + labs.clinicallyRelevantNormals.length + "):\n";
    for (const r of labs.clinicallyRelevantNormals) {
      const reasonLabel = r.relevance_reason === "near_lower_limit" ? "(proximo do limite inferior)"
        : r.relevance_reason === "near_upper_limit" ? "(proximo do limite superior)"
        : r.relevance_reason === "key_marker" ? "(marcador-chave)"
        : "";
      prompt += formatLabLine(r, useFunctionalRefs, false) + " " + reasonLabel + "\n";
    }
  }

  if (labs.derivedMarkers.length > 0) {
    prompt += "\nMARCADORES DERIVADOS/CALCULADOS (" + labs.derivedMarkers.length + "):\n";
    for (const r of labs.derivedMarkers) {
      const status = typeof r.status === "string" ? r.status : "unknown";
      const statusLabel = status !== "normal"
        ? (" " + (status === "high" ? "ALTO" : status === "low" ? "BAIXO" : status.toUpperCase()))
        : "";
      prompt += "- " + r.marker_name + ": " + (r.value !== null ? r.value + " " + r.unit : r.text_value ?? "--") + statusLabel + " [" + r.session_date + "]\n";
    }
  }

  if (labs.trends && labs.trends.length > 0) {
    prompt += "\nTENDENCIAS (multiplas sessoes):\n";
    for (const t of labs.trends) {
      const sign = t.direction === "up" ? "+" : t.direction === "down" ? "-" : "=";
      prompt += "- " + t.marker_name + ": " + t.first_value + " -> " + t.last_value + " (" + sign + " " + t.delta_percent + "%)\n";
    }
  }

  // ── Therapeutic actives (Camada 1+2) ──
  const mode = req.mode ?? "full";
  if (mode !== "analysis_only" && scoredActives.length > 0) {
    prompt += "\n(A) ATIVOS TERAPEUTICOS MAIS RELEVANTES PARA ESTE PACIENTE (calculados pelo sistema):\n";
    prompt += "Os seguintes ativos foram selecionados com base nos marcadores alterados e objetivos do paciente. Confirme quais sao clinicamente justificados:\n\n";
    for (const sa of scoredActives.slice(0, 8)) {
      const triggeredNames = sa.triggered_by.join(", ") || "objetivos do paciente";
      prompt += "* " + sa.active.name + " (score: " + sa.score.toFixed(1) + ")\n";
      prompt += "  Mecanismo: " + sa.active.mechanism + "\n";
      prompt += "  Ativado por: " + triggeredNames + "\n";
      if (sa.active.contraindications) prompt += "  Contraindicacoes: " + sa.active.contraindications + "\n";
      prompt += "\n";
    }

    prompt += "(B) PROTOCOLOS ESSENTIA QUE CONTEM ESSES ATIVOS (pre-filtrados pelo sistema):\n";
    prompt += "Selecione os 3-4 com MAIOR PRECISAO CLINICA para este paciente:\n\n";
    for (const mp of matchedProtocols) {
      prompt += "* " + mp.protocol.id + " | " + mp.protocol.name + " | Via: " + mp.protocol.via + "\n";
      prompt += "  Composicao: " + mp.protocol.composition + "\n";
      prompt += "  Ativos em comum com os selecionados: " + mp.matched_actives.join(", ") + " (" + mp.coverage + " ativos)\n\n";
    }

    prompt += "INSTRUCAO: Para cada protocolo selecionado, escreva uma justificativa ESPECIFICA (nao generica) mencionando os ativos-chave e os marcadores alterados deste paciente. Inclua \"key_actives\" com os 2-3 ativos mais importantes.\n";
  }

  // Instruções por modo
  if (mode === "analysis_only") {
    prompt += "\nMODO: Gere APENAS a analise clinica (summary, patterns, trends, suggestions, full_text, technical_analysis, patient_plan). Retorne \"protocol_recommendations\" como array vazio e \"prescription_table\" como array vazio.\n";
  } else if (mode === "protocols_only") {
    prompt += "\nMODO: Gere APENAS as recomendacoes de protocolos. Retorne summary, patterns, trends, suggestions e full_text como strings/arrays vazios.\n";
  } else {
    prompt += "\nREGRA OBRIGATORIA: O campo \"prescription_table\" NUNCA deve ser retornado como array vazio no modo full.";
    prompt += " Inclua TODOS os suplementos orais, injetaveis e medicamentos recomendados no plano de condutas.";
    prompt += " Cada item DEVE conter: substancia, dose, via, frequencia, duracao, condicoes_ci, monitorizacao.";
    prompt += " Minimo de 3 itens. Se houver suplementacao oral mencionada no patient_plan, ela DEVE aparecer na prescription_table.\n";
  }

  prompt += "\n\nINSTRUÇÕES OBRIGATÓRIAS PARA O JSON DE SAÍDA:";
  prompt += "\n1. O campo 'diagnostic_hypotheses' é OBRIGATÓRIO. Gere 2-4 hipóteses diagnósticas ESPECÍFICAS (ex: 'Dislipidemia primária', 'Deficiência funcional de ferro', 'SOP'). NÃO use placeholders genéricos. Cada hipótese deve ter: hypothesis, supporting_findings, contradicting_findings (array vazio se não houver), confirmatory_exams, likelihood (probable/possible/unlikely), priority.";
  prompt += "\n2. O campo 'follow_up' é OBRIGATÓRIO. Deve conter: suggested_exams (exames para o próximo retorno), suggested_return_days (30/60/90 dias), notes (observações de acompanhamento).";
  prompt += "\nRetorne um JSON com a analise clinica estruturada conforme o formato especificado.";
  return prompt;
}
