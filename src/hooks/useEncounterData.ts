/**
 * useEncounterData — Loads all data for the EncounterWorkspace page.
 * Extracted from EncounterWorkspace to separate data fetching from UI.
 */
import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { detectStaleness, buildSourceContext, type AnalysisSourceContext } from "@/lib/analysisSourceContext";
import { MARKERS } from "@/lib/markers";
import type { AnalysisV2Data } from "@/components/ClinicalReportV2";

// ── Types ──

export interface Encounter {
  id: string;
  encounter_date: string;
  status: "draft" | "finalized";
  chief_complaint: string | null;
  specialty_id: string;
  patient_id: string;
  practitioner_id: string;
  created_at: string;
  updated_at: string;
}

export interface EvolutionNote {
  id?: string;
  encounter_id: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  exams_requested: string;
  medications: string;
  free_notes: string;
}

export interface Patient {
  id: string;
  name: string;
  sex: string;
  birth_date: string | null;
}

export interface RelevantMarker {
  marker_name: string;
  value: number | null;
  text_value: string | null;
  flag: string | null;
}

export const EMPTY_NOTE: Omit<EvolutionNote, "encounter_id"> = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  exams_requested: "",
  medications: "",
  free_notes: "",
};

export interface StepStatus {
  exams: boolean;
  soap: boolean;
  analysis: boolean;
  prescription: boolean;
  finalized: boolean;
}

export function useEncounterData(patientId?: string, encounterId?: string) {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [note, setNote] = useState<EvolutionNote & { id?: string }>({ encounter_id: "", ...EMPTY_NOTE });
  const [analysis, setAnalysis] = useState<any>(null);
  const [v2Data, setV2Data] = useState<AnalysisV2Data | null>(null);
  const [relevantMarkers, setRelevantMarkers] = useState<RelevantMarker[]>([]);
  const [lastSessionDate, setLastSessionDate] = useState<string | null>(null);
  const [specialtyName, setSpecialtyName] = useState<string>("");
  const [stalenessReasons, setStalenessReasons] = useState<string[]>([]);
  const [allLabSessionIds, setAllLabSessionIds] = useState<string[]>([]);
  const [linkedExamsCount, setLinkedExamsCount] = useState(0);
  const [hasPrescription, setHasPrescription] = useState(false);

  const isFinalized = encounter?.status === "finalized";
  const hasNote = !!(note.subjective || note.objective || note.assessment || note.plan);

  const stepStatus: StepStatus = useMemo(() => ({
    exams: linkedExamsCount > 0,
    soap: hasNote,
    analysis: !!v2Data,
    prescription: hasPrescription,
    finalized: !!isFinalized,
  }), [linkedExamsCount, hasNote, v2Data, hasPrescription, isFinalized]);

  const loadData = useCallback(async () => {
    if (!user?.id || !patientId || !encounterId) return;
    setLoading(true);

    const [patientRes, encounterRes, noteRes, analysisRes, sessionsRes, specialtyRes, linkedLabRes, linkedBodyRes, linkedImgRes, prescriptionRes] = await Promise.all([
      supabase.from("patients").select("id, name, sex, birth_date").eq("id", patientId).single(),
      (supabase as any).from("clinical_encounters").select("*").eq("id", encounterId).single(),
      (supabase as any).from("clinical_evolution_notes").select("*").eq("encounter_id", encounterId).single(),
      (supabase as any).from("patient_analyses").select("*").eq("encounter_id", encounterId).order("created_at", { ascending: false }).limit(1),
      (supabase as any).from("lab_sessions").select("id, session_date").eq("patient_id", patientId).order("session_date", { ascending: false }),
      (supabase as any).from("analysis_prompts").select("specialty_id, specialty_name").eq("is_active", true),
      (supabase as any).from("lab_sessions").select("id", { count: "exact", head: true }).eq("encounter_id", encounterId),
      (supabase as any).from("body_composition_sessions").select("id", { count: "exact", head: true }).eq("encounter_id", encounterId),
      (supabase as any).from("imaging_reports").select("id", { count: "exact", head: true }).eq("encounter_id", encounterId),
      (supabase as any).from("clinical_prescriptions").select("id", { count: "exact", head: true }).eq("encounter_id", encounterId),
    ]);

    if (patientRes.data) setPatient(patientRes.data as Patient);
    if (encounterRes.data) setEncounter(encounterRes.data as Encounter);
    if (noteRes.data) {
      setNote(noteRes.data as EvolutionNote & { id?: string });
    } else {
      setNote({ encounter_id: encounterId, ...EMPTY_NOTE });
    }

    setLinkedExamsCount((linkedLabRes.count ?? 0) + (linkedBodyRes.count ?? 0) + (linkedImgRes.count ?? 0));
    setHasPrescription((prescriptionRes.count ?? 0) > 0);

    const allSessions = sessionsRes.data ?? [];
    setAllLabSessionIds(allSessions.map((s: any) => s.id));
    if (allSessions.length > 0) {
      setLastSessionDate(allSessions[0].session_date);
    }

    const analyses = analysisRes.data ?? [];
    let loadedAnalysis: any = null;
    if (analyses.length > 0) {
      const a = analyses[0];
      loadedAnalysis = a;
      setAnalysis(a);
      if (a.analysis_v2_data) {
        try {
          const parsed = typeof a.analysis_v2_data === "string" ? JSON.parse(a.analysis_v2_data) : a.analysis_v2_data;
          setV2Data(parsed);
        } catch { setV2Data(null); }
      }
    }

    if (loadedAnalysis?.source_context) {
      const sc = loadedAnalysis.source_context as AnalysisSourceContext;
      const reasons = detectStaleness(sc, {
        latestLabSessionDate: allSessions[0]?.session_date ?? null,
        labSessionIds: allSessions.map((s: any) => s.id),
      });
      setStalenessReasons(reasons);
    } else {
      setStalenessReasons([]);
    }

    if (encounterRes.data && specialtyRes.data) {
      const sp = (specialtyRes.data as any[]).find((s: any) => s.specialty_id === encounterRes.data.specialty_id);
      setSpecialtyName(sp?.specialty_name ?? encounterRes.data.specialty_id);
    }

    if (allSessions.length > 0) {
      const { data: results } = await (supabase as any)
        .from("lab_historical_results")
        .select("marker_name, value, text_value, flag")
        .eq("session_id", allSessions[0].id)
        .in("flag", ["high", "low", "critical_high", "critical_low"])
        .limit(8);
      setRelevantMarkers((results ?? []) as RelevantMarker[]);
    }

    setLoading(false);
  }, [patientId, encounterId, user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  return {
    loading,
    patient,
    encounter, setEncounter,
    note, setNote,
    analysis, setAnalysis,
    v2Data, setV2Data,
    relevantMarkers,
    lastSessionDate,
    specialtyName,
    stalenessReasons, setStalenessReasons,
    allLabSessionIds,
    linkedExamsCount,
    hasPrescription,
    isFinalized: isFinalized ?? false,
    hasNote,
    stepStatus,
    loadData,
  };
}
