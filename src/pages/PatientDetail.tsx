import { useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft, Plus, CalendarIcon, Save, Trash2, FlaskConical, Edit2, FileText,
  BarChart3, FileUp, Loader2, FileDown, Pencil, Check, X, Sparkles, Settings2,
  UserCircle2, Brain, Syringe, Sliders, ClipboardList, Stethoscope, Scale,
  FileImage, Clock, ChevronRight, MoreVertical, AlertTriangle,
} from "lucide-react";
import EvolutionTable from "@/components/EvolutionTable";
import EvolutionTimeline from "@/components/EvolutionTimeline";
import ImportVerification from "@/components/ImportVerification";
import EditExtractionDialog from "@/components/EditExtractionDialog";
import EditReportDialog from "@/components/EditReportDialog";
import AliasConfigDialog from "@/components/AliasConfigDialog";
import { PatientProfileDialog } from "@/components/PatientProfileDialog";
import { AnamneseTab } from "@/components/AnamneseTab";
import { ClinicalEvolutionTab } from "@/components/ClinicalEvolutionTab";
import { BodyCompositionTab } from "@/components/BodyCompositionTab";
import { ImagingReportsTab } from "@/components/ImagingReportsTab";
import PatientChatPanel from "@/components/PatientChatPanel";
import AISidePanel from "@/components/AISidePanel";
import AISummaryPanel from "@/components/AISummaryPanel";
import PatientClinicalBrief from "@/components/PatientClinicalBrief";
import { generatePatientReport } from "@/lib/generateReport";
import { exportPrescriptionCSV } from "@/lib/exportPrescriptionCSV";
import ClinicalReportV2, { type AnalysisV2Data } from "@/components/ClinicalReportV2";
import { MarkerInput } from "@/components/MarkerInput";
import {
  CATEGORIES, CATEGORY_COLORS, MARKERS, getMarkersByCategory,
  type Category,
} from "@/lib/markers";

