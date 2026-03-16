import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import AISidePanel from "@/components/AISidePanel";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { detectStaleness, type AnalysisSourceContext } from "@/lib/analysisSourceContext";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Brain,
  FlaskConical,
  Stethoscope,
  CalendarIcon,
  Loader2,
  ChevronRight,
  FileText,
  Pill,
  ClipboardList,
  LayoutDashboard,
  AlertTriangle,
  RefreshCw,
  Info,
  Trash2,
} from "lucide-react";
import { EncounterPrescriptionEditor } from "@/components/EncounterPrescriptionEditor";
import ClinicalReportV2, { type AnalysisV2Data } from "@/components/ClinicalReportV2";
import { PreviousEncounterContext } from "@/components/encounter/PreviousEncounterContext";

// ── Types ──

interface Encounter {
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

interface EvolutionNote {
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

interface Patient {
  id: string;
  name: string;
  sex: string;
  birth_date: string | null;
}

interface RelevantMarker {
  marker_name: string;
  value: number | null;
  text_value: string | null;
  flag: string | null;
}

const EMPTY_NOTE: Omit<EvolutionNote, "encounter_id"> = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  exams_requested: "",
  medications: "",
  free_notes: "",
};

// ══════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════

export default function EncounterWorkspace() {
  const { id: patientId, encounterId } = useParams<{ id: string; encounterId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  // ── State ──
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [note, setNote] = useState<EvolutionNote & { id?: string }>({ encounter_id: "", ...EMPTY_NOTE });
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState<any>(null);
  const [v2Data, setV2Data] = useState<AnalysisV2Data | null>(null);
  const [relevantMarkers, setRelevantMarkers] = useState<RelevantMarker[]>([]);
  const [lastSessionDate, setLastSessionDate] = useState<string | null>(null);
  const [specialtyName, setSpecialtyName] = useState<string>("");
  const [subTab, setSubTab] = useState("resumo");
  const [stalenessReasons, setStalenessReasons] = useState<string[]>([]);
  const [allLabSessionIds, setAllLabSessionIds] = useState<string[]>([]);

  const isFinalized = encounter?.status === "finalized";

  // ── Load all data ──
  const loadData = useCallback(async () => {
    if (!user?.id || !patientId || !encounterId) return;
    setLoading(true);

    const [patientRes, encounterRes, noteRes, analysisRes, sessionsRes, specialtyRes] = await Promise.all([
      supabase.from("patients").select("id, name, sex, birth_date").eq("id", patientId).single(),
      (supabase as any).from("clinical_encounters").select("*").eq("id", encounterId).single(),
      (supabase as any).from("clinical_evolution_notes").select("*").eq("encounter_id", encounterId).single(),
      (supabase as any).from("patient_analyses").select("*").eq("encounter_id", encounterId).order("created_at", { ascending: false }).limit(1),
      (supabase as any).from("lab_sessions").select("id, session_date").eq("patient_id", patientId).order("session_date", { ascending: false }),
      (supabase as any).from("analysis_prompts").select("specialty_id, specialty_name").eq("is_active", true),
    ]);

    if (patientRes.data) setPatient(patientRes.data as Patient);
    if (encounterRes.data) setEncounter(encounterRes.data as Encounter);
    if (noteRes.data) {
      setNote(noteRes.data as EvolutionNote & { id?: string });
    } else {
      setNote({ encounter_id: encounterId, ...EMPTY_NOTE });
    }

    // All lab sessions for staleness check
    const allSessions = sessionsRes.data ?? [];
    setAllLabSessionIds(allSessions.map((s: any) => s.id));
    if (allSessions.length > 0) {
      setLastSessionDate(allSessions[0].session_date);
    }

    // Analysis linked to this encounter
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

    // Staleness detection
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

    // Specialty name
    if (encounterRes.data && specialtyRes.data) {
      const sp = (specialtyRes.data as any[]).find((s: any) => s.specialty_id === encounterRes.data.specialty_id);
      setSpecialtyName(sp?.specialty_name ?? encounterRes.data.specialty_id);
    }

    // Relevant markers from most recent session
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
    // Delete related records first (evolution notes, prescriptions, analyses)
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


  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!encounter || !patient) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-12 text-center space-y-4">
          <p className="text-muted-foreground">Consulta não encontrada.</p>
          <Button variant="outline" onClick={() => navigate(`/patient/${patientId}`)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar ao paciente
          </Button>
        </div>
      </AppLayout>
    );
  }

  // ── Derived ──
  const redFlags = v2Data?.red_flags ?? [];

  return (
    <AppLayout>
      <div className="flex gap-0">
        {/* ══════════════════════════════════════════════
            MAIN COLUMN
           ══════════════════════════════════════════════ */}
        <div className="flex-1 min-w-0 space-y-4 py-4 px-2 sm:px-4">

          {/* ── Breadcrumb ── */}
          <Breadcrumb>
            <BreadcrumbList className="text-xs">
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">Dashboard</button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <button onClick={() => navigate(`/patient/${patientId}`)} className="hover:text-foreground transition-colors">{patient.name}</button>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Consulta</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* ── HEADER ── */}
          <Card>
            <CardContent className="py-4 px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 shrink-0">
                    <Stethoscope className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-base font-semibold text-foreground truncate">{patient.name}</h1>
                      <Badge variant={isFinalized ? "default" : "outline"} className="text-[10px] shrink-0">
                        {isFinalized ? "Finalizada" : "Rascunho"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {format(parseISO(encounter.encounter_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                      <span>•</span>
                      <span>{specialtyName}</span>
                      {encounter.chief_complaint && (
                        <>
                          <span>•</span>
                          <span className="truncate max-w-[300px]" title={encounter.chief_complaint}>{encounter.chief_complaint}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!isFinalized && (
                    <>
                      <Button size="sm" variant="outline" onClick={handleSave} disabled={saving} className="gap-1.5">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Salvar
                      </Button>
                      <Button size="sm" onClick={handleFinalize} className="gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Finalizar
                      </Button>
                    </>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 gap-1.5">
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Excluir</span>
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir consulta?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação é irreversível. A consulta, notas SOAP, prescrições e análises vinculadas serão removidas permanentemente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

              {/* Red flags banner */}
              {redFlags.length > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="text-xs text-destructive space-y-0.5">
                    {redFlags.slice(0, 2).map((rf: any, i: number) => (
                      <div key={rf.id ?? i}>
                        <span className="font-medium">{rf.finding}</span>
                        {rf.suggested_action && <span className="text-destructive/70"> — {rf.suggested_action}</span>}
                      </div>
                    ))}
                    {redFlags.length > 2 && (
                      <span className="text-destructive/60">+{redFlags.length - 2} alerta{redFlags.length - 2 > 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
              )}

              {/* Staleness banner */}
              {stalenessReasons.length > 0 && (
                <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                  <Info className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                    <span className="font-medium">Dados novos disponíveis desde a última análise:</span>
                    {stalenessReasons.map((r, i) => (
                      <div key={i}>• {r}</div>
                    ))}
                    <div className="mt-1 text-amber-600/70 dark:text-amber-500/70">
                      Considere regenerar a análise para incorporar os dados mais recentes.
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── SUB-TABS ── */}
          <Tabs value={subTab} onValueChange={setSubTab}>
            <div className="overflow-x-auto -mx-1 px-1">
              <TabsList className="w-max">
                <TabsTrigger value="resumo" className="gap-1.5 text-xs">
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Resumo
                </TabsTrigger>
                <TabsTrigger value="soap" className="gap-1.5 text-xs">
                  <FileText className="h-3.5 w-3.5" />
                  Evolução
                </TabsTrigger>
                <TabsTrigger value="prescricao" className="gap-1.5 text-xs">
                  <Pill className="h-3.5 w-3.5" />
                  Prescrição
                </TabsTrigger>
                <TabsTrigger value="exames" className="gap-1.5 text-xs">
                  <FlaskConical className="h-3.5 w-3.5" />
                  Exames
                </TabsTrigger>
                {v2Data && (
                  <TabsTrigger value="ia" className="gap-1.5 text-xs">
                    <Brain className="h-3.5 w-3.5" />
                    IA Completa
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* ═══ RESUMO ═══ */}
            <TabsContent value="resumo" className="mt-4 space-y-4">
              {/* Quick overview cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* SOAP preview */}
                <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSubTab("soap")}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium">Evolução Clínica</span>
                      {note.subjective || note.objective || note.assessment || note.plan ? (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1">Preenchida</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] h-4 px-1">Pendente</Badge>
                      )}
                    </div>
                    {note.assessment ? (
                      <p className="text-[11px] text-foreground/70 line-clamp-2">{note.assessment}</p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">Clique para preencher</p>
                    )}
                  </CardContent>
                </Card>

                {/* Prescription preview */}
                <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => setSubTab("prescricao")}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Pill className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium">Prescrição</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Ver ou editar prescrição da consulta</p>
                  </CardContent>
                </Card>
              </div>

              {/* Relevant exams inline */}
              {(relevantMarkers.length > 0 || lastSessionDate) && (
                <Card>
                  <CardContent className="py-3 px-5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-3.5 w-3.5 text-primary" />
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                          Exames Relevantes
                        </span>
                      </div>
                      {lastSessionDate && (
                        <span className="text-[10px] text-muted-foreground">
                          Sessão: {format(parseISO(lastSessionDate), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      )}
                    </div>
                    {relevantMarkers.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {relevantMarkers.map((m, i) => (
                          <div
                            key={i}
                            className={cn(
                              "rounded-md px-2.5 py-1.5 text-[11px]",
                              m.flag?.startsWith("critical") ? "bg-destructive/10 text-destructive" : "bg-accent text-foreground"
                            )}
                          >
                            <span className="font-medium">{m.marker_name}</span>
                            <span className="ml-1 text-muted-foreground">
                              {m.value != null ? m.value : m.text_value}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Sem marcadores alterados na última sessão.</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Executive summary from AI */}
              {v2Data?.executive_summary && (
                <Card className="border-primary/20">
                  <CardContent className="py-3 px-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Resumo IA</span>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/80">{v2Data.executive_summary}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ═══ EVOLUÇÃO ═══ */}
            <TabsContent value="soap" className="mt-4 space-y-3">
              {/* Context from previous encounter */}
              {encounter && user && (
                <PreviousEncounterContext
                  patientId={patient.id}
                  currentEncounterId={encounter.id}
                  practitionerId={user.id}
                />
              )}

              <Card>
                <CardContent className="py-4 px-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Evolução Clínica</h2>
                  </div>

                  {([
                    { key: "subjective", label: "O que mudou desde a última consulta", placeholder: "Relato do paciente, evolução dos sintomas..." },
                    { key: "objective", label: "Achados objetivos relevantes", placeholder: "Exame físico, sinais vitais, dados mensuráveis..." },
                    { key: "assessment", label: "Avaliação clínica", placeholder: "Impressão diagnóstica, correlações clínicas..." },
                    { key: "plan", label: "Conduta / Plano", placeholder: "Tratamento, ajustes, orientações..." },
                  ] as const).map(({ key, label, placeholder }) => (
                    <div key={key} className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{label}</label>
                      <Textarea
                        value={(note as any)[key] || ""}
                        onChange={(e) => setNote((prev) => ({ ...prev, [key]: e.target.value }))}
                        disabled={isFinalized}
                        rows={3}
                        className="text-sm resize-y min-h-[60px]"
                        placeholder={placeholder}
                      />
                    </div>
                  ))}

                  <Separator />

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Exames pedidos / Próximos passos</label>
                    <Textarea
                      value={note.exams_requested || ""}
                      onChange={(e) => setNote((prev) => ({ ...prev, exams_requested: e.target.value }))}
                      disabled={isFinalized}
                      rows={2}
                      className="text-sm resize-y min-h-[40px]"
                      placeholder="Exames a solicitar, retorno, encaminhamentos..."
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Observações adicionais</label>
                    <Textarea
                      value={note.free_notes || ""}
                      onChange={(e) => setNote((prev) => ({ ...prev, free_notes: e.target.value }))}
                      disabled={isFinalized}
                      rows={2}
                      className="text-sm resize-y min-h-[40px]"
                      placeholder="Notas livres, lembretes..."
                    />
                  </div>

                  {!isFinalized && (
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={handleSave} disabled={saving} className="gap-1.5">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Salvar nota
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══ PRESCRIÇÃO ═══ */}
            <TabsContent value="prescricao" className="mt-4">
              <Card>
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Pill className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Prescrição</h2>
                  </div>
                  <EncounterPrescriptionEditor
                    encounterId={encounter.id}
                    patientId={patient.id}
                    specialtyId={encounter.specialty_id}
                    isFinalized={isFinalized}
                    legacyPrescription={analysis?.prescription_table as any[] | undefined}
                    patientName={patient.name}
                    practitionerName=""
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══ EXAMES RELEVANTES ═══ */}
            <TabsContent value="exames" className="mt-4 space-y-4">
              <Card>
                <CardContent className="py-4 px-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-primary" />
                      <h2 className="text-sm font-semibold text-foreground">Exames Relevantes</h2>
                    </div>
                    {lastSessionDate && (
                      <span className="text-[10px] text-muted-foreground">
                        Última sessão: {format(parseISO(lastSessionDate), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    )}
                  </div>
                  {relevantMarkers.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {relevantMarkers.map((m, i) => (
                        <div
                          key={i}
                          className={cn(
                            "rounded-md px-3 py-2 text-xs",
                            m.flag?.startsWith("critical") ? "bg-destructive/10 text-destructive" : "bg-accent text-foreground"
                          )}
                        >
                          <div className="font-medium">{m.marker_name}</div>
                          <div className="text-muted-foreground mt-0.5">
                            {m.value != null ? m.value : m.text_value}
                            {m.flag && (
                              <Badge variant="outline" className="ml-1.5 text-[8px] h-3.5 px-1">
                                {m.flag.replace("_", " ")}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Sem marcadores alterados na última sessão.</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="link"
                      size="sm"
                      className="text-xs h-auto p-0 text-primary"
                      onClick={() => navigate(`/patient/${patientId}?tab=evolutivo`)}
                    >
                      Ver evolutivo completo
                      <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-xs h-auto p-0 text-primary"
                      onClick={() => navigate(`/patient/${patientId}?tab=exames`)}
                    >
                      Ver todos os exames
                      <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ═══ IA COMPLETA ═══ */}
            {v2Data && (
              <TabsContent value="ia" className="mt-4">
                <ClinicalReportV2
                  data={v2Data}
                  patientName={patient.name}
                  analysisId={analysis?.id}
                  patientId={patient.id}
                  specialtyId={encounter.specialty_id}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* ══════════════════════════════════════════════
            SIDE PANEL — AI Assistant
           ══════════════════════════════════════════════ */}
        <AISidePanel
          analysis={analysis}
          v2Data={v2Data}
          patientId={patient.id}
          patientName={patient.name}
          onOpenFullAnalysis={() => setSubTab("ia")}
        />
      </div>
    </AppLayout>
  );
}
