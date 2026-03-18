/**
 * contextAssembly.ts
 *
 * Builds ClinicalContext from DB queries + deterministic lab context.
 * Contains: buildLabsContext (pure) + fetchClinicalContext (async DB).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { MarkerResult, PatientProfile, EncounterContext } from "./types.ts";
import type {
  ClinicalContext,
  ClinicalContextLabs,
  ClinicalHistoryContext,
  PreviousEncounterSnapshot,
  PreviousAnalysisSummary,
  ContextLoaded,
  CanonicalLabResult,
  LabTrend,
  LabStatus,
  BodyCompositionSnapshot,
  BodyCompositionContext,
  ImagingReportSnapshot,
  ImagingReportsContext,
  StructuredAnamnese,
} from "./clinicalContext.types.ts";
import { checkNearLimit, isKeyMarker } from "./clinicalContext.types.ts";

// Derived marker IDs (markers calculated from other markers)
const DERIVED_MARKER_IDS = new Set([
  "homa_ir", "relacao_t3_t4", "relacao_albumina_globulina",
  "glicemia_media_estimada", "colesterol_nao_hdl",
]);

/**
 * Builds ClinicalContextLabs from the MarkerResult[] already in the request.
 * This is a deterministic transformation — no new data is fetched or invented.
 */
export function buildLabsContext(results: MarkerResult[]): ClinicalContextLabs {
  const allResults: CanonicalLabResult[] = results.map((r) => ({
    marker_id: r.marker_id,
    marker_name: r.marker_name,
    value: r.value,
    text_value: r.text_value,
    unit: r.unit,
    status: r.status as LabStatus,
    session_date: r.session_date,
    lab_ref_min: (r as any).lab_min,
    lab_ref_max: (r as any).lab_max,
    functional_min: r.functional_min,
    functional_max: r.functional_max,
    is_derived: DERIVED_MARKER_IDS.has(r.marker_id),
    source: "current" as const,
  }));

  const outOfRange = allResults.filter(
    (r) => r.status === "low" || r.status === "high" || r.status === "critical_low" || r.status === "critical_high"
  );

  const derivedMarkers = allResults.filter((r) => r.is_derived);

  const normals = allResults.filter((r) => r.status === "normal");
  const clinicallyRelevantNormals: CanonicalLabResult[] = [];
  for (const r of normals) {
    if (isKeyMarker(r.marker_id)) {
      clinicallyRelevantNormals.push({ ...r, relevance_reason: "key_marker" });
    } else if (r.value !== null) {
      const nearReason = checkNearLimit(r.value, r.lab_ref_min, r.lab_ref_max);
      if (nearReason) {
        clinicallyRelevantNormals.push({ ...r, relevance_reason: nearReason });
      }
    }
  }

  // Trends
  const trends: LabTrend[] = [];
  const sessionDates = [...new Set(results.map((r) => r.session_date))].sort();
  if (sessionDates.length > 1) {
    const markerSessions: Record<string, { name: string; entries: Array<{ date: string; value: number }> }> = {};
    for (const r of results) {
      if (r.value !== null) {
        if (!markerSessions[r.marker_id]) {
          markerSessions[r.marker_id] = { name: r.marker_name, entries: [] };
        }
        markerSessions[r.marker_id].entries.push({ date: r.session_date, value: r.value });
      }
    }
    for (const [id, data] of Object.entries(markerSessions)) {
      if (data.entries.length > 1) {
        const sorted = data.entries.sort((a, b) => a.date.localeCompare(b.date));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const deltaPct = first.value !== 0
          ? ((last.value - first.value) / first.value * 100)
          : 0;
        const direction: "up" | "down" | "stable" =
          last.value > first.value ? "up" : last.value < first.value ? "down" : "stable";
        trends.push({
          marker_id: id,
          marker_name: data.name,
          entries: sorted,
          first_value: first.value,
          last_value: last.value,
          delta_percent: Math.round(deltaPct * 10) / 10,
          direction,
          is_improving: null,
        });
      }
    }
  }

  return { allResults, outOfRange, clinicallyRelevantNormals, derivedMarkers, trends };
}

