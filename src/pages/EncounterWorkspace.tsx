import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  PenLine,
  Sparkles,
  Brain,
  AlertTriangle,
  TrendingUp,
  ListChecks,
  ExternalLink,
  FlaskConical,
  Stethoscope,
  CalendarIcon,
  Loader2,
  ChevronRight,
  PanelRightOpen,
  PanelRightClose,
  FileText,
  Pill,
  ClipboardList,
} from "lucide-react";
import { EncounterPrescriptionEditor } from "@/components/EncounterPrescriptionEditor";
import type { AnalysisV2Data } from "@/components/ClinicalReportV2";

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
  const [aiPanelOpen, setAiPanelOpen] = useState(!isMobile);
  const [analysis, setAnalysis] = useState<any>(null);
  const [v2Data, setV2Data] = useState<AnalysisV2Data | null>(null);
  const [relevantMarkers, setRelevantMarkers] = useState<RelevantMarker[]>([]);
  const [lastSessionDate, setLastSessionDate] = useState<string | null>(null);
  const [specialtyName, setSpecialtyName] = useState<string>("");

  const isFinalized = encounter?.status === "finalized";

  // ── Load all data ──
  const loadData = useCallback(async () => {
    if (!user?.id || !patientId || !encounterId) return;
    setLoading(true);

    // Parallel fetch: patient, encounter, note, analysis, recent exams
    const [patientRes, encounterRes, noteRes, analysisRes, sessionsRes, specialtyRes] = await Promise.all([
      supabase.from("patients").select("id, name, sex, birth_date").eq("id", patientId).single(),
      (supabase as any).from("clinical_encounters").select("*").eq("id", encounterId).single(),
      (supabase as any).from("clinical_evolution_notes").select("*").eq("encounter_id", encounterId).single(),
      (supabase as any).from("patient_analyses").select("*").eq("encounter_id", encounterId).order("created_at", { ascending: false }).limit(1),
      (supabase as any).from("lab_sessions").select("id, session_date").eq("patient_id", patientId).order("session_date", { ascending: false }).limit(1),
      (supabase as any).from("analysis_prompts").select("specialty_id, specialty_name").eq("is_active", true),
    ]);

    if (patientRes.data) setPatient(patientRes.data as Patient);
    if (encounterRes.data) setEncounter(encounterRes.data as Encounter);
    if (noteRes.data) {
      setNote(noteRes.data as EvolutionNote & { id?: string });
    } else {
      setNote({ encounter_id: encounterId, ...EMPTY_NOTE });
    }

    // Analysis linked to this encounter
    const analyses = analysisRes.data ?? [];
    if (analyses.length > 0) {
      const a = analyses[0];
      setAnalysis(a);
      if (a.analysis_v2_data) {
        try {
          const parsed = typeof a.analysis_v2_data === "string" ? JSON.parse(a.analysis_v2_data) : a.analysis_v2_data;
          setV2Data(parsed);
        } catch { setV2Data(null); }
      }
    }

    // Find specialty name
    if (encounterRes.data && specialtyRes.data) {
      const sp = (specialtyRes.data as any[]).find((s: any) => s.specialty_id === encounterRes.data.specialty_id);
      setSpecialtyName(sp?.specialty_name ?? encounterRes.data.specialty_id);
    }

    // Load relevant markers from the most recent session
    if (sessionsRes.data && sessionsRes.data.length > 0) {
      setLastSessionDate(sessionsRes.data[0].session_date);
      const { data: results } = await (supabase as any)
        .from("lab_historical_results")
        .select("marker_name, value, text_value, flag")
        .eq("session_id", sessionsRes.data[0].id)
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

  // ── Loading / error ──
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
  const topFindings = (v2Data?.clinical_findings ?? [])
    .filter((f: any) => f.priority === "critical" || f.priority === "high")
    .slice(0, 3);
  const topActions = (v2Data?.suggested_actions ?? [])
    .filter((a: any) => a.priority === "critical" || a.priority === "high")
    .slice(0, 3);
  const hasAiContent = analysis && (v2Data?.executive_summary || redFlags.length > 0 || topFindings.length > 0);

  // ── AI Side Panel content (reused in Sheet for mobile) ──
  const aiPanelContent = (
    <div className="space-y-4">
      {!hasAiContent ? (
        <div className="text-center py-8 space-y-2">
          <Brain className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">Nenhuma análise IA vinculada a esta consulta.</p>
          <p className="text-[10px] text-muted-foreground/60">
            Use "Análise IA" no prontuário do paciente para gerar.
          </p>
        </div>
      ) : (
        <>
          {/* Meta */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{specialtyName}</span>
            <span>{format(parseISO(analysis.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
          </div>

          {/* Executive Summary */}
          {v2Data?.executive_summary && (
            <p className="text-xs leading-relaxed text-foreground/90 line-clamp-4">
              {v2Data.executive_summary}
            </p>
          )}

          {/* Red Flags */}
          {redFlags.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" />
                Alertas Críticos
              </div>
              {redFlags.slice(0, 3).map((rf: any, i: number) => (
                <div key={rf.id ?? i} className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
                  <span className="font-medium">{rf.finding}</span>
                  {rf.suggested_action && (
                    <span className="text-destructive/70 ml-1">— {rf.suggested_action}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Top Findings */}
          {topFindings.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
                Achados Relevantes
              </div>
              {topFindings.map((f: any, i: number) => (
                <div key={f.id ?? i} className="text-[11px] text-foreground/70 flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  <span>
                    <span className="font-medium text-foreground/90">{f.system}:</span> {f.interpretation}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Top Actions */}
          {topActions.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                <ListChecks className="h-3.5 w-3.5 text-primary" />
                Próximos Passos
              </div>
              {topActions.map((a: any, i: number) => (
                <div key={a.id ?? i} className="text-[11px] text-foreground/70 flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">→</span>
                  <span>{a.description}</span>
                </div>
              ))}
            </div>
          )}

          {/* CTA to full analysis */}
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs h-7 gap-1.5 border-primary/20 text-primary hover:bg-primary/5"
            onClick={() => navigate(`/patient/${patientId}?tab=analysis`)}
          >
            <Brain className="h-3 w-3" />
            Ver análise completa
            <ExternalLink className="h-3 w-3" />
          </Button>
        </>
      )}
    </div>
  );

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto px-4 py-4 sm:py-6">

        {/* ── Breadcrumb ── */}
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href={`/patient/${patientId}`}>{patient.name}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Consulta</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className={cn("flex gap-6", aiPanelOpen && !isMobile ? "" : "")}>

          {/* ══════════════════════════════════════════════
              MAIN COLUMN — Vertical scroll blocks
             ══════════════════════════════════════════════ */}
          <div className={cn("flex-1 min-w-0 space-y-4", aiPanelOpen && !isMobile ? "max-w-[calc(100%-280px)]" : "")}>

            {/* ── BLOCK 1: Encounter Header ── */}
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
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* AI Panel toggle */}
                    {!isMobile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setAiPanelOpen(!aiPanelOpen)}
                        title={aiPanelOpen ? "Fechar painel IA" : "Abrir painel IA"}
                      >
                        {aiPanelOpen ? (
                          <PanelRightClose className="h-4 w-4" />
                        ) : (
                          <PanelRightOpen className="h-4 w-4" />
                        )}
                      </Button>
                    )}

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
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── BLOCK 2: Chief Complaint ── */}
            {encounter.chief_complaint && (
              <Card>
                <CardContent className="py-3 px-5">
                  <div className="flex items-center gap-2 mb-1">
                    <ClipboardList className="h-3.5 w-3.5 text-primary" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Queixa Principal</span>
                  </div>
                  <p className="text-sm text-foreground">{encounter.chief_complaint}</p>
                </CardContent>
              </Card>
            )}

            {/* ── BLOCK 3: Clinical Brief (relevant exams) ── */}
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
                  <Button
                    variant="link"
                    size="sm"
                    className="text-[11px] h-auto p-0 mt-2 text-primary"
                    onClick={() => navigate(`/patient/${patientId}?tab=evolution`)}
                  >
                    Ver evolutivo completo
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* ── BLOCK 4: SOAP Note ── */}
            <Card>
              <CardContent className="py-4 px-5 space-y-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold text-foreground">Nota SOAP</h2>
                </div>

                {(["subjective", "objective", "assessment", "plan"] as const).map((field) => {
                  const labels: Record<string, string> = {
                    subjective: "S — Subjetivo",
                    objective: "O — Objetivo",
                    assessment: "A — Avaliação",
                    plan: "P — Plano",
                  };
                  return (
                    <div key={field} className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">{labels[field]}</label>
                      <Textarea
                        value={(note as any)[field] || ""}
                        onChange={(e) => setNote((prev) => ({ ...prev, [field]: e.target.value }))}
                        disabled={isFinalized}
                        rows={3}
                        className="text-sm resize-y min-h-[60px]"
                        placeholder={`${labels[field]}...`}
                      />
                    </div>
                  );
                })}

                <Separator />

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Exames Solicitados</label>
                  <Textarea
                    value={note.exams_requested || ""}
                    onChange={(e) => setNote((prev) => ({ ...prev, exams_requested: e.target.value }))}
                    disabled={isFinalized}
                    rows={2}
                    className="text-sm resize-y min-h-[40px]"
                    placeholder="Exames a solicitar..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Notas Livres</label>
                  <Textarea
                    value={note.free_notes || ""}
                    onChange={(e) => setNote((prev) => ({ ...prev, free_notes: e.target.value }))}
                    disabled={isFinalized}
                    rows={2}
                    className="text-sm resize-y min-h-[40px]"
                    placeholder="Observações adicionais..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* ── BLOCK 5: Prescription ── */}
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
                  patientName={patient.name}
                  practitionerName=""
                />
              </CardContent>
            </Card>

            {/* ── Mobile AI button (FAB) ── */}
            {isMobile && hasAiContent && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    size="icon"
                    className="fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg z-50"
                  >
                    <Sparkles className="h-5 w-5" />
                    {redFlags.length > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center">
                        {redFlags.length}
                      </span>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
                  <SheetHeader>
                    <SheetTitle className="flex items-center gap-2 text-sm">
                      <Sparkles className="h-4 w-4 text-primary" />
                      Assistente IA
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-4">
                    {aiPanelContent}
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </div>

          {/* ══════════════════════════════════════════════
              SIDE PANEL — AI Assistant (desktop only)
             ══════════════════════════════════════════════ */}
          {aiPanelOpen && !isMobile && (
            <aside className="w-[260px] shrink-0 sticky top-20 self-start">
              <Card className="border-primary/20">
                <CardContent className="py-4 px-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-xs font-semibold text-foreground">Assistente IA</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setAiPanelOpen(false)}
                    >
                      <PanelRightClose className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  {aiPanelContent}
                </CardContent>
              </Card>
            </aside>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
