/**
 * GenerateAnalysisDialog — Guided pre-flight check before generating
 * an AI analysis for the current encounter.
 * Shows what context will be sent, warns about missing data,
 * and lets the physician confirm/select sources.
 */
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  Brain,
  FileText,
  FlaskConical,
  Activity,
  ImageIcon,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Sparkles,
  Info,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface NoteState {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  exams_requested: string;
  medications: string;
  free_notes: string;
}

interface LinkedItem {
  id: string;
  label: string;
  date: string;
  type: "lab" | "body" | "imaging";
}

interface GenerateAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  encounterId: string;
  patientId: string;
  encounterDate: string;
  specialtyId: string;
  specialtyName: string;
  note: NoteState;
  chiefComplaint: string | null;
  onConfirm: () => void;
  isGenerating: boolean;
}

type CheckStatus = "ok" | "warn" | "error";

interface PreflightCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  icon: React.ReactNode;
}

export function GenerateAnalysisDialog({
  open,
  onOpenChange,
  encounterId,
  patientId,
  encounterDate,
  specialtyId,
  specialtyName,
  note,
  chiefComplaint,
  onConfirm,
  isGenerating,
}: GenerateAnalysisDialogProps) {
  const [linkedItems, setLinkedItems] = useState<LinkedItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Fetch linked items when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoadingItems(true);

    Promise.all([
      (supabase as any)
        .from("lab_sessions")
        .select("id, session_date")
        .eq("encounter_id", encounterId),
      (supabase as any)
        .from("body_composition_sessions")
        .select("id, session_date")
        .eq("encounter_id", encounterId),
      (supabase as any)
        .from("imaging_reports")
        .select("id, exam_type, report_date")
        .eq("encounter_id", encounterId),
    ]).then(([labRes, bodyRes, imgRes]) => {
      const items: LinkedItem[] = [];
      (labRes.data ?? []).forEach((s: any) =>
        items.push({
          id: s.id,
          label: `Exames lab — ${format(parseISO(s.session_date), "dd/MM/yyyy")}`,
          date: s.session_date,
          type: "lab",
        })
      );
      (bodyRes.data ?? []).forEach((s: any) =>
        items.push({
          id: s.id,
          label: `Composição corporal — ${format(parseISO(s.session_date), "dd/MM/yyyy")}`,
          date: s.session_date,
          type: "body",
        })
      );
      (imgRes.data ?? []).forEach((r: any) =>
        items.push({
          id: r.id,
          label: `${r.exam_type} — ${format(parseISO(r.report_date), "dd/MM/yyyy")}`,
          date: r.report_date,
          type: "imaging",
        })
      );
      setLinkedItems(items);
      setLoadingItems(false);
    });
  }, [open, encounterId]);

  // ── Pre-flight checks ──
  const hasNote = !!(
    note.subjective ||
    note.objective ||
    note.assessment ||
    note.plan
  );
  const hasChiefComplaint = !!chiefComplaint;
  const hasLinkedLabs = linkedItems.some((i) => i.type === "lab");
  const hasAnyLinked = linkedItems.length > 0;

  const checks: PreflightCheck[] = useMemo(() => {
    const list: PreflightCheck[] = [];

    // Specialty
    list.push({
      id: "specialty",
      label: "Especialidade",
      status: specialtyId ? "ok" : "error",
      detail: specialtyId ? specialtyName : "Nenhuma especialidade definida",
      icon: <Brain className="h-3.5 w-3.5" />,
    });

    // Chief complaint
    list.push({
      id: "complaint",
      label: "Queixa principal",
      status: hasChiefComplaint ? "ok" : "warn",
      detail: hasChiefComplaint
        ? (chiefComplaint!.length > 60 ? chiefComplaint!.slice(0, 60) + "…" : chiefComplaint!)
        : "Não preenchida — a análise será menos contextualizada",
      icon: <FileText className="h-3.5 w-3.5" />,
    });

    // Clinical note
    list.push({
      id: "note",
      label: "Evolução clínica (SOAP)",
      status: hasNote ? "ok" : "warn",
      detail: hasNote
        ? "Nota preenchida — será enviada como contexto"
        : "Sem nota clínica — a análise usará apenas exames",
      icon: <FileText className="h-3.5 w-3.5" />,
    });

    // Linked exams
    list.push({
      id: "exams",
      label: "Exames vinculados",
      status: hasLinkedLabs ? "ok" : hasAnyLinked ? "warn" : "error",
      detail: hasLinkedLabs
        ? `${linkedItems.filter((i) => i.type === "lab").length} sessão(ões) de exames vinculada(s)`
        : hasAnyLinked
        ? "Exames vinculados, mas sem sessão laboratorial — resultados virão do histórico geral"
        : "Nenhum exame vinculado — a IA usará o histórico geral do paciente",
      icon: <FlaskConical className="h-3.5 w-3.5" />,
    });

    return list;
  }, [specialtyId, specialtyName, hasChiefComplaint, chiefComplaint, hasNote, hasLinkedLabs, hasAnyLinked, linkedItems]);

  const hasErrors = checks.some((c) => c.status === "error" && c.id === "specialty");
  const hasWarnings = checks.some((c) => c.status === "warn");

  const statusIcon = (status: CheckStatus) => {
    if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
    if (status === "warn") return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
    return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerar análise desta consulta
          </DialogTitle>
          <DialogDescription>
            Verifique o contexto que será enviado para a análise IA.
          </DialogDescription>
        </DialogHeader>

        {loadingItems ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pre-flight checks */}
            <div className="space-y-2">
              {checks.map((check) => (
                <div
                  key={check.id}
                  className={cn(
                    "flex items-start gap-2.5 rounded-md px-3 py-2 text-xs",
                    check.status === "ok" && "bg-emerald-500/5",
                    check.status === "warn" && "bg-amber-500/5",
                    check.status === "error" && "bg-destructive/5"
                  )}
                >
                  <div className="mt-0.5 shrink-0">{statusIcon(check.status)}</div>
                  <div className="min-w-0">
                    <div className="font-medium text-foreground">{check.label}</div>
                    <div className="text-muted-foreground mt-0.5 leading-relaxed">{check.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Linked items summary */}
            {linkedItems.length > 0 && (
              <>
                <Separator />
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    Dados vinculados que serão priorizados
                  </div>
                  <div className="space-y-1.5">
                    {linkedItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-xs text-foreground/80">
                        {item.type === "lab" && <FlaskConical className="h-3 w-3 text-primary shrink-0" />}
                        {item.type === "body" && <Activity className="h-3 w-3 text-violet-500 shrink-0" />}
                        {item.type === "imaging" && <ImageIcon className="h-3 w-3 text-amber-500 shrink-0" />}
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Warnings summary */}
            {hasWarnings && !hasErrors && (
              <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2">
                <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Existem itens opcionais não preenchidos. A análise será gerada, mas pode ser menos precisa.
                </p>
              </div>
            )}

            {hasErrors && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                <p className="text-[11px] text-destructive">
                  Corrija os itens obrigatórios antes de gerar a análise.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGenerating}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            disabled={hasErrors || loadingItems || isGenerating}
            className="gap-1.5"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar Análise
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
