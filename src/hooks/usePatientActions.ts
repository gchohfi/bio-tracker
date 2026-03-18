import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { auditResults } from "@/lib/clinicalAudit";
import { Trace } from "@/lib/traceability";
import { format, parseISO } from "date-fns";
import { MARKERS, getMarkerStatus, type MarkerDef } from "@/lib/markers";
import type { Patient, LabSession } from "@/hooks/usePatientData";

const MARKER_MAP = new Map(MARKERS.map(m => [m.id, m]));

interface UsePatientActionsParams {
  patient: Patient | null;
  sessions: LabSession[];
  refreshPatientAndSessions: () => Promise<void>;
  ensureAuthenticated: () => Promise<boolean>;
}

export function usePatientActions({
  patient,
  sessions,
  refreshPatientAndSessions,
  ensureAuthenticated,
}: UsePatientActionsParams) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // Session form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<Date>(new Date());
  const [markerValues, setMarkerValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [sessionSpecialty, setSessionSpecialty] = useState("medicina_funcional");
  const [labRefRanges, setLabRefRanges] = useState<Record<string, { min?: number; max?: number; text?: string }>>({});
  const [importedPdfCount, setImportedPdfCount] = useState(0);
  const [extractedExamDate, setExtractedExamDate] = useState<string | null>(null);
  const [lastQualityScore, setLastQualityScore] = useState<number | null>(null);
  const [lastExtractionIssues, setLastExtractionIssues] = useState<any[]>([]);
  const [lastHistoricalResults, setLastHistoricalResults] = useState<any[]>([]);

  // Name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const openNewSession = () => {
    setSessionDate(new Date());
    setMarkerValues({});
    setImportedPdfCount(0);
    setFormOpen(true);
  };

  const openEditSession = async (session: LabSession) => {
    setEditingSessionId(session.id);
    setSessionDate(parseISO(session.session_date));
    setImportedPdfCount(0);
    const { data } = await supabase
      .from("lab_results")
      .select("*")
      .eq("session_id", session.id);

    const vals: Record<string, string> = {};
    data?.forEach((r) => {
      const marker = MARKER_MAP.get(r.marker_id);
      if (marker?.qualitative) {
        vals[r.marker_id] = r.text_value || "";
      } else if (r.text_value && /^[<>≤≥]=?\s*\d/.test(r.text_value.trim())) {
        vals[r.marker_id] = r.text_value.trim();
      } else {
        vals[r.marker_id] = String(r.value ?? "");
      }
    });
    setMarkerValues(vals);
    setFormOpen(true);
  };

  const handleSaveSession = async () => {
    if (!patient) return;
    if (!(await ensureAuthenticated())) return;
    setSaving(true);

    try {
      let sessionId = editingSessionId;
      const sex = patient.sex as "M" | "F";

      if (editingSessionId) {
        await (supabase as any)
          .from("lab_sessions")
          .update({ session_date: format(sessionDate, "yyyy-MM-dd"), specialty_id: sessionSpecialty })
          .eq("id", editingSessionId);
        await supabase.from("lab_results").delete().eq("session_id", editingSessionId);
      } else {
        const formattedDate = format(sessionDate, "yyyy-MM-dd");
        const { data: existingSession } = await (supabase as any)
          .from("lab_sessions")
          .select("id")
          .eq("patient_id", patient.id)
          .eq("session_date", formattedDate)
          .maybeSingle();

        if (existingSession) {
          sessionId = existingSession.id;
        } else {
          const { data, error } = await (supabase as any)
            .from("lab_sessions")
            .insert({ patient_id: patient.id, session_date: formattedDate, specialty_id: sessionSpecialty })
            .select()
            .single();
          if (error) throw error;
          sessionId = data.id;
        }
      }

      const allResults: { session_id: string; marker_id: string; value: number; text_value?: string; lab_ref_text?: string; lab_ref_min?: number; lab_ref_max?: number }[] = [];

      Object.entries(markerValues).forEach(([markerId, v]) => {
        if (v === "") return;
        const marker = MARKER_MAP.get(markerId);
        const labRef = labRefRanges[markerId];
        const labRefFields = labRef ? {
          lab_ref_text: labRef.text,
          lab_ref_min: labRef.min,
          lab_ref_max: labRef.max,
        } : {};

        if (marker?.qualitative) {
          allResults.push({ session_id: sessionId!, marker_id: markerId, value: 0, text_value: v, ...labRefFields });
        } else {
          const operatorMatch = v.match(/^([<>]=?)\s*(\d+[.,]?\d*)$/);
          if (operatorMatch) {
            const numericPart = Number(operatorMatch[2].replace(",", "."));
            if (!isNaN(numericPart)) {
              allResults.push({ session_id: sessionId!, marker_id: markerId, value: numericPart, text_value: v, ...labRefFields });
            }
          } else if (!isNaN(Number(v))) {
            allResults.push({ session_id: sessionId!, marker_id: markerId, value: Number(v), ...labRefFields });
          }
        }
      });

      // AUDIT
      if (allResults.length > 0) {
        const auditReport = auditResults(
          allResults.map(r => ({
            marker_id: r.marker_id,
            value: r.value || null,
            text_value: r.text_value,
            lab_ref_min: r.lab_ref_min,
            lab_ref_max: r.lab_ref_max,
            lab_ref_text: r.lab_ref_text,
          })),
          {
            context: "save_session",
            patientSex: sex === "F" ? "F" : "M",
            patientId: patient.id,
            sessionId: sessionId ?? undefined,
          }
        );

        if (auditReport.has_blocks) {
          toast({ title: "Dados bloqueados", description: "Inconsistências graves detectadas. Verifique os resultados.", variant: "destructive" });
          setSaving(false);
          return;
        }

        if (auditReport.has_errors) {
          console.warn("[AUDIT] Erros detectados mas não bloqueantes:", auditReport.issues.filter(i => i.severity === "error"));
        }

        const { error } = await supabase.from("lab_results").insert(allResults as any);
        if (error) throw error;
      }

      // Persist quality metrics
      if (sessionId && (lastQualityScore !== null || lastExtractionIssues.length > 0)) {
        await (supabase as any).from("lab_sessions").update({
          quality_score: lastQualityScore,
          extraction_issues: lastExtractionIssues,
        }).eq("id", sessionId);
      }

      // Persist historical results
      if (sessionId && lastHistoricalResults.length > 0) {
        const histRows: any[] = [];
        for (const timeline of lastHistoricalResults) {
          for (const entry of timeline.entries || []) {
            histRows.push({
              session_id: sessionId,
              marker_id: timeline.marker_id,
              marker_name: timeline.marker_name || null,
              result_date: entry.date,
              value: entry.value ?? null,
              text_value: entry.text_value || null,
              unit: entry.unit || null,
              raw_value: entry.raw_value ?? null,
              raw_unit: entry.raw_unit || null,
              raw_text_value: entry.raw_text_value || null,
              raw_ref_text: entry.raw_ref_text || timeline.reference_text || null,
              reference_text: timeline.reference_text || null,
              conversion_applied: entry.conversion_applied || false,
              conversion_reason: entry.conversion_reason || null,
              source_type: entry.source_type || "evolution_page",
              source_lab: entry.source_lab || null,
              source_document: entry.source_document || null,
              flag: entry.flag || null,
            });
          }
        }
        if (histRows.length > 0) {
          await supabase.from("lab_historical_results").delete().eq("session_id", sessionId);
          const { error: histError } = await supabase.from("lab_historical_results").insert(histRows as any);
          if (histError) console.error("Historical results persist error:", histError);
          else console.log(`Persisted ${histRows.length} historical entries for session ${sessionId}`);
        }
      }

      Trace.sessionSave(user?.id ?? "", patient.id, sessionId!, allResults.length, !!editingSessionId);
      toast({ title: editingSessionId ? "Sessão atualizada!" : "Sessão criada!" });
      setFormOpen(false);
      refreshPatientAndSessions();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    await supabase.from("lab_historical_results").delete().eq("session_id", sessionId);
    const { error: resultsError } = await supabase.from("lab_results").delete().eq("session_id", sessionId);
    if (resultsError) {
      toast({ title: "Erro ao excluir resultados", description: resultsError.message, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("lab_sessions").delete().eq("id", sessionId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sessão excluída!" });
      refreshPatientAndSessions();
    }
  };

  const handleEditName = () => {
    if (!patient) return;
    setNameValue(patient.name);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!patient || !nameValue.trim()) return;
    const { error } = await supabase.from("patients").update({ name: nameValue.trim() }).eq("id", patient.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Nome atualizado!" });
    }
    setEditingName(false);
    refreshPatientAndSessions();
  };

  const handleSaveProfile = async (profile: {
    objectives: string[] | null;
    activity_level: string | null;
    sport_modality: string | null;
    main_complaints: string | null;
    restrictions: string | null;
  }) => {
    if (!patient) return;
    const { error } = await supabase.from("patients").update(profile).eq("id", patient.id);
    if (error) {
      toast({ title: "Erro ao salvar perfil", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Perfil salvo!", description: "As recomendações de protocolos usarão este perfil." });
      refreshPatientAndSessions();
    }
  };

  const handleDeletePatient = async () => {
    if (!patient) return;
    const { error } = await supabase.from("patients").delete().eq("id", patient.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Paciente excluído!" });
      navigate("/");
    }
  };

  return {
    // Session form state
    formOpen,
    setFormOpen,
    editingSessionId,
    sessionDate,
    setSessionDate,
    markerValues,
    setMarkerValues,
    saving,
    sessionSpecialty,
    setSessionSpecialty,
    labRefRanges,
    setLabRefRanges,
    importedPdfCount,
    setImportedPdfCount,
    extractedExamDate,
    setExtractedExamDate,
    lastQualityScore,
    setLastQualityScore,
    lastExtractionIssues,
    setLastExtractionIssues,
    lastHistoricalResults,
    setLastHistoricalResults,
    // Name editing
    editingName,
    setEditingName,
    nameValue,
    setNameValue,
    // Actions
    openNewSession,
    openEditSession,
    handleSaveSession,
    handleDeleteSession,
    handleEditName,
    handleSaveName,
    handleSaveProfile,
    handleDeletePatient,
  };
}
