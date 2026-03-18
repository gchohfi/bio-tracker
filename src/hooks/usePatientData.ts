import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { AnalysisV2Data } from "@/components/ClinicalReportV2";
import type { Tables } from "@/integrations/supabase/types";

export type Patient = Tables<"patients">;
export type LabSession = Tables<"lab_sessions">;
export type LabResult = Tables<"lab_results">;

export type SessionSummary = {
  total: number;
  flagged: Array<{ name: string; flag: string }>;
  quality: number | null;
};

export type SpecialtyOption = {
  specialty_id: string;
  specialty_name: string;
  specialty_icon: string;
  has_protocols: boolean;
};

export type EncounterFilterItem = {
  id: string;
  encounter_date: string;
  chief_complaint: string | null;
};

export function usePatientData(patientId: string | undefined) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionSummaries, setSessionSummaries] = useState<Record<string, SessionSummary>>({});
  const [savedAnalyses, setSavedAnalyses] = useState<any[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [encountersForFilter, setEncountersForFilter] = useState<EncounterFilterItem[]>([]);
  const [analysisV2Map, setAnalysisV2Map] = useState<Record<string, AnalysisV2Data>>({});
  const [availableSpecialties, setAvailableSpecialties] = useState<SpecialtyOption[]>([]);

  const sex = useMemo(() => (patient?.sex as "M" | "F") ?? "M", [patient]);

  // ── Initial data fetch ────────────────────────────────────────────
  useEffect(() => {
    if (!patientId) return;
    fetchAllInitialData();
  }, [patientId]);

  const fetchAllInitialData = async () => {
    setLoading(true);
    const [patientRes, sessionsRes, specialtiesRes, analysesRes, encountersRes] = await Promise.all([
      supabase.from("patients").select("*").eq("id", patientId!).single(),
      supabase.from("lab_sessions").select("*").eq("patient_id", patientId!).order("session_date", { ascending: false }),
      (supabase as any).from("analysis_prompts").select("specialty_id, specialty_name, specialty_icon, has_protocols").eq("is_active", true).order("specialty_name"),
      (supabase as any).from("patient_analyses").select("id, patient_id, specialty_id, specialty_name, mode, summary, full_text, technical_analysis, patient_plan, patterns, trends, suggestions, prescription_table, protocol_recommendations, analysis_v2_data, encounter_id, model_used, created_at, updated_at").eq("patient_id", patientId!).order("created_at", { ascending: false }),
      user?.id ? (supabase as any).from("clinical_encounters").select("id, encounter_date, chief_complaint").eq("patient_id", patientId!).eq("practitioner_id", user.id).order("encounter_date", { ascending: false }) : Promise.resolve({ data: [] }),
    ]);

    if (patientRes.error) {
      toast({ title: "Erro", description: patientRes.error.message, variant: "destructive" });
      navigate("/");
      return;
    }
    setPatient(patientRes.data);
    setSessions(sessionsRes.data || []);

    if (specialtiesRes.data?.length > 0) setAvailableSpecialties(specialtiesRes.data);

    if (analysesRes.data) {
      setSavedAnalyses(analysesRes.data);
      if (analysesRes.data.length > 0) setSelectedAnalysis(analysesRes.data[0]);
      const v2Entries: Record<string, AnalysisV2Data> = {};
      for (const a of analysesRes.data) {
        if (a.analysis_v2_data) v2Entries[a.id] = a.analysis_v2_data as AnalysisV2Data;
      }
      if (Object.keys(v2Entries).length > 0) setAnalysisV2Map(prev => ({ ...prev, ...v2Entries }));
    }

    setEncountersForFilter(encountersRes.data ?? []);
    setLoading(false);
  };

  // ── Refresh patient + sessions (after mutations) ──────────────────
  const refreshPatientAndSessions = async () => {
    setLoading(true);
    const [patientRes, sessionsRes] = await Promise.all([
      supabase.from("patients").select("*").eq("id", patientId!).single(),
      supabase.from("lab_sessions").select("*").eq("patient_id", patientId!).order("session_date", { ascending: false }),
    ]);
    if (patientRes.error) {
      toast({ title: "Erro", description: patientRes.error.message, variant: "destructive" });
      navigate("/");
      return;
    }
    setPatient(patientRes.data);
    setSessions(sessionsRes.data || []);
    setLoading(false);
  };

  // ── Reload analyses ───────────────────────────────────────────────
  const reloadAnalyses = async () => {
    if (!patientId) return;
    const { data } = await (supabase as any)
      .from("patient_analyses")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    if (data) {
      setSavedAnalyses(data);
      if (data.length > 0) setSelectedAnalysis(data[0]);
      const v2Entries: Record<string, AnalysisV2Data> = {};
      for (const a of data) {
        if (a.analysis_v2_data) v2Entries[a.id] = a.analysis_v2_data as AnalysisV2Data;
      }
      if (Object.keys(v2Entries).length > 0) setAnalysisV2Map(prev => ({ ...prev, ...v2Entries }));
    }
  };

  // ── Session summaries ─────────────────────────────────────────────
  useEffect(() => {
    if (sessions.length === 0) return;
    const loadSummaries = async () => {
      const sessionIds = sessions.map(s => s.id);
      const { data: results } = await supabase
        .from("lab_results")
        .select("session_id, marker_id, value, text_value")
        .in("session_id", sessionIds);
      const { data: histResults } = await (supabase as any)
        .from("lab_historical_results")
        .select("session_id, marker_name, value, flag")
        .in("session_id", sessionIds)
        .in("flag", ["high", "low", "critical_high", "critical_low"])
        .limit(200);

      const summaries: Record<string, SessionSummary> = {};
      for (const s of sessions) {
        const sessionResults = (results ?? []).filter(r => r.session_id === s.id);
        const sessionFlagged = (histResults ?? [])
          .filter((r: any) => r.session_id === s.id && r.marker_name)
          .slice(0, 3)
          .map((r: any) => ({ name: r.marker_name, flag: r.flag }));
        summaries[s.id] = {
          total: sessionResults.length,
          flagged: sessionFlagged,
          quality: s.quality_score,
        };
      }
      setSessionSummaries(summaries);
    };
    loadSummaries();
  }, [sessions]);

  return {
    patient,
    setPatient,
    sessions,
    loading,
    sex,
    sessionSummaries,
    savedAnalyses,
    setSavedAnalyses,
    selectedAnalysis,
    setSelectedAnalysis,
    encountersForFilter,
    analysisV2Map,
    setAnalysisV2Map,
    availableSpecialties,
    refreshPatientAndSessions,
    reloadAnalyses,
  };
}