export async function fetchClinicalContext(
  supabaseClient: ReturnType<typeof createClient>,
  patientId: string | undefined,
  specialtyId: string,
  patientProfile: PatientProfile | null | undefined,
  results: MarkerResult[],
  encounterCtx?: EncounterContext | null,
): Promise<{ context: ClinicalContext; loaded: ContextLoaded }> {
  const labs = buildLabsContext(results);

  const result: ClinicalContext = {
    anamnese: null,
    structuredAnamnese: null,
    anamneseSource: "none",
    doctorNotes: null,
    patientProfile: patientProfile ?? null,
    labs,
    bodyComposition: null,
    imagingReports: null,
    clinicalHistory: null,
  };

  const loaded: ContextLoaded = {
    anamnesis: false,
    doctorNotes: false,
    bodyComposition: false,
    imagingReports: false,
    clinicalHistory: false,
    patientProfile: !!(patientProfile && (
      (patientProfile.objectives && patientProfile.objectives.length > 0) ||
      patientProfile.activity_level || patientProfile.sport_modality ||
      patientProfile.main_complaints || patientProfile.restrictions
    )),
    labs: {
      total: labs.allResults.length,
      outOfRange: labs.outOfRange.length,
      clinicallyRelevantNormals: labs.clinicallyRelevantNormals.length,
      derivedMarkers: labs.derivedMarkers.length,
      trendsCount: (labs.trends ?? []).length,
    },
  };

  if (!patientId) return { context: result, loaded };

  const bodyCompSpecialties = ["nutrologia", "endocrinologia"];
  const imagingSpecialties = ["endocrinologia", "nutrologia", "ginecologia"];
  const shouldFetchBodyComp = bodyCompSpecialties.includes(specialtyId);
  const shouldFetchImaging = imagingSpecialties.includes(specialtyId);

  const linkedBodyIds = encounterCtx?.linked_body_composition_ids ?? [];
  const linkedImagingIds = encounterCtx?.linked_imaging_report_ids ?? [];

  const [anamneseResult, notesResult, bodyCompResult, imagingResult, encountersResult, analysesResult] = await Promise.all([
    supabaseClient
      .from("patient_anamneses")
      .select("*")
      .eq("patient_id", patientId)
      .eq("specialty_id", specialtyId)
      .single()
      .then(({ data }: { data: unknown }) => data)
      .catch((err: unknown) => { console.warn("Failed to load anamnese:", err); return null; }),
    supabaseClient
      .from("doctor_specialty_notes")
      .select("*")
      .eq("patient_id", patientId)
      .eq("specialty_id", specialtyId)
      .single()
      .then(({ data }: { data: unknown }) => data)
      .catch((err: unknown) => { console.warn("[DEPRECATED] Failed to load doctor notes:", err); return null; }),
    shouldFetchBodyComp
      ? (linkedBodyIds.length > 0
          ? supabaseClient
              .from("body_composition_sessions")
              .select("*")
              .in("id", linkedBodyIds)
              .order("session_date", { ascending: false })
              .then(({ data }: { data: unknown }) => data)
              .catch(() => null)
          : supabaseClient
              .from("body_composition_sessions")
              .select("*")
              .eq("patient_id", patientId)
              .order("session_date", { ascending: false })
              .limit(2)
              .then(({ data }: { data: unknown }) => data)
              .catch(() => null))
      : Promise.resolve(null),
    shouldFetchImaging
      ? (linkedImagingIds.length > 0
          ? supabaseClient
              .from("imaging_reports")
              .select("*")
              .in("id", linkedImagingIds)
              .order("report_date", { ascending: false })
              .then(({ data }: { data: unknown }) => data)
              .catch(() => null)
          : supabaseClient
              .from("imaging_reports")
              .select("*")
              .eq("patient_id", patientId)
              .order("report_date", { ascending: false })
              .limit(5)
              .then(({ data }: { data: unknown }) => data)
              .catch(() => null))
      : Promise.resolve(null),
    supabaseClient
      .from("clinical_encounters")
      .select("encounter_date, chief_complaint, status, clinical_evolution_notes(subjective, objective, assessment, plan, medications, exams_requested)")
      .eq("patient_id", patientId)
      .order("encounter_date", { ascending: false })
      .limit(2)
      .then(({ data }: { data: unknown }) => data)
      .catch((err: unknown) => { console.warn("Failed to load encounters:", err); return null; }),
    supabaseClient
      .from("patient_analyses")
      .select("created_at, specialty_name, summary, patterns, suggestions")
      .eq("patient_id", patientId)
      .eq("specialty_id", specialtyId)
      .order("created_at", { ascending: false })
      .limit(2)
      .then(({ data }: { data: unknown }) => data)
      .catch((err: unknown) => { console.warn("Failed to load analyses:", err); return null; }),
  ]);

  // Parse anamnese
  if (anamneseResult) {
    const a = anamneseResult as Record<string, unknown>;
    const structuredData = a.structured_data as StructuredAnamnese | null;
    const text = a.anamnese_text as string | null;

    const hasStructured = structuredData && (
      structuredData.queixa_principal ||
      (structuredData.objetivos && structuredData.objetivos.length > 0) ||
      (structuredData.sintomas && structuredData.sintomas.length > 0) ||
      (structuredData.medicacoes && structuredData.medicacoes.length > 0) ||
      (structuredData.comorbidades && structuredData.comorbidades.length > 0) ||
      (structuredData.suplementos && structuredData.suplementos.length > 0) ||
      (structuredData.alergias && structuredData.alergias.length > 0)
    );

    if (hasStructured) {
      result.structuredAnamnese = structuredData;
      result.anamneseSource = "structured";
      if (text && text.trim().length > 0) result.anamnese = text.trim();
      loaded.anamnesis = true;
      console.log("Structured anamnese loaded for patient " + patientId + " (fields: " +
        Object.keys(structuredData!).filter(k => {
          const v = (structuredData as Record<string, unknown>)[k];
          return v && (typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : v !== null);
        }).length + ")");
    } else if (text && text.trim().length > 0) {
      result.anamnese = text.trim();
      result.anamneseSource = "legacy_text";
      loaded.anamnesis = true;
      console.log("Legacy anamnese text loaded: " + text.length + " chars for patient " + patientId);
    }
  }

  // Parse doctor notes (DEPRECATED)
  if (notesResult) {
    const n = notesResult as Record<string, unknown>;
    const noteLines: string[] = [];
    if (n.impressao_clinica) noteLines.push("Impressao clinica: " + n.impressao_clinica);
    if (n.hipoteses_diagnosticas) noteLines.push("Hipoteses diagnosticas: " + n.hipoteses_diagnosticas);
    if (n.foco_consulta) noteLines.push("Foco desta consulta: " + n.foco_consulta);
    if (n.observacoes_exames) noteLines.push("Observacoes sobre exames: " + n.observacoes_exames);
    if (n.conduta_planejada) noteLines.push("Conduta planejada: " + n.conduta_planejada);
    if (n.pontos_atencao) noteLines.push("Pontos de atencao: " + n.pontos_atencao);
    if (n.medicamentos_prescritos) noteLines.push("Medicamentos ja prescritos: " + n.medicamentos_prescritos);
    if (n.resposta_tratamento) noteLines.push("Resposta ao tratamento anterior: " + n.resposta_tratamento);
    if (n.proximos_passos) noteLines.push("Proximos passos planejados: " + n.proximos_passos);
    if (n.notas_livres) noteLines.push("Notas adicionais: " + n.notas_livres);
    if (n.adesao_tratamento) noteLines.push("Adesao ao tratamento: " + n.adesao_tratamento);
    if (n.motivacao_paciente) noteLines.push("Motivacao do paciente: " + n.motivacao_paciente);
    if (n.exames_em_dia !== null) noteLines.push("Exames em dia: " + (n.exames_em_dia ? "sim" : "nao"));
    if (noteLines.length > 0) {
      result.doctorNotes = noteLines.map(l => "- " + l).join("\n");
      loaded.doctorNotes = true;
      console.log("[DEPRECATED] Doctor notes loaded: " + noteLines.length + " fields for patient " + patientId);
    }
  }

  // Parse body composition
  if (bodyCompResult && Array.isArray(bodyCompResult) && bodyCompResult.length > 0) {
    const mapSession = (row: Record<string, unknown>): BodyCompositionSnapshot => ({
      session_date: row.session_date as string,
      weight_kg: row.weight_kg as number | null,
      bmi: row.bmi as number | null,
      skeletal_muscle_kg: row.skeletal_muscle_kg as number | null,
      body_fat_kg: row.body_fat_kg as number | null,
      body_fat_pct: row.body_fat_pct as number | null,
      visceral_fat_level: row.visceral_fat_level as number | null,
      total_body_water_l: row.total_body_water_l as number | null,
      ecw_tbw_ratio: row.ecw_tbw_ratio as number | null,
      bmr_kcal: row.bmr_kcal as number | null,
      waist_cm: row.waist_cm as number | null,
      hip_cm: row.hip_cm as number | null,
      waist_hip_ratio: row.waist_hip_ratio as number | null,
    });

    const totalCount = bodyCompResult.length;
    result.bodyComposition = {
      current: mapSession(bodyCompResult[0] as Record<string, unknown>),
      previous: bodyCompResult.length > 1 ? mapSession(bodyCompResult[1] as Record<string, unknown>) : null,
      totalSessions: totalCount,
    };
    loaded.bodyComposition = true;
    console.log("Body composition loaded: " + totalCount + " session(s) for patient " + patientId);
  }

  // Parse imaging reports
  if (imagingResult && Array.isArray(imagingResult) && imagingResult.length > 0) {
    const mapReport = (row: Record<string, unknown>): ImagingReportSnapshot => ({
      id: row.id as string,
      report_date: row.report_date as string,
      exam_type: row.exam_type as string,
      exam_region: (row.exam_region as string | null) ?? null,
      findings: (row.findings as string | null) ?? null,
      conclusion: (row.conclusion as string | null) ?? null,
      recommendations: (row.recommendations as string | null) ?? null,
      incidental_findings: (row.incidental_findings as string | null) ?? null,
      classifications: (row.classifications as string | null) ?? null,
      source_lab: (row.source_lab as string | null) ?? null,
      source_type: (row.source_type as string) ?? "manual",
      specialty_id: (row.specialty_id as string | null) ?? null,
    });

    const allReports = imagingResult.map((r: unknown) => mapReport(r as Record<string, unknown>));
    result.imagingReports = {
      current: allReports[0],
      history: allReports.slice(1),
      totalReports: allReports.length,
    };
    loaded.imagingReports = true;
    console.log("Imaging reports loaded: " + allReports.length + " report(s) for patient " + patientId);
  }

  // Parse clinical history
  try {
    const encounters = (encountersResult && Array.isArray(encountersResult)) ? encountersResult : [];
    const analyses = (analysesResult && Array.isArray(analysesResult)) ? analysesResult : [];

    let previousEncounter: PreviousEncounterSnapshot | null = null;
    if (encounters.length > 0) {
      const enc = encounters[0] as Record<string, unknown>;
      const notes = Array.isArray(enc.clinical_evolution_notes)
        ? (enc.clinical_evolution_notes[0] as Record<string, unknown> | undefined)
        : null;
      previousEncounter = {
        encounter_date: enc.encounter_date as string,
        chief_complaint: (enc.chief_complaint as string | null) ?? null,
        status: (enc.status as string) ?? "draft",
        subjective: (notes?.subjective as string | null) ?? null,
        objective: (notes?.objective as string | null) ?? null,
        assessment: (notes?.assessment as string | null) ?? null,
        plan: (notes?.plan as string | null) ?? null,
        medications: (notes?.medications as string | null) ?? null,
        exams_requested: (notes?.exams_requested as string | null) ?? null,
      };
    }

    let previousAnalysis: PreviousAnalysisSummary | null = null;
    const prevAnalysisRow = analyses.length > 1
      ? (analyses[1] as Record<string, unknown>)
      : analyses.length === 1
        ? (analyses[0] as Record<string, unknown>)
        : null;
    if (prevAnalysisRow) {
      previousAnalysis = {
        created_at: prevAnalysisRow.created_at as string,
        specialty_name: (prevAnalysisRow.specialty_name as string | null) ?? null,
        summary: (prevAnalysisRow.summary as string | null) ?? null,
        patterns: Array.isArray(prevAnalysisRow.patterns) ? (prevAnalysisRow.patterns as string[]) : [],
        suggestions: Array.isArray(prevAnalysisRow.suggestions) ? (prevAnalysisRow.suggestions as string[]) : [],
      };
    }

    if (previousEncounter || previousAnalysis) {
      result.clinicalHistory = {
        previousEncounter,
        previousAnalysis,
        totalEncounters: encounters.length,
        totalAnalyses: analyses.length,
      };
      loaded.clinicalHistory = true;
      console.log("Clinical history loaded: encounter=" + !!previousEncounter + " analysis=" + !!previousAnalysis + " for patient " + patientId);
    }
  } catch (histErr) {
    console.warn("Failed to parse clinical history (non-fatal):", histErr);
  }

  return { context: result, loaded };
}
