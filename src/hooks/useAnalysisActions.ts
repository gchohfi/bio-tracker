import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Trace } from "@/lib/traceability";
import { buildSourceContext } from "@/lib/analysisSourceContext";
import { getMarkerStatus, MARKERS } from "@/lib/markers";
import { generatePatientReport } from "@/lib/generateReport";
import { exportPrescriptionCSV } from "@/lib/exportPrescriptionCSV";
import type { AnalysisV2Data } from "@/components/ClinicalReportV2";
import type { Patient, LabSession, SpecialtyOption } from "@/hooks/usePatientData";

const MARKER_MAP = new Map(MARKERS.map(m => [m.id, m]));

const OBJECTIVE_LABELS: Record<string, string> = {
  performance_esportiva: "Performance esportiva",
  ganho_massa: "Ganho de massa muscular",
  emagrecimento: "Emagrecimento",
  desinflamacao: "Desinflamação / dor crônica",
  energia_disposicao: "Energia e disposição",
  longevidade: "Longevidade / anti-aging",
  saude_hormonal: "Saúde hormonal",
  imunidade: "Imunidade",
  cognicao_foco: "Cognição / foco",
  saude_pele: "Saúde da pele / estética",
  sono: "Sono",
  libido: "Libido",
  recuperacao_muscular: "Recuperação muscular",
  saude_intestinal: "Saúde intestinal",
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentario: "Sedentário",
  ativo_leve: "Ativo (1–2x/semana)",
  ativo: "Ativo (3–4x/semana)",
  muito_ativo: "Muito ativo (5+x/semana)",
  atleta_amador: "Atleta amador",
  atleta_alto_rendimento: "Atleta de alto rendimento",
};

interface UseAnalysisActionsParams {
  patient: Patient | null;
  sessions: LabSession[];
  sex: "M" | "F";
  selectedSpecialty: string;
  availableSpecialties: SpecialtyOption[];
  activeEncounterId: string | null;
  savedAnalyses: any[];
  setSavedAnalyses: React.Dispatch<React.SetStateAction<any[]>>;
  selectedAnalysis: any;
  setSelectedAnalysis: React.Dispatch<React.SetStateAction<any>>;
  setAnalysisV2Map: React.Dispatch<React.SetStateAction<Record<string, AnalysisV2Data>>>;
  setDetailTab: (tab: string) => void;
}

