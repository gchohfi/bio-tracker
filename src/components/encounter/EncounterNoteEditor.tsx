/**
 * EncounterNoteEditor — SOAP evolution note form with color-coded fields.
 * Extracted from EncounterWorkspace for focused responsibility.
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  FileText,
  Save,
  Loader2,
  ChevronRight,
} from "lucide-react";
import type { EvolutionNote } from "@/hooks/useEncounterData";

// ── EvolutionField — reusable field with color-coded label ──

function EvolutionField({
  label,
  hint,
  value,
  onChange,
  disabled,
  placeholder,
  rows = 3,
  color = "text-muted-foreground",
  important,
  optional,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder: string;
  rows?: number;
  color?: string;
  important?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <label className={cn("text-[11px] font-semibold uppercase tracking-wide", color)}>
          {label}
        </label>
        {important && <span className="text-[9px] text-primary font-medium">●</span>}
        {optional && <span className="text-[9px] text-muted-foreground">(opcional)</span>}
      </div>
      {hint && <p className="text-[10px] text-muted-foreground -mt-0.5 mb-1">{hint}</p>}
      {disabled ? (
        value ? (
          <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{value}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">—</p>
        )
      ) : (
        <Textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="text-sm resize-y min-h-[40px]"
          placeholder={placeholder}
        />
      )}
    </div>
  );
}

// ── Props ──

interface EncounterNoteEditorProps {
  note: EvolutionNote & { id?: string };
  setNote: React.Dispatch<React.SetStateAction<EvolutionNote & { id?: string }>>;
  isFinalized: boolean;
  saving: boolean;
  onSave: () => void;
  onNextStep: () => void;
}

export function EncounterNoteEditor({
  note,
  setNote,
  isFinalized,
  saving,
  onSave,
  onNextStep,
}: EncounterNoteEditorProps) {
  return (
    <Card>
      <CardContent className="py-4 px-5 space-y-5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Evolução Clínica</h2>
          {isFinalized && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">Somente leitura</Badge>
          )}
        </div>

        <EvolutionField label="O que mudou desde a última consulta" hint="Relato do paciente sobre evolução, sintomas novos ou melhorados" value={note.subjective} onChange={(v) => setNote((prev) => ({ ...prev, subjective: v }))} disabled={isFinalized} placeholder="Relato do paciente, evolução dos sintomas..." rows={3} color="text-blue-600 dark:text-blue-400" />
        <EvolutionField label="Achados objetivos relevantes" hint="Exame físico, sinais vitais, dados mensuráveis" value={note.objective} onChange={(v) => setNote((prev) => ({ ...prev, objective: v }))} disabled={isFinalized} placeholder="PA, FC, exame físico dirigido, dados mensuráveis..." rows={3} color="text-violet-600 dark:text-violet-400" />
        <Separator />
        <EvolutionField label="Avaliação clínica" hint="Impressão diagnóstica, hipóteses, correlações" value={note.assessment} onChange={(v) => setNote((prev) => ({ ...prev, assessment: v }))} disabled={isFinalized} placeholder="Impressão diagnóstica, correlações clínicas..." rows={3} color="text-amber-600 dark:text-amber-400" important />
        <EvolutionField label="Conduta / Plano" hint="Tratamento, ajustes terapêuticos, orientações" value={note.plan} onChange={(v) => setNote((prev) => ({ ...prev, plan: v }))} disabled={isFinalized} placeholder="Tratamento, ajustes, orientações..." rows={3} color="text-emerald-600 dark:text-emerald-400" important />
        <Separator />
        <EvolutionField label="Exames pedidos / Próximos passos" value={note.exams_requested} onChange={(v) => setNote((prev) => ({ ...prev, exams_requested: v }))} disabled={isFinalized} placeholder="Exames a solicitar, retorno, encaminhamentos..." rows={2} color="text-cyan-600 dark:text-cyan-400" />
        <EvolutionField label="Medicações" value={note.medications} onChange={(v) => setNote((prev) => ({ ...prev, medications: v }))} disabled={isFinalized} placeholder="Medicamentos prescritos ou ajustados..." rows={2} color="text-pink-600 dark:text-pink-400" />
        <EvolutionField label="Observações" value={note.free_notes} onChange={(v) => setNote((prev) => ({ ...prev, free_notes: v }))} disabled={isFinalized} placeholder="Notas livres, lembretes, contexto adicional..." rows={2} color="text-muted-foreground" optional />

        {!isFinalized && (
          <div className="flex justify-between">
            <Button size="sm" variant="outline" onClick={onSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Salvar nota
            </Button>
            <Button size="sm" onClick={() => { onSave(); onNextStep(); }} className="gap-1.5">
              Próximo: Análise IA <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {isFinalized && (
          <div className="flex justify-end">
            <Button size="sm" onClick={onNextStep} className="gap-1.5">
              Próximo: Análise IA <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
