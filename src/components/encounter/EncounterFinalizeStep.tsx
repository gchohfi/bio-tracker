/**
 * EncounterFinalizeStep — Step 5 of the encounter workflow.
 * Shows checklist summary and finalize/export actions.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  Save,
  Loader2,
  FileDown,
} from "lucide-react";
import type { StepStatus } from "@/hooks/useEncounterData";

interface EncounterFinalizeStepProps {
  stepStatus: StepStatus;
  isFinalized: boolean;
  saving: boolean;
  linkedExamsCount: number;
  onStepClick: (step: string) => void;
  onSave: () => void;
  onFinalize: () => void;
  onExportPdf: () => void;
}

export function EncounterFinalizeStep({
  stepStatus,
  isFinalized,
  saving,
  linkedExamsCount,
  onStepClick,
  onSave,
  onFinalize,
  onExportPdf,
}: EncounterFinalizeStepProps) {
  const items = [
    { label: "Exames vinculados", done: stepStatus.exams, step: "exames", detail: stepStatus.exams ? `${linkedExamsCount} item(ns) vinculado(s)` : "Nenhum exame vinculado" },
    { label: "Evolução clínica", done: stepStatus.soap, step: "soap", detail: stepStatus.soap ? "Nota SOAP preenchida" : "Nenhum campo preenchido" },
    { label: "Análise IA", done: stepStatus.analysis, step: "ia", detail: stepStatus.analysis ? "Análise gerada" : "Ainda não gerada" },
    { label: "Prescrição", done: stepStatus.prescription, step: "prescricao", detail: stepStatus.prescription ? "Prescrição criada" : "Sem prescrição" },
  ];

  return (
    <>
      <Card>
        <CardContent className="py-5 px-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Resumo do Atendimento</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Revise o status de cada etapa antes de finalizar a consulta.
          </p>

          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.step}
                onClick={() => onStepClick(item.step)}
                className={cn(
                  "w-full flex items-center gap-3 rounded-md px-4 py-3 text-left transition-colors hover:bg-accent/50",
                  item.done ? "bg-emerald-500/5" : "bg-muted/30"
                )}
              >
                {item.done ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{item.label}</div>
                  <div className="text-[11px] text-muted-foreground">{item.detail}</div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>

          <Separator />

          {isFinalized ? (
            <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-sm font-medium text-foreground">Consulta finalizada</p>
                <p className="text-[11px] text-muted-foreground">Esta consulta foi encerrada e está em modo somente leitura.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">Pronto para finalizar?</p>
                <p className="text-[11px] text-muted-foreground">
                  Após finalizar, a consulta ficará em modo somente leitura.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={onSave} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar
                </Button>
                <Button size="sm" onClick={onFinalize} className="gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Finalizar Consulta
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export */}
      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={onExportPdf} className="gap-1.5">
          <FileDown className="h-3.5 w-3.5" />
          Exportar PDF da Consulta
        </Button>
      </div>
    </>
  );
}