export function useAnalysisActions({
  patient,
  sessions,
  sex,
  selectedSpecialty,
  availableSpecialties,
  activeEncounterId,
  savedAnalyses,
  setSavedAnalyses,
  selectedAnalysis,
  setSelectedAnalysis,
  setAnalysisV2Map,
  setDetailTab,
}: UseAnalysisActionsParams) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingProtocols, setIsGeneratingProtocols] = useState(false);
  const [cachedAiAnalysis, setCachedAiAnalysis] = useState<any>(null);
  const [cachedProtocols, setCachedProtocols] = useState<any[]>([]);

  const buildPatientProfile = () => {
    if (!patient) return null;
    return {
      objectives: (patient.objectives ?? []).map((id) => OBJECTIVE_LABELS[id] ?? id),
      activity_level: patient.activity_level ? ACTIVITY_LABELS[patient.activity_level] ?? patient.activity_level : null,
      sport_modality: patient.sport_modality ?? null,
      main_complaints: patient.main_complaints ?? null,
      restrictions: patient.restrictions ?? null,
    };
  };

  const buildEnrichedResults = (results: any[]) =>
    results.map((r) => {
      const marker = MARKER_MAP.get(r.marker_id);
      const session = sessions.find((s) => s.id === r.session_id);
      const status = marker ? getMarkerStatus(r.value ?? 0, marker, sex, r.text_value ?? undefined) : "normal";
      const sessionSpecialtyId = (session as any)?.specialty_id ?? selectedSpecialty;
      const isNutrologia = sessionSpecialtyId === "nutrologia";
      return {
        marker_id: r.marker_id,
        marker_name: marker?.name ?? r.marker_id,
        value: r.value,
        text_value: r.text_value,
        unit: marker?.unit ?? "",
        lab_min: marker?.labRange?.[sex]?.[0] ?? marker?.labRange?.M?.[0],
        lab_max: marker?.labRange?.[sex]?.[1] ?? marker?.labRange?.M?.[1],
        status,
        session_date: session?.session_date ?? "",
      };
    });

  const handleAiError = (err: any, title: string) => {
    const status = err?.context?.status ?? err?.status;
    if (status === 429) {
      toast({ title, description: "Limite de requisições atingido. Aguarde alguns instantes e tente novamente.", variant: "destructive" });
    } else if (status === 402) {
      toast({ title, description: "Créditos insuficientes. Verifique seu plano.", variant: "destructive" });
    } else {
      toast({ title, description: err.message || "Erro desconhecido", variant: "destructive" });
    }
  };

  const handleGenerateAnalysis = async (overrideEncounterId?: string) => {
    if (!patient) return;
    const sessionIds = sessions.map((s) => s.id);
    const { data } = await supabase.from("lab_results").select("*").in("session_id", sessionIds);
    const results = (data || []).map((r) => ({
      marker_id: r.marker_id, session_id: r.session_id,
      value: r.value ?? 0, text_value: r.text_value ?? undefined,
      lab_ref_min: r.lab_ref_min ?? undefined, lab_ref_max: r.lab_ref_max ?? undefined, lab_ref_text: r.lab_ref_text ?? undefined,
    }));
    setIsAnalyzing(true);
    toast({ title: "Gerando análise de exames...", description: "Aguarde alguns segundos." });
    try {
      const enriched = buildEnrichedResults(results);
      if (enriched.length === 0) {
        toast({ title: "Sem dados", description: "Nenhum resultado laboratorial encontrado para analisar.", variant: "destructive" });
        setIsAnalyzing(false);
        return;
      }
      const { data: analysisData, error } = await supabase.functions.invoke("analyze-lab-results", {
        body: {
          patient_id: patient.id, patient_name: patient.name, sex: patient.sex, birth_date: patient.birth_date,
          sessions: sessions.map((s) => ({ id: s.id, session_date: s.session_date })),
          results: enriched,
          mode: "full",
          patient_profile: buildPatientProfile(),
          specialty_id: selectedSpecialty,
        },
      });
      if (error) throw error;
      const analysis = analysisData?.analysis;
      const v2 = analysisData?.analysis_v2 as AnalysisV2Data | undefined;
      if (analysisData?._diagnostics) console.log("[AI Diagnostics]", analysisData._diagnostics);
      if (analysisData?._truncated) {
        toast({ title: "⚠ Análise possivelmente incompleta", description: "A resposta da IA foi truncada.", variant: "destructive" });
      }
      const merged = cachedProtocols.length > 0
        ? { ...analysis, protocol_recommendations: cachedProtocols }
        : analysis;
      setCachedAiAnalysis(merged);

      const sp = availableSpecialties.find(s => s.specialty_id === selectedSpecialty);
      const sourceContext = buildSourceContext({
        sessions: sessions.map((s) => ({ id: s.id, session_date: s.session_date })),
        labResultCount: results.length,
      });
      const { data: savedData, error: saveError } = await (supabase as any)
        .from("patient_analyses")
        .insert({
          patient_id: patient.id,
          practitioner_id: user?.id ?? null,
          specialty_id: selectedSpecialty,
          specialty_name: sp?.specialty_name ?? selectedSpecialty,
          mode: "full",
          summary: analysis?.summary ?? null,
          patterns: analysis?.patterns ?? [],
          trends: analysis?.trends ?? [],
          suggestions: analysis?.suggestions ?? [],
          full_text: analysis?.full_text ?? null,
          technical_analysis: analysis?.technical_analysis ?? null,
          patient_plan: analysis?.patient_plan ?? null,
          prescription_table: analysis?.prescription_table ?? [],
          protocol_recommendations: merged?.protocol_recommendations ?? [],
          encounter_id: overrideEncounterId ?? activeEncounterId ?? null,
          source_context: sourceContext,
          generated_at: sourceContext.generated_at,
        })
        .select()
        .single();
      if (savedData) {
        if (v2) {
          await (supabase as any).from("patient_analyses").update({ analysis_v2_data: v2 }).eq("id", savedData.id);
          savedData.analysis_v2_data = v2;
        }
        setSavedAnalyses(prev => [savedData, ...prev]);
        setSelectedAnalysis(savedData);
        setDetailTab("analysis");
        if (v2) setAnalysisV2Map(prev => ({ ...prev, [savedData.id]: v2 }));
      }
      Trace.aiAnalysis(user?.id ?? "", patient.id, selectedSpecialty, "full", analysisData?.model_used);
      toast({ title: "✅ Análise gerada e salva!", description: "Visualize na aba Análise IA." });
    } catch (err: any) {
      handleAiError(err, "Erro na análise");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateProtocols = async () => {
    if (!patient) return;
    const sessionIds = sessions.map((s) => s.id);
    const { data } = await supabase.from("lab_results").select("*").in("session_id", sessionIds);
    const results = (data || []).map((r) => ({
      marker_id: r.marker_id, session_id: r.session_id,
      value: r.value ?? 0, text_value: r.text_value ?? undefined,
      lab_ref_min: r.lab_ref_min ?? undefined, lab_ref_max: r.lab_ref_max ?? undefined, lab_ref_text: r.lab_ref_text ?? undefined,
    }));
    setIsGeneratingProtocols(true);
    toast({ title: "Gerando recomendações de protocolos...", description: "Aguarde alguns segundos." });
    try {
      const enriched = buildEnrichedResults(results);
      const { data: analysisData, error } = await supabase.functions.invoke("analyze-lab-results", {
        body: {
          patient_id: patient.id, patient_name: patient.name, sex: patient.sex, birth_date: patient.birth_date,
          sessions: sessions.map((s) => ({ id: s.id, session_date: s.session_date })),
          results: enriched,
          mode: "protocols_only",
          patient_profile: buildPatientProfile(),
        },
      });
      if (error) throw error;
      if (analysisData?._diagnostics) console.log("[AI Diagnostics]", analysisData._diagnostics);
      if (analysisData?._truncated) {
        toast({ title: "⚠ Protocolos possivelmente incompletos", description: "A resposta da IA foi truncada.", variant: "destructive" });
      }
      const protocols = analysisData?.analysis?.protocol_recommendations ?? [];
      setCachedProtocols(protocols);
      const mergedAnalysis = cachedAiAnalysis
        ? { ...cachedAiAnalysis, protocol_recommendations: protocols }
        : { protocol_recommendations: protocols };
      generatePatientReport(patient.name, sex, sessions, results, mergedAnalysis);
      toast({ title: `${protocols.length} protocolo(s) sugerido(s) exportado(s)!` });
    } catch (err: any) {
      handleAiError(err, "Erro nos protocolos");
    } finally {
      setIsGeneratingProtocols(false);
    }
  };

  const handleReportConfirm = async (updatedResults: any[]) => {
    if (!patient) return;
    if (false) { // reportWithAI handled externally
      return;
    }
    setIsAnalyzing(true);
    toast({ title: "Gerando análise completa com IA...", description: "Isso pode levar alguns segundos." });
    try {
      const enrichedResults = buildEnrichedResults(updatedResults);
      if (enrichedResults.length === 0) {
        toast({ title: "Sem dados", description: "Nenhum resultado laboratorial encontrado para analisar.", variant: "destructive" });
        setIsAnalyzing(false);
        return;
      }
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke("analyze-lab-results", {
        body: {
          patient_id: patient.id, patient_name: patient.name, sex: patient.sex, birth_date: patient.birth_date,
          sessions: sessions.map((s) => ({ id: s.id, session_date: s.session_date })),
          results: enrichedResults,
          mode: "full",
          patient_profile: buildPatientProfile(),
        },
      });
      if (analysisError) throw analysisError;
      if (analysisData?._diagnostics) console.log("[AI Diagnostics]", analysisData._diagnostics);
      if (analysisData?._truncated) {
        toast({ title: "⚠ Análise possivelmente incompleta", description: "A resposta da IA foi truncada.", variant: "destructive" });
      }
      setCachedAiAnalysis(analysisData?.analysis);
      setCachedProtocols(analysisData?.analysis?.protocol_recommendations ?? []);
      const v2Report = analysisData?.analysis_v2 as AnalysisV2Data | undefined;
      if (v2Report) {
        setAnalysisV2Map(prev => ({ ...prev, _report: v2Report }));
      }
      generatePatientReport(patient.name, sex, sessions, updatedResults, analysisData?.analysis);
      toast({ title: "Relatório completo com IA exportado!" });
    } catch (err: any) {
      handleAiError(err, "Erro na análise de IA");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteAnalysis = async (analysisId: string) => {
    const { error } = await (supabase as any).from("patient_analyses").delete().eq("id", analysisId);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Análise excluída com sucesso" });
    const updated = savedAnalyses.filter(a => a.id !== analysisId);
    setSavedAnalyses(updated);
    if (selectedAnalysis?.id === analysisId) {
      setSelectedAnalysis(updated.length > 0 ? updated[0] : null);
    }
  };

  return {
    isAnalyzing,
    isGeneratingProtocols,
    cachedAiAnalysis,
    cachedProtocols,
    buildEnrichedResults,
    buildPatientProfile,
    handleGenerateAnalysis,
    handleGenerateProtocols,
    handleReportConfirm,
    handleDeleteAnalysis,
    handleAiError,
  };
}
