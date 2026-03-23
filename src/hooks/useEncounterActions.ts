/**
 * useEncounterActions — Save, finalize, delete, export PDF, generate AI analysis.
 * Extracted from EncounterWorkspace to separate actions from UI.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MARKERS } from "@/lib/markers";
import { buildSourceContext } from "@/lib/analysisSourceContext";
import { generateEncounterPdf } from "@/lib/generateEncounterPdf";
import { buildReviewedReport } from "@/lib/buildReviewedReport";
import { format, parseISO } from "date-fns";
import type { AnalysisV2Data } from "@/components/ClinicalReportV2";
import type { PrescriptionItem } from "@/components/EncounterPrescriptionEditor";
import type { Encounter, EvolutionNote, Patient, RelevantMarker } from "@/hooks/useEncounterData";

interface UseEncounterActionsParams {
  encounter: Encounter | null;
  patient: Patient | null;
  note: EvolutionNote & { id?: string };
  setNote: React.Dispatch<React.SetStateAction<EvolutionNote & { id?: string }>>;
  setEncounter: React.Dispatch<React.SetStateAction<Encounter | null>>;
  setAnalysis: React.Dispatch<React.SetStateAction<any>>;
  setV2Data: React.Dispatch<React.SetStateAction<AnalysisV2Data | null>>;
  setStalenessReasons: React.Dispatch<React.SetStateAction<string[]>>;
  v2Data: AnalysisV2Data | null;
  analysis: any;
  specialtyName: string;
  relevantMarkers: RelevantMarker[];
}

export function useEncounterActions({
  encounter,
  patient,
  note,
  setNote,
  setEncounter,
  setAnalysis,
  setV2Data,
  setStalenessReasons,
  v2Data,
  analysis,
  specialtyName,
  relevantMarkers,
}: UseEncounterActionsParams) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [isGeneratingAnalysis, setIsGeneratingAnalysis] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);

  // ── Save note ──
  const handleSave = async () => {
    if (!encounter) return;
    setSaving(true);

    const payload = {
      encounter_id: encounter.id,
      subjective: note.subjective || null,
      objective: note.objective || null,
      assessment: note.assessment || null,
      plan: note.plan || null,
      exams_requested: note.exams_requested || null,
      medications: note.medications || null,
      free_notes: note.free_notes || null,
    };

    if (note.id) {
      await (supabase as any).from("clinical_evolution_notes").update(payload).eq("id", note.id);
    } else {
      const { data } = await (supabase as any).from("clinical_evolution_notes").insert(payload).select().single();
      if (data) setNote((prev) => ({ ...prev, id: data.id }));
    }

    setSaving(false);
    toast({ title: "Nota salva" });
  };

  // ── Finalize ──
  const handleFinalize = async () => {
    if (!encounter) return;
    await handleSave();
    await (supabase as any).from("clinical_encounters").update({ status: "finalized" }).eq("id", encounter.id);
    setEncounter((prev) => prev ? { ...prev, status: "finalized" } : prev);
    toast({ title: "Consulta finalizada" });
  };

  // ── Delete encounter ──
  const handleDelete = async () => {
    if (!encounter) return;
    await Promise.all([
      (supabase as any).from("clinical_evolution_notes").delete().eq("encounter_id", encounter.id),
      (supabase as any).from("clinical_prescriptions").delete().eq("encounter_id", encounter.id),
      (supabase as any).from("patient_analyses").delete().eq("encounter_id", encounter.id),
    ]);
    const { error } = await (supabase as any).from("clinical_encounters").delete().eq("id", encounter.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Consulta excluída" });
      navigate(`/patient/${encounter.patient_id}?tab=consultas`);
    }
  };

  // ── Export PDF ──
  const handleExportEncounterPdf = async () => {
    if (!encounter || !patient) return;

    let prescriptionItems: PrescriptionItem[] = [];
    const { data: rxData } = await (supabase as any)
      .from("clinical_prescriptions")
      .select("prescription_json")
      .eq("encounter_id", encounter.id)
      .limit(1)
      .single();
    if (rxData?.prescription_json) {
      prescriptionItems = rxData.prescription_json as PrescriptionItem[];
    }

    let reviewedReport = null;
    if (v2Data && analysis?.id) {
      const { data: reviewData } = await (supabase as any)
        .from("analysis_reviews")
        .select("review_state_json")
        .eq("analysis_id", analysis.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      const reviewState = reviewData?.review_state_json ?? {};
      reviewedReport = buildReviewedReport(v2Data, reviewState);
    }

    generateEncounterPdf({
      patientName: patient.name,
      patientSex: patient.sex,
      patientBirthDate: patient.birth_date
        ? format(parseISO(patient.birth_date), "dd/MM/yyyy")
        : null,
      encounterDate: format(parseISO(encounter.encounter_date), "dd/MM/yyyy"),
      specialtyName,
      status: encounter.status,
      chiefComplaint: encounter.chief_complaint,
      soap: {
        subjective: note.subjective || null,
        objective: note.objective || null,
        assessment: note.assessment || null,
        plan: note.plan || null,
        exams_requested: note.exams_requested || null,
        medications: note.medications || null,
        free_notes: note.free_notes || null,
      },
      reviewedReport,
      prescriptionItems,
      relevantMarkers,
    });

    toast({ title: "PDF da consulta gerado" });
  };

  // ── Generate AI analysis ──
  const handleGenerateEncounterAnalysis = async () => {
    if (!patient || !encounter || !user?.id) return;
    setIsGeneratingAnalysis(true);
    toast({ title: "Gerando análise IA...", description: "Aguarde alguns segundos." });

    try {
      const [linkedLabRes, linkedBodyRes, linkedImgRes, allSessionsRes] = await Promise.all([
        (supabase as any)
          .from("lab_sessions")
          .select("id, session_date, encounter_id")
          .eq("patient_id", patient.id)
          .order("session_date", { ascending: false }),
        (supabase as any)
          .from("body_composition_sessions")
          .select("id")
          .eq("encounter_id", encounter.id),
        (supabase as any)
          .from("imaging_reports")
          .select("id")
          .eq("encounter_id", encounter.id),
        (supabase as any)
          .from("lab_sessions")
          .select("id, session_date")
          .eq("patient_id", patient.id)
          .order("session_date", { ascending: false }),
      ]);

      const allSessions = allSessionsRes.data ?? [];
      const linkedLabSessions = (linkedLabRes.data ?? []).filter((s: any) => s.encounter_id === encounter.id);
      const sessionsForAnalysis = linkedLabSessions.length > 0 ? linkedLabSessions : allSessions;

      if (sessionsForAnalysis.length === 0) {
        toast({ title: "Sem dados", description: "Nenhuma sessão de exames encontrada para este paciente.", variant: "destructive" });
        setIsGeneratingAnalysis(false);
        return;
      }

      const sessionIds = sessionsForAnalysis.map((s: any) => s.id);
      const { data: labData } = await supabase.from("lab_results").select("*").in("session_id", sessionIds);
      const results = (labData || []).map((r) => {
        const marker = MARKERS.find((m) => m.id === r.marker_id);
        const unit = marker?.unit ?? "";
        // Compute status to avoid undefined reaching backend .toUpperCase()
        let status: string = "unknown";
        if (r.text_value && r.value == null) {
          status = "qualitative";
        } else if (r.value != null && marker) {
          const fMin = marker.functionalMin;
          const fMax = marker.functionalMax;
          if (fMin != null && r.value < fMin) status = "low";
          else if (fMax != null && r.value > fMax) status = "high";
          else status = "normal";
        }
        return {
          ...r,
          marker_name: marker?.name ?? r.marker_id,
          category: marker?.category ?? "Outros",
          unit,
          status,
        };
      });

      if (results.length === 0) {
        toast({ title: "Sem dados", description: "Nenhum resultado laboratorial encontrado.", variant: "destructive" });
        setIsGeneratingAnalysis(false);
        return;
      }

      const encounterContext = {
        encounter_id: encounter.id,
        encounter_date: encounter.encounter_date,
        soap: {
          chief_complaint: encounter.chief_complaint,
          subjective: note.subjective || null,
          objective: note.objective || null,
          assessment: note.assessment || null,
          plan: note.plan || null,
          exams_requested: note.exams_requested || null,
          medications: note.medications || null,
          free_notes: note.free_notes || null,
        },
        linked_lab_session_ids: linkedLabSessions.map((s: any) => s.id),
        linked_body_composition_ids: (linkedBodyRes.data ?? []).map((b: any) => b.id),
        linked_imaging_report_ids: (linkedImgRes.data ?? []).map((i: any) => i.id),
      };

      const { data: analysisData, error } = await supabase.functions.invoke("analyze-lab-results", {
        body: {
          patient_id: patient.id,
          patient_name: patient.name,
          sex: patient.sex,
          birth_date: patient.birth_date,
          sessions: sessionsForAnalysis.map((s: any) => ({ id: s.id, session_date: s.session_date })),
          results,
          mode: "full",
          specialty_id: encounter.specialty_id,
          encounter_context: encounterContext,
        },
      });
      if (error) throw error;

      const analysisResult = analysisData?.analysis;
      const v2 = analysisData?.analysis_v2 as AnalysisV2Data | undefined;
      const sourceContext = buildSourceContext({
        sessions: sessionsForAnalysis.map((s: any) => ({ id: s.id, session_date: s.session_date })),
        labResultCount: results.length,
      });

      const { data: savedData, error: saveErr } = await (supabase as any)
        .from("patient_analyses")
        .insert({
          patient_id: patient.id,
          practitioner_id: user.id,
          specialty_id: encounter.specialty_id,
          specialty_name: specialtyName,
          mode: "full",
          summary: analysisResult?.summary ?? null,
          patterns: analysisResult?.patterns ?? [],
          trends: analysisResult?.trends ?? [],
          suggestions: analysisResult?.suggestions ?? [],
          full_text: analysisResult?.full_text ?? null,
          technical_analysis: analysisResult?.technical_analysis ?? null,
          patient_plan: analysisResult?.patient_plan ?? null,
          prescription_table: analysisResult?.prescription_table ?? [],
          protocol_recommendations: analysisResult?.protocol_recommendations ?? [],
          encounter_id: encounter.id,
          source_context: sourceContext,
          generated_at: sourceContext.generated_at,
          model_used: analysisData?.model_used ?? null,
        })
        .select()
        .single();

      if (saveErr) {
        console.error("[EncounterWorkspace] Failed to save analysis:", saveErr);
        toast({ title: "Análise gerada mas falhou ao salvar", description: saveErr.message, variant: "destructive" });
        return null;
      }

      if (savedData && v2) {
        const { error: v2Err } = await (supabase as any)
          .from("patient_analyses")
          .update({ analysis_v2_data: v2 })
          .eq("id", savedData.id);
        if (v2Err) {
          console.error("[EncounterWorkspace] Failed to save V2 data:", v2Err);
        } else {
          savedData.analysis_v2_data = v2;
        }
      }

      if (savedData) {
        setAnalysis(savedData);
        if (v2) setV2Data(v2);
        setStalenessReasons([]);
      }

      toast({ title: "Análise IA gerada", description: "A análise foi vinculada a esta consulta." });
      return "ia"; // signal to switch to IA tab
    } catch (err: any) {
      console.error("[EncounterWorkspace] AI analysis error:", err);
      toast({ title: "Erro ao gerar análise", description: err.message || "Tente novamente.", variant: "destructive" });
      return null;
    } finally {
      setIsGeneratingAnalysis(false);
    }
  };

  return {
    saving,
    isGeneratingAnalysis,
    showGenerateDialog, setShowGenerateDialog,
    handleSave,
    handleFinalize,
    handleDelete,
    handleExportEncounterPdf,
    handleGenerateEncounterAnalysis,
  };
}