// ── Extracted hooks ──────────────────────────────────────────────────
import { usePatientData } from "@/hooks/usePatientData";
import { usePatientActions } from "@/hooks/usePatientActions";
import { useAnalysisActions } from "@/hooks/useAnalysisActions";
import { usePdfImport } from "@/hooks/usePdfImport";
import { usePatientTabs, TAB_LABELS } from "@/hooks/usePatientTabs";

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  // ── Auth guard ─────────────────────────────────────────────────────
  const ensureAuthenticated = async (): Promise<boolean> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return true;
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session?.access_token) return true;
    toast({ title: "Sessão expirada", description: "Faça login novamente para continuar.", variant: "destructive" });
    navigate("/auth");
    return false;
  };

  // ── Tab state ──────────────────────────────────────────────────────
  const { detailTab, setDetailTab } = usePatientTabs();

  // ── Data fetching ──────────────────────────────────────────────────
  const {
    patient, setPatient, sessions, loading, sex,
    sessionSummaries, savedAnalyses, setSavedAnalyses,
    selectedAnalysis, setSelectedAnalysis,
    encountersForFilter, analysisV2Map, setAnalysisV2Map,
    availableSpecialties, refreshPatientAndSessions,
  } = usePatientData(id);

  // ── UI state ───────────────────────────────────────────────────────
  const [selectedSpecialty, setSelectedSpecialty] = useState("medicina_funcional");
  const [activeEncounterId, setActiveEncounterId] = useState<string | null>(null);
  const [analysisEncounterFilter, setAnalysisEncounterFilter] = useState<string>("all");
  const [profileOpen, setProfileOpen] = useState(false);
  const [aliasConfigOpen, setAliasConfigOpen] = useState(false);
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [editExtractionOpen, setEditExtractionOpen] = useState(false);
  const [pendingDeleteSessionId, setPendingDeleteSessionId] = useState<string | null>(null);
  const [reportEditOpen, setReportEditOpen] = useState(false);
  const [reportResults, setReportResults] = useState<any[]>([]);
  const [reportWithAI, setReportWithAI] = useState(false);
  const [activeCategory, setActiveCategory] = useState<Category>("Hemograma");

  // ── Patient actions (session CRUD, name, profile, delete) ──────────
  const actions = usePatientActions({
    patient, sessions, refreshPatientAndSessions, ensureAuthenticated,
  });

  // ── Analysis actions (AI analysis, protocols, reports) ─────────────
  const analysis = useAnalysisActions({
    patient, sessions, sex, selectedSpecialty, availableSpecialties,
    activeEncounterId, savedAnalyses, setSavedAnalyses,
    selectedAnalysis, setSelectedAnalysis, setAnalysisV2Map, setDetailTab,
  });

  // ── PDF import ─────────────────────────────────────────────────────
  const pdf = usePdfImport({
    patient, ensureAuthenticated,
    markerValues: actions.markerValues,
    setMarkerValues: actions.setMarkerValues,
    labRefRanges: actions.labRefRanges,
    setLabRefRanges: actions.setLabRefRanges,
    setImportedPdfCount: actions.setImportedPdfCount,
    setSessionDate: actions.setSessionDate,
    setExtractedExamDate: actions.setExtractedExamDate,
    setLastQualityScore: actions.setLastQualityScore,
    setLastExtractionIssues: actions.setLastExtractionIssues,
    setLastHistoricalResults: actions.setLastHistoricalResults,
    setEditExtractionOpen,
  });

  // ── Derived ────────────────────────────────────────────────────────
  const filledCount = useMemo(
    () => Object.values(actions.markerValues).filter((v) => v !== "").length,
    [actions.markerValues]
  );

  const openReportEdit = async (withAI: boolean) => {
    if (!patient) return;
    const sessionIds = sessions.map((s) => s.id);
    const { data } = await supabase.from("lab_results").select("*").in("session_id", sessionIds);
    const mapped = (data || []).map((r) => ({
      marker_id: r.marker_id, session_id: r.session_id,
      value: r.value ?? 0, text_value: r.text_value ?? undefined,
      lab_ref_min: r.lab_ref_min ?? undefined, lab_ref_max: r.lab_ref_max ?? undefined,
      lab_ref_text: r.lab_ref_text ?? undefined,
    }));
    setReportResults(mapped);
    setReportWithAI(withAI);
    setReportEditOpen(true);
  };

  const handleReportConfirmWrapper = async (updatedResults: any[]) => {
    if (!patient) return;
    if (!reportWithAI) {
      generatePatientReport(patient.name, sex, sessions, updatedResults);
      toast({ title: "Relatório exportado!" });
      return;
    }
    await analysis.handleReportConfirm(updatedResults);
  };

  // ── Loading / null guards ──────────────────────────────────────────
  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!patient) return null;

  // ═══ SESSION FORM VIEW ═══
  if (actions.formOpen) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => actions.setFormOpen(false)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">
                  {actions.editingSessionId ? "Editar Sessão" : "Nova Sessão de Exames"}
                </h1>
                <p className="text-sm text-muted-foreground">{patient.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={pdf.pdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={pdf.handlePdfImport}
                multiple
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => pdf.pdfInputRef.current?.click()}
                disabled={pdf.extracting}
              >
                {pdf.extracting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileUp className="mr-1.5 h-3.5 w-3.5" />
                )}
                {pdf.extracting ? "Extraindo..." : actions.importedPdfCount > 0 ? "Adicionar PDF" : "Importar PDF"}
              </Button>
              {filledCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => setEditExtractionOpen(true)} title="Revisar exames extraídos">
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Revisar
                </Button>
              )}
              <Button onClick={actions.handleSaveSession} disabled={actions.saving}>
                <Save className="mr-2 h-4 w-4" />
                {actions.saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>

          {/* Date picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <Label>Data:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(actions.sessionDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={actions.sessionDate}
                  onSelect={(d) => { d && actions.setSessionDate(d); actions.setExtractedExamDate(null); }}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {actions.extractedExamDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                <Check className="h-3 w-3" />
                Data extraída do laudo
              </span>
            )}
            <Label className="ml-4">Especialidade:</Label>
            <Select value={actions.sessionSpecialty} onValueChange={actions.setSessionSpecialty}>
              <SelectTrigger className="w-[220px] h-9 text-sm">
                <SelectValue placeholder="Selecione a especialidade" />
              </SelectTrigger>
              <SelectContent>
                {availableSpecialties.length > 0 ? (
                  availableSpecialties.map((sp) => (
                    <SelectItem key={sp.specialty_id} value={sp.specialty_id}>
                      <span className="flex items-center gap-2">
                        <span>{sp.specialty_icon}</span>
                        <span>{sp.specialty_name}</span>
                      </span>
                    </SelectItem>
                  ))
                ) : (
                  <>
                    <SelectItem value="medicina_funcional">🦠 Medicina Funcional</SelectItem>
                    <SelectItem value="nutrologia">🥬 Nutrologia</SelectItem>
                    <SelectItem value="endocrinologia">🧬 Endocrinologia</SelectItem>
                    <SelectItem value="cardiologia">❤️ Cardiologia</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
            {actions.sessionSpecialty === "nutrologia" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-medium text-green-700">
                ✅ Referências funcionais ativas
              </span>
            )}
          </div>

          {/* Category tabs */}
          <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as Category)}>
            <div className="overflow-x-auto">
              <TabsList className="inline-flex h-auto flex-wrap gap-1 bg-transparent p-0">
                {CATEGORIES.map((cat) => {
                  const catMarkers = getMarkersByCategory(cat);
                  const catFilled = catMarkers.filter((m) => actions.markerValues[m.id] && actions.markerValues[m.id] !== "").length;
                  return (
                    <TabsTrigger
                      key={cat}
                      value={cat}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        "data-[state=active]:border-transparent data-[state=active]:text-primary-foreground",
                      )}
                      style={activeCategory === cat ? { backgroundColor: `hsl(${CATEGORY_COLORS[cat]})` } : undefined}
                    >
                      {cat}
                      {catFilled > 0 && <span className="ml-1 opacity-70">({catFilled})</span>}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {CATEGORIES.map((cat) => (
              <TabsContent key={cat} value={cat} className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: `hsl(${CATEGORY_COLORS[cat]})` }} />
                      {cat}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {getMarkersByCategory(cat).map((marker) => (
                        <MarkerInput
                          key={marker.id}
                          marker={marker}
                          sex={sex}
                          value={actions.markerValues[marker.id] || ""}
                          onChange={(v) => actions.setMarkerValues({ ...actions.markerValues, [marker.id]: v })}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          <EditExtractionDialog
            open={editExtractionOpen}
            onClose={() => setEditExtractionOpen(false)}
            markerValues={actions.markerValues}
            onConfirm={(updated) => {
              actions.setMarkerValues(updated);
              setVerificationOpen(true);
            }}
          />

          <ImportVerification
            open={verificationOpen}
            onClose={() => setVerificationOpen(false)}
            importedMarkers={actions.markerValues}
            pdfText={pdf.lastPdfText}
            rawPdfText={pdf.lastRawPdfText}
          />

          <AliasConfigDialog
            open={aliasConfigOpen}
            onClose={() => setAliasConfigOpen(false)}
          />
        </div>
      </AppLayout>
    );
  }

  // ═══ PATIENT DETAIL VIEW ═══
  return (
    <AppLayout>
      <div className="flex gap-0">
      <div className="flex-1 min-w-0 space-y-6">
        {/* Breadcrumb + Patient info */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <Breadcrumb>
                <BreadcrumbList className="text-xs">
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                      <button onClick={() => navigate("/")} className="hover:text-foreground transition-colors">Dashboard</button>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-medium">{patient.name}</BreadcrumbPage>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{TAB_LABELS[detailTab] || detailTab}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>

              {actions.editingName ? (
                <div className="flex items-center gap-1 mt-0.5">
                  <Input
                    value={actions.nameValue}
                    onChange={(e) => actions.setNameValue(e.target.value)}
                    className="h-8 w-48 text-base font-bold"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") actions.handleSaveName();
                      if (e.key === "Escape") actions.setEditingName(false);
                    }}
                  />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={actions.handleSaveName}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => actions.setEditingName(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 mt-0.5">
                  <h1 className="text-xl font-bold">{patient.name}</h1>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={actions.handleEditName}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{sex === "M" ? "Masculino" : "Feminino"}</Badge>
                {patient.birth_date && (() => {
                  const today = new Date();
                  const birth = new Date(patient.birth_date);
                  const age = today.getFullYear() - birth.getFullYear() -
                    (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
                  return <Badge variant="outline" className="text-xs">{age} anos</Badge>;
                })()}
                <span className="text-xs text-muted-foreground">{sessions.length} sessão(ões)</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <PatientChatPanel patientId={patient.id} patientName={patient.name} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                  <UserCircle2 className="mr-2 h-4 w-4" />
                  Editar perfil
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAliasConfigOpen(true)}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Configurar aliases
                </DropdownMenuItem>
                {sessions.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={analysis.handleGenerateProtocols} disabled={analysis.isAnalyzing || analysis.isGeneratingProtocols}>
                      <Syringe className="mr-2 h-4 w-4" />
                      {analysis.isGeneratingProtocols ? "Gerando Protocolos..." : "Protocolos IA"}
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={actions.openNewSession}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Sessão Manual
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={(e) => e.preventDefault()}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir paciente
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir paciente</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir <strong>{patient?.name}</strong> e todos os seus dados? Esta ação não pode ser desfeita.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={actions.handleDeletePatient} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Excluir
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex items-center gap-2 flex-wrap mt-3 pb-1">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
            onClick={() => {
              setDetailTab("consultas");
              const url = new URL(window.location.href);
              url.searchParams.set("tab", "consultas");
              url.searchParams.set("action", "new_soap");
              window.history.replaceState({}, "", url.toString());
              window.dispatchEvent(new Event("popstate"));
            }}
          >
            <Stethoscope className="h-3.5 w-3.5" />
            Nova Consulta
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              setDetailTab("exames");
              setTimeout(() => pdf.pdfInputRef.current?.click(), 200);
            }}
          >
            <FileUp className="h-3.5 w-3.5" />
            Importar Exame
          </Button>

          {sessions.length > 0 && (
            <>
              <div className="flex items-center gap-1">
                {availableSpecialties.length > 0 && (
                  <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                    <SelectTrigger className="h-8 w-auto text-xs border-primary/20 text-primary bg-primary/5 hover:bg-primary/10 gap-1 px-2">
                      <SelectValue>
                        {(() => {
                          const sp = availableSpecialties.find(s => s.specialty_id === selectedSpecialty);
                          return sp ? `${sp.specialty_icon} ${sp.specialty_name}` : selectedSpecialty;
                        })()}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {availableSpecialties.map((sp) => (
                        <SelectItem key={sp.specialty_id} value={sp.specialty_id}>
                          <span className="flex items-center gap-2">
                            <span>{sp.specialty_icon}</span>
                            <span>{sp.specialty_name}</span>
                            {sp.has_protocols && (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1">+ Protocolos</Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => analysis.handleGenerateAnalysis()}
                  disabled={analysis.isAnalyzing || analysis.isGeneratingProtocols}
                  className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                  title="Gera análise clínica dos exames com IA"
                >
                  {analysis.isAnalyzing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Brain className="h-3.5 w-3.5" />
                  )}
                  {analysis.isAnalyzing ? "Analisando..." : "Análise IA"}
                </Button>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openReportEdit(false)}>
                <FileDown className="h-3.5 w-3.5" />
                Relatório
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openReportEdit(true)} disabled={analysis.isAnalyzing}>
                <Sparkles className="h-3.5 w-3.5" />
                Relatório + IA
              </Button>
            </>
          )}
        </div>

        {/* Clinical Brief */}
        {(() => {
          const lastEncounter = encountersForFilter.length > 0 ? encountersForFilter[0] : null;
          const lastAnalysisItem = savedAnalyses.length > 0 ? savedAnalyses[0] : null;
          const latestV2 = lastAnalysisItem ? analysisV2Map[lastAnalysisItem.id] ?? null : null;
          const lastSessionDate = sessions.length > 0 ? sessions[0].session_date : null;
          return (
            <PatientClinicalBrief
              lastEncounter={lastEncounter}
              lastAnalysis={lastAnalysisItem}
              v2Data={latestV2}
              sessionsCount={sessions.length}
              lastSessionDate={lastSessionDate}
            />
          );
        })()}

        {/* ── AI Summary Panel ── */}
        {savedAnalyses.length > 0 && detailTab === "resumo" && (
          <AISummaryPanel
            analysis={selectedAnalysis}
            v2Data={selectedAnalysis ? analysisV2Map[selectedAnalysis.id] ?? null : null}
            onOpenFullAnalysis={() => setDetailTab("analysis")}
          />
        )}

        {/* ═══ MAIN TABS ═══ */}
        <Tabs value={detailTab} onValueChange={setDetailTab}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="resumo" className="gap-1.5 text-xs">
              <ClipboardList className="h-3 w-3" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="consultas" className="gap-1.5 text-xs">
              <Stethoscope className="h-3 w-3" />
              Consultas
            </TabsTrigger>
            <TabsTrigger value="exames" className="gap-1.5 text-xs">
              <FlaskConical className="h-3 w-3" />
              Exames
            </TabsTrigger>
            <TabsTrigger value="evolutivo" className="gap-1.5 text-xs">
              <BarChart3 className="h-3 w-3" />
              Evolutivo
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-1.5 text-xs">
              <Brain className="h-3 w-3" />
              Análise IA
              {savedAnalyses.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">{savedAnalyses.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="contexto" className="gap-1.5 text-xs">
              <Sliders className="h-3 w-3" />
              Contexto
            </TabsTrigger>
          </TabsList>

          {/* ═══ RESUMO ═══ */}
          <TabsContent value="resumo" className="mt-4">
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-40" />
                <p className="text-sm">
                  {sessions.length === 0
                    ? "Importe exames ou crie uma consulta para começar."
                    : "Use as abas acima para navegar entre consultas, exames, análises e contexto do paciente."}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ EXAMES ═══ */}
          <TabsContent value="exames" className="mt-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Sessões de Exames</h2>
              <div className="flex gap-2">
                <input ref={pdf.pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={pdf.handlePdfImport} multiple />
                <Button size="sm" variant="outline" onClick={() => { actions.openNewSession(); setTimeout(() => pdf.pdfInputRef.current?.click(), 200); }}>
                  <FileUp className="mr-1.5 h-3.5 w-3.5" />
                  Importar PDF
                </Button>
                <Button size="sm" onClick={actions.openNewSession}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Nova Sessão
                </Button>
              </div>
            </div>

            {sessions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FlaskConical className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-lg font-medium">Nenhum exame cadastrado</p>
                  <p className="text-sm text-muted-foreground mb-4">Importe um PDF de laboratório ou insira manualmente.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => {
                  const summary = sessionSummaries[session.id];
                  return (
                    <Card key={session.id} className="cursor-pointer hover:bg-muted/30 transition-colors group" onClick={() => actions.openEditSession(session)}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                              <FlaskConical className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{format(parseISO(session.session_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                                {summary ? (
                                  <>
                                    <span>{summary.total} marcador{summary.total !== 1 ? "es" : ""}</span>
                                    {summary.flagged.length > 0 && (
                                      <>
                                        <span>•</span>
                                        <span className="text-amber-600 dark:text-amber-400 font-medium">
                                          {summary.flagged.length} alterado{summary.flagged.length !== 1 ? "s" : ""}
                                        </span>
                                      </>
                                    )}
                                    {summary.quality != null && (
                                      <>
                                        <span>•</span>
                                        <span>Qualidade: {Math.round(summary.quality * 100)}%</span>
                                      </>
                                    )}
                                  </>
                                ) : (
                                  <span>Criado em {format(parseISO(session.created_at), "dd/MM/yyyy HH:mm")}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); setPendingDeleteSessionId(session.id); }}
                              title="Excluir sessão"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                        {summary && summary.flagged.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2.5 ml-[52px]">
                            {summary.flagged.map((f, i) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className={cn(
                                  "text-[10px] h-5 px-1.5 gap-1",
                                  f.flag.startsWith("critical")
                                    ? "border-destructive/40 text-destructive bg-destructive/5"
                                    : "border-amber-400/40 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20"
                                )}
                              >
                                {f.flag.startsWith("critical") && <AlertTriangle className="h-2.5 w-2.5" />}
                                {f.name}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            <AlertDialog open={!!pendingDeleteSessionId} onOpenChange={(open) => { if (!open) setPendingDeleteSessionId(null); }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir sessão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir esta sessão e todos os seus resultados? Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      if (pendingDeleteSessionId) {
                        actions.handleDeleteSession(pendingDeleteSessionId);
                        setPendingDeleteSessionId(null);
                      }
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          {/* ═══ CONSULTAS ═══ */}
          <TabsContent value="consultas" className="mt-4">
            {patient && (
              <ClinicalEvolutionTab
                patientId={patient.id}
                patientName={patient.name}
                specialtyId={selectedSpecialty}
                specialtyName={availableSpecialties.find(s => s.specialty_id === selectedSpecialty)?.specialty_name}
                practitionerName={user?.user_metadata?.name || user?.email || "Profissional"}
                availableSpecialties={availableSpecialties}
                onRequestAnalysis={(encounterId) => {
                  setActiveEncounterId(encounterId);
                  analysis.handleGenerateAnalysis(encounterId);
                }}
                onViewAnalysis={(analysisId) => {
                  const found = savedAnalyses.find(a => a.id === analysisId);
                  if (found) {
                    setSelectedAnalysis(found);
                    setDetailTab("analysis");
                  }
                }}
              />
            )}
          </TabsContent>

          {/* ═══ EVOLUTIVO ═══ */}
          <TabsContent value="evolutivo" className="mt-4 overflow-hidden space-y-4">
            <Tabs defaultValue="table">
              <TabsList className="mb-2">
                <TabsTrigger value="table" className="gap-1.5 text-xs">
                  <BarChart3 className="h-3 w-3" />
                  Comparativo
                </TabsTrigger>
                <TabsTrigger value="chart" className="gap-1.5 text-xs">
                  <Clock className="h-3 w-3" />
                  Timeline
                </TabsTrigger>
              </TabsList>
              <TabsContent value="table">
                <EvolutionTable patientId={patient.id} sessions={sessions} sex={sex} />
              </TabsContent>
              <TabsContent value="chart">
                <EvolutionTimeline patientId={patient.id} patientName={patient.name} patientSex={patient.sex === "F" ? "F" : "M"} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ═══ ANALYSIS ═══ */}
          <TabsContent value="analysis" className="mt-4">
            {savedAnalyses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Brain className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-lg font-medium">Nenhuma análise gerada</p>
                  <p className="text-sm text-muted-foreground mb-1">A IA analisa os exames, anamnese e histórico do paciente.</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    {sessions.length === 0
                      ? "Cadastre uma sessão de exames primeiro."
                      : "Selecione uma especialidade e clique em 'Análise IA' no topo."}
                  </p>
                  {sessions.length > 0 && (
                    <Button
                      size="sm" variant="outline"
                      onClick={() => analysis.handleGenerateAnalysis()}
                      disabled={analysis.isAnalyzing}
                      className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                    >
                      <Brain className="mr-1.5 h-4 w-4" />
                      Gerar Análise IA
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  {encountersForFilter.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground font-medium">Filtrar por consulta:</span>
                      <Select value={analysisEncounterFilter} onValueChange={(v) => { setAnalysisEncounterFilter(v); setSelectedAnalysis(null); }}>
                        <SelectTrigger className="h-7 w-auto text-xs gap-1 px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as análises</SelectItem>
                          <SelectItem value="unlinked">Sem consulta vinculada</SelectItem>
                          {encountersForFilter.map((enc) => (
                            <SelectItem key={enc.id} value={enc.id}>
                              {format(parseISO(enc.encounter_date), "dd/MM/yyyy")}
                              {enc.chief_complaint ? ` — ${enc.chief_complaint.substring(0, 40)}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(() => {
                    const filtered = analysisEncounterFilter === "all"
                      ? savedAnalyses
                      : analysisEncounterFilter === "unlinked"
                        ? savedAnalyses.filter((a) => !a.encounter_id)
                        : savedAnalyses.filter((a) => a.encounter_id === analysisEncounterFilter);

                    if (filtered.length > 0 && !selectedAnalysis) {
                      setTimeout(() => setSelectedAnalysis(filtered[0]), 0);
                    }

                    return filtered.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">Nenhuma análise encontrada para este filtro.</p>
                    ) : filtered.length > 1 ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-medium">Histórico:</span>
                        {filtered.map((a) => {
                          const enc = a.encounter_id ? encountersForFilter.find((e) => e.id === a.encounter_id) : null;
                          return (
                            <div key={a.id} className="flex items-center gap-0.5">
                              <button
                                onClick={() => setSelectedAnalysis(a)}
                                className={cn(
                                  "text-xs px-2 py-1 rounded-full border transition-colors flex items-center gap-1",
                                  selectedAnalysis?.id === a.id
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-background hover:bg-muted border-border"
                                )}
                              >
                                {enc && <CalendarIcon className="h-3 w-3 opacity-70" />}
                                {a.specialty_name ?? a.specialty_id} • {format(parseISO(a.created_at), "dd/MM/yy HH:mm")}
                                {!a.encounter_id && <span className="ml-1 opacity-60 text-[9px]">(avulsa)</span>}
                              </button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Excluir análise">
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir análise?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      A análise de {a.specialty_name ?? a.specialty_id} gerada em {format(parseISO(a.created_at), "dd/MM/yyyy HH:mm")} será excluída permanentemente.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => analysis.handleDeleteAnalysis(a.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          );
                        })}
                      </div>
                    ) : null;
                  })()}
                </div>

                {selectedAnalysis && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Brain className="h-4 w-4 text-primary" />
                            {selectedAnalysis.specialty_name ?? selectedAnalysis.specialty_id}
                          </CardTitle>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-xs text-muted-foreground">
                              Gerado em {format(parseISO(selectedAnalysis.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                            {selectedAnalysis.encounter_id ? (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-1">
                                <Stethoscope className="h-2.5 w-2.5" />
                                Consulta {format(parseISO(encountersForFilter.find(e => e.id === selectedAnalysis.encounter_id)?.encounter_date ?? selectedAnalysis.created_at), "dd/MM/yy")}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[9px] h-4 px-1.5 opacity-60">Avulsa</Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                                Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir análise?</AlertDialogTitle>
                                <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => analysis.handleDeleteAnalysis(selectedAnalysis.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          <Button
                            variant="outline" size="sm"
                            onClick={() => {
                              const sessionIds = sessions.map(s => s.id);
                              supabase.from("lab_results").select("*").in("session_id", sessionIds).then(({ data }) => {
                                const results = (data || []).map(r => ({
                                  marker_id: r.marker_id, session_id: r.session_id,
                                  value: r.value ?? 0, text_value: r.text_value ?? undefined,
                                  lab_ref_min: r.lab_ref_min ?? undefined, lab_ref_max: r.lab_ref_max ?? undefined, lab_ref_text: r.lab_ref_text ?? undefined,
                                }));
                                generatePatientReport(patient.name, sex, sessions, results, selectedAnalysis);
                              });
                            }}
                            className="gap-1.5"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            Exportar PDF
                          </Button>
                          {selectedAnalysis.prescription_table && (selectedAnalysis.prescription_table as any[]).length > 0 && (
                            <Button
                              variant="outline" size="sm"
                              onClick={() => {
                                exportPrescriptionCSV(selectedAnalysis.prescription_table as any[], patient.name);
                                toast({ title: "Prescrição exportada como planilha!" });
                              }}
                              className="gap-1.5"
                            >
                              <FileDown className="h-3.5 w-3.5" />
                              Prescrição (Planilha)
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {analysisV2Map[selectedAnalysis.id] && (
                        <ClinicalReportV2
                          data={analysisV2Map[selectedAnalysis.id]}
                          patientName={patient?.name}
                          analysisId={selectedAnalysis.id}
                          patientId={patient?.id}
                          specialtyId={selectedAnalysis.specialty_id}
                        />
                      )}

                      {selectedAnalysis.summary && (
                        <div className="rounded-lg bg-muted/50 p-4 border-l-4 border-primary">
                          <h3 className="font-bold text-sm text-primary mb-2 uppercase tracking-wide">Visão Geral</h3>
                          <p className="text-sm leading-relaxed">{selectedAnalysis.summary}</p>
                        </div>
                      )}

                      {selectedAnalysis.patterns && (selectedAnalysis.patterns as any[]).length > 0 && (
                        <div>
                          <h3 className="font-bold text-sm text-primary mb-2 uppercase tracking-wide">Padrões Clínicos Identificados</h3>
                          <ul className="space-y-1.5 ml-1">
                            {(selectedAnalysis.patterns as any[]).map((p: any, i: number) => {
                              const text = typeof p === "string" ? p : (p.name ? `${p.name}${p.description ? ` — ${p.description}` : ""}` : JSON.stringify(p));
                              return (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>{text}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {selectedAnalysis.suggestions && (selectedAnalysis.suggestions as any[]).length > 0 && (
                        <div>
                          <h3 className="font-bold text-sm text-primary mb-2 uppercase tracking-wide">Sugestões de Investigação Complementar</h3>
                          <ul className="space-y-1.5 ml-1">
                            {(selectedAnalysis.suggestions as any[]).map((s: any, i: number) => {
                              const text = typeof s === "string" ? s : (s.exam ?? s.name ?? JSON.stringify(s));
                              const reason = typeof s === "object" && s.reason ? ` — ${s.reason}` : "";
                              return (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>{text}{reason}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {selectedAnalysis.technical_analysis && (
                        <div className="rounded-lg border bg-background p-4">
                          <h3 className="font-bold text-sm text-primary mb-3 uppercase tracking-wide">Documento 1 — Análise Técnica para o Médico</h3>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">{selectedAnalysis.technical_analysis}</div>
                        </div>
                      )}

                      {selectedAnalysis.patient_plan && (
                        <div className="rounded-lg border bg-background p-4">
                          <h3 className="font-bold text-sm text-primary mb-3 uppercase tracking-wide">Documento 2 — Plano de Condutas</h3>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">{selectedAnalysis.patient_plan}</div>
                        </div>
                      )}

                      {selectedAnalysis.prescription_table && (selectedAnalysis.prescription_table as any[]).length > 0 && (
                        <div>
                          <h3 className="font-bold text-sm text-primary mb-3 uppercase tracking-wide">Documento 3 — Prescrição Detalhada</h3>
                          <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-primary text-primary-foreground">
                                  <th className="px-3 py-2 text-left font-semibold">Substância</th>
                                  <th className="px-3 py-2 text-left font-semibold">Dose</th>
                                  <th className="px-3 py-2 text-left font-semibold">Via</th>
                                  <th className="px-3 py-2 text-left font-semibold">Frequência</th>
                                  <th className="px-3 py-2 text-left font-semibold">Duração</th>
                                  <th className="px-3 py-2 text-left font-semibold">Condições/CI</th>
                                  <th className="px-3 py-2 text-left font-semibold">Monitorização</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(selectedAnalysis.prescription_table as any[]).map((row: any, i: number) => (
                                  <tr key={i} className={cn("border-t", i % 2 === 0 ? "bg-background" : "bg-muted/30")}>
                                    <td className="px-3 py-2 font-medium">{row.substancia ?? row.substance ?? ""}</td>
                                    <td className="px-3 py-2">{row.dose ?? ""}</td>
                                    <td className="px-3 py-2">{row.via ?? row.route ?? ""}</td>
                                    <td className="px-3 py-2">{row.frequencia ?? row.frequency ?? ""}</td>
                                    <td className="px-3 py-2">{row.duracao ?? row.duration ?? ""}</td>
                                    <td className="px-3 py-2">{row.condicoes_ci ?? row.conditions ?? ""}</td>
                                    <td className="px-3 py-2">{row.monitorizacao ?? row.monitoring ?? ""}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {selectedAnalysis.protocol_recommendations && (selectedAnalysis.protocol_recommendations as any[]).length > 0 && (
                        <div>
                          <h3 className="font-bold text-sm text-primary mb-3 uppercase tracking-wide">Protocolos Essentia Recomendados</h3>
                          <div className="space-y-3">
                            {(selectedAnalysis.protocol_recommendations as any[]).map((p: any, i: number) => (
                              <div key={i} className="rounded-lg border p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-sm">
                                    {p.protocol_id && <span className="text-muted-foreground mr-1">{p.protocol_id} —</span>}
                                    {p.protocol_name ?? p.name}
                                  </span>
                                  {p.priority && (
                                    <Badge variant="outline" className={cn(
                                      "text-[10px] uppercase",
                                      p.priority?.toLowerCase() === "alta" && "border-red-500 text-red-600",
                                      p.priority?.toLowerCase() === "média" && "border-yellow-500 text-yellow-600",
                                      p.priority?.toLowerCase() === "baixa" && "border-blue-500 text-blue-600",
                                    )}>
                                      {p.priority}
                                    </Badge>
                                  )}
                                </div>
                                {(p.via || p.route) && <p className="text-xs"><span className="font-medium text-muted-foreground">Via:</span> {p.via ?? p.route}</p>}
                                {(p.composicao || p.composition) && <p className="text-xs"><span className="font-medium text-muted-foreground">Composição:</span> {p.composicao ?? p.composition}</p>}
                                {p.justification && <p className="text-xs text-muted-foreground italic">{p.justification}</p>}
                                {p.key_actives && (p.key_actives as string[]).length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {(p.key_actives as string[]).map((a: string, j: number) => (
                                      <Badge key={j} variant="secondary" className="text-[10px]">{a}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="border-t pt-4 mt-4">
                        <p className="text-[10px] text-muted-foreground text-center italic leading-relaxed">
                          Esta análise foi gerada por inteligência artificial e tem caráter exclusivamente informativo e educacional.
                          Não substitui avaliação, diagnóstico ou prescrição médica. Modelo: {selectedAnalysis.model_used ?? "N/A"}.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* ═══ CONTEXTO ═══ */}
          <TabsContent value="contexto" className="mt-4 space-y-4">
            <Tabs defaultValue="anamnese">
              <TabsList className="mb-2">
                <TabsTrigger value="anamnese" className="gap-1.5 text-xs">
                  <ClipboardList className="h-3 w-3" />
                  Anamnese
                </TabsTrigger>
                <TabsTrigger value="body" className="gap-1.5 text-xs">
                  <Scale className="h-3 w-3" />
                  Composição Corporal
                </TabsTrigger>
                <TabsTrigger value="imaging" className="gap-1.5 text-xs">
                  <FileImage className="h-3 w-3" />
                  Laudos de Imagem
                </TabsTrigger>
              </TabsList>
              <TabsContent value="anamnese">
                {patient && <AnamneseTab patient={patient} />}
              </TabsContent>
              <TabsContent value="body">
                {patient && <BodyCompositionTab patientId={patient.id} />}
              </TabsContent>
              <TabsContent value="imaging">
                {patient && <ImagingReportsTab patientId={patient.id} />}
              </TabsContent>
            </Tabs>
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Side Panel */}
      <AISidePanel
        analysis={selectedAnalysis}
        v2Data={selectedAnalysis ? analysisV2Map[selectedAnalysis.id] ?? null : null}
        patientId={patient.id}
        patientName={patient.name}
        onOpenFullAnalysis={() => setDetailTab("analysis")}
      />
      </div>

      <EditReportDialog
        open={reportEditOpen}
        onClose={() => setReportEditOpen(false)}
        results={reportResults}
        sex={sex}
        onConfirm={handleReportConfirmWrapper}
      />

      {patient && (
        <PatientProfileDialog
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          profile={{
            objectives: patient.objectives ?? [],
            activity_level: patient.activity_level ?? null,
            sport_modality: patient.sport_modality ?? null,
            main_complaints: patient.main_complaints ?? null,
            restrictions: patient.restrictions ?? null,
          }}
          onSave={actions.handleSaveProfile}
        />
      )}
    </AppLayout>
  );
}
