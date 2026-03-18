/**
 * EncounterHeader — Header card with patient info, status, actions,
 * red flags banner, and staleness banner.
 * Extracted from EncounterWorkspace.
 */
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Stethoscope,
  CalendarIcon,
  FileDown,
  Save,
  Loader2,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Info,
  RefreshCw,
} from "lucide-react";
import type { Encounter, Patient } from "@/hooks/useEncounterData";

interface EncounterHeaderProps {
  patient: Patient;
  encounter: Encounter;
  specialtyName: string;
  isFinalized: boolean;
  saving: boolean;
  redFlags: any[];
  stalenessReasons: string[];
  isGeneratingAnalysis: boolean;
  onSave: () => void;
  onFinalize: () => void;
  onDelete: () => void;
  onExportPdf: () => void;
  onRegenerateAnalysis: () => void;
  setEncounter: React.Dispatch<React.SetStateAction<Encounter | null>>;
}

export function EncounterHeader({
  patient,
  encounter,
  specialtyName,
  isFinalized,
  saving,
  redFlags,
  stalenessReasons,
  isGeneratingAnalysis,
  onSave,
  onFinalize,
  onDelete,
  onExportPdf,
  onRegenerateAnalysis,
  setEncounter,
}: EncounterHeaderProps) {
  const navigate = useNavigate();
  const patientId = patient.id;

  return (
    <>
      {/* Breadcrumb */}
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

      {/* Header card */}
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
              <Button size="sm" variant="outline" onClick={onExportPdf} className="gap-1.5">
                <FileDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">PDF</span>
              </Button>
              {!isFinalized && (
                <>
                  <Button size="sm" variant="outline" onClick={onSave} disabled={saving} className="gap-1.5">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Salvar
                  </Button>
                  <Button size="sm" onClick={onFinalize} className="gap-1.5">
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
                    <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
              <div className="flex-1 text-xs text-amber-700 dark:text-amber-400 space-y-0.5">
                <span className="font-medium">Dados novos disponíveis desde a última análise:</span>
                {stalenessReasons.map((r, i) => (
                  <div key={i}>• {r}</div>
                ))}
                <div className="mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onRegenerateAnalysis}
                    disabled={isGeneratingAnalysis}
                    className="h-7 gap-1.5 text-xs border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                  >
                    {isGeneratingAnalysis ? (
                      <><Loader2 className="h-3 w-3 animate-spin" />Regenerando...</>
                    ) : (
                      <><RefreshCw className="h-3 w-3" />Regenerar análise com dados atualizados</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Chief complaint inline edit */}
          {!isFinalized && (
            <div className="mt-3">
              <label className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                Motivo / Queixa principal
              </label>
              <input
                type="text"
                value={encounter.chief_complaint || ""}
                onChange={(e) => setEncounter((prev) => prev ? { ...prev, chief_complaint: e.target.value } : prev)}
                onBlur={async () => {
                  await (supabase as any).from("clinical_encounters").update({ chief_complaint: encounter.chief_complaint || null }).eq("id", encounter.id);
                }}
                className="w-full bg-transparent border-0 border-b border-primary/20 focus:border-primary focus:outline-none text-sm py-1 placeholder:text-muted-foreground/60"
                placeholder="Ex: Retorno, fadiga persistente, cefaleia..."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
