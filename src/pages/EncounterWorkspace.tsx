import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import AISidePanel from "@/components/AISidePanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Loader2,
  ChevronRight,
  FlaskConical,
  Brain,
  Pill,
  ClipboardList,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { useEncounterData } from "@/hooks/useEncounterData";
import { useEncounterActions } from "@/hooks/useEncounterActions";
import { EncounterHeader } from "@/components/encounter/EncounterHeader";
import { EncounterNoteEditor } from "@/components/encounter/EncounterNoteEditor";
import { EncounterFinalizeStep } from "@/components/encounter/EncounterFinalizeStep";
import { EncounterProgressTracker } from "@/components/encounter/EncounterProgressTracker";
import { EncounterPrescriptionEditor } from "@/components/EncounterPrescriptionEditor";
import ClinicalReportV2, { type AnalysisV2Data } from "@/components/ClinicalReportV2";
import { PatientLongitudinalContext } from "@/components/encounter/PatientLongitudinalContext";
import { PreviousEncounterContext } from "@/components/encounter/PreviousEncounterContext";
import { LinkedExamsSection } from "@/components/encounter/LinkedExamsSection";
import { GenerateAnalysisDialog } from "@/components/encounter/GenerateAnalysisDialog";

export default function EncounterWorkspace() {
  const { id: patientId, encounterId } = useParams<{ id: string; encounterId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [subTab, setSubTab] = useState("exames");

  // ── Data ──
  const data = useEncounterData(patientId, encounterId);
  const {
    loading, patient, encounter, note, setNote, setEncounter,
    analysis, setAnalysis, v2Data, setV2Data,
    relevantMarkers, lastSessionDate, specialtyName,
    stalenessReasons, setStalenessReasons,
    linkedExamsCount, isFinalized, stepStatus,
  } = data;

  // ── Actions ──
  const actions = useEncounterActions({
    encounter, patient, note, setNote, setEncounter,
    setAnalysis, setV2Data, setStalenessReasons,
    v2Data, analysis, specialtyName, relevantMarkers,
  });
  const {
    saving, isGeneratingAnalysis, showGenerateDialog, setShowGenerateDialog,
    handleSave, handleFinalize, handleDelete, handleExportEncounterPdf,
    handleGenerateEncounterAnalysis,
  } = actions;

  // ── Loading / Not found ──
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

  const redFlags = v2Data?.red_flags ?? [];

  const handleGenerateAndSwitch = async () => {
    const result = await handleGenerateEncounterAnalysis();
    if (result === "ia") setSubTab("ia");
  };

  return (
    <AppLayout>
      <div className="flex gap-0">
        {/* MAIN COLUMN */}
        <div className="flex-1 min-w-0 space-y-4 py-4 px-2 sm:px-4">

          {/* Header + Breadcrumb */}
          <EncounterHeader
            patient={patient}
            encounter={encounter}
            specialtyName={specialtyName}
            isFinalized={isFinalized}
            saving={saving}
            redFlags={redFlags}
            stalenessReasons={stalenessReasons}
            isGeneratingAnalysis={isGeneratingAnalysis}
            onSave={handleSave}
            onFinalize={handleFinalize}
            onDelete={handleDelete}
            onExportPdf={handleExportEncounterPdf}
            onRegenerateAnalysis={handleGenerateAndSwitch}
            setEncounter={setEncounter}
          />

          {/* Progress Tracker */}
          <EncounterProgressTracker
            status={stepStatus}
            activeStep={subTab}
            onStepClick={setSubTab}
          />

          {/* Generate Analysis Dialog */}
          <GenerateAnalysisDialog
            open={showGenerateDialog}
            onOpenChange={setShowGenerateDialog}
            encounterId={encounter.id}
            patientId={patient.id}
            encounterDate={encounter.encounter_date}
            specialtyId={encounter.specialty_id}
            specialtyName={specialtyName}
            note={{
              subjective: note.subjective,
              objective: note.objective,
              assessment: note.assessment,
              plan: note.plan,
              exams_requested: note.exams_requested,
              medications: note.medications,
              free_notes: note.free_notes,
            }}
            chiefComplaint={encounter.chief_complaint}
            onConfirm={handleGenerateAndSwitch}
            isGenerating={isGeneratingAnalysis}
          />

          {/* STEP CONTENT */}
          <Tabs value={subTab} onValueChange={setSubTab} className="mt-0">
            <TabsList className="hidden">
              <TabsTrigger value="exames" />
              <TabsTrigger value="soap" />
              <TabsTrigger value="ia" />
              <TabsTrigger value="prescricao" />
              <TabsTrigger value="finalizar" />
            </TabsList>

            {/* STEP 1: EXAMES */}
            <TabsContent value="exames" className="mt-4 space-y-4">
              {user && (
                <PatientLongitudinalContext
                  patientId={patient.id}
                  currentEncounterId={encounter.id}
                  practitionerId={user.id}
                />
              )}
              {user && (
                <LinkedExamsSection
                  encounterId={encounter.id}
                  patientId={patient.id}
                  practitionerId={user.id}
                  encounterDate={encounter.encounter_date}
                  isFinalized={isFinalized}
                />
              )}
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
                    <Button variant="link" size="sm" className="text-xs h-auto p-0 text-primary" onClick={() => navigate(`/patient/${patientId}?tab=evolutivo`)}>
                      Ver evolutivo completo <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Button>
                    <Button variant="link" size="sm" className="text-xs h-auto p-0 text-primary" onClick={() => navigate(`/patient/${patientId}?tab=exames`)}>
                      Ver todos os exames <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setSubTab("soap")} className="gap-1.5">
                  Próximo: Evolução Clínica <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TabsContent>

            {/* STEP 2: EVOLUÇÃO */}
            <TabsContent value="soap" className="mt-4 space-y-3">
              {user && (
                <PreviousEncounterContext
                  patientId={patient.id}
                  currentEncounterId={encounter.id}
                  practitionerId={user.id}
                />
              )}

              {/* Chief complaint — only in finalized mode (edit is in header) */}
              {isFinalized && encounter.chief_complaint && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="py-3 px-5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <ClipboardList className="h-3.5 w-3.5 text-primary" />
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Motivo / Queixa principal
                      </label>
                    </div>
                    <p className="text-sm text-foreground/80">{encounter.chief_complaint}</p>
                  </CardContent>
                </Card>
              )}

              <EncounterNoteEditor
                note={note}
                setNote={setNote}
                isFinalized={isFinalized}
                saving={saving}
                onSave={handleSave}
                onNextStep={() => setSubTab("ia")}
              />
            </TabsContent>

            {/* STEP 3: ANÁLISE IA */}
            <TabsContent value="ia" className="mt-4 space-y-4">
              {v2Data ? (
                <>
                  <ClinicalReportV2
                    data={v2Data}
                    patientName={patient.name}
                    analysisId={analysis?.id}
                    patientId={patient.id}
                    specialtyId={encounter.specialty_id}
                  />
                  <div className="flex items-center justify-between">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateAndSwitch}
                      disabled={isGeneratingAnalysis}
                      className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                    >
                      {isGeneratingAnalysis ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />Regenerando...</>
                      ) : (
                        <><RefreshCw className="h-3.5 w-3.5" />Regenerar análise</>
                      )}
                    </Button>
                    <Button size="sm" onClick={() => setSubTab("prescricao")} className="gap-1.5">
                      Próximo: Prescrição <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </>
              ) : (
                <Card className="border-dashed border-muted-foreground/30">
                  <CardContent className="py-12 flex flex-col items-center text-center gap-4">
                    <div className="flex items-center justify-center h-14 w-14 rounded-full bg-primary/10">
                      <Brain className="h-7 w-7 text-primary" />
                    </div>
                    <div className="max-w-sm">
                      <h3 className="text-base font-semibold text-foreground">Nenhuma análise IA nesta consulta</h3>
                      <p className="text-sm text-muted-foreground mt-2">
                        Gere uma análise inteligente para obter insights clínicos, hipóteses diagnósticas, alertas críticos e sugestões de conduta.
                      </p>
                    </div>
                    <Button
                      size="lg"
                      onClick={() => setShowGenerateDialog(true)}
                      disabled={isGeneratingAnalysis}
                      className="gap-2 mt-2"
                    >
                      {isGeneratingAnalysis ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Gerando análise...</>
                      ) : (
                        <><Sparkles className="h-4 w-4" />Gerar Análise IA</>
                      )}
                    </Button>
                    <div className="flex justify-end w-full mt-4">
                      <Button size="sm" variant="outline" onClick={() => setSubTab("prescricao")} className="gap-1.5">
                        Pular para Prescrição <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* STEP 4: PRESCRIÇÃO */}
            <TabsContent value="prescricao" className="mt-4 space-y-4">
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
              <div className="flex justify-end">
                <Button size="sm" onClick={() => setSubTab("finalizar")} className="gap-1.5">
                  Próximo: Finalizar <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TabsContent>

            {/* STEP 5: FINALIZAR */}
            <TabsContent value="finalizar" className="mt-4 space-y-4">
              <EncounterFinalizeStep
                stepStatus={stepStatus}
                isFinalized={isFinalized}
                saving={saving}
                linkedExamsCount={linkedExamsCount}
                onStepClick={setSubTab}
                onSave={handleSave}
                onFinalize={handleFinalize}
                onExportPdf={handleExportEncounterPdf}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* SIDE PANEL — AI Assistant */}
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
