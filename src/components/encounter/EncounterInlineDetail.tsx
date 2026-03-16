/**
 * EncounterInlineDetail — Detalhe expandido inline de uma consulta.
 * Mostra campos com labels práticos, read-only, com visual compacto.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ExternalLink, PenLine } from "lucide-react";

interface EncounterInlineDetailProps {
  encounterId: string;
  patientId: string;
  isFinalized: boolean;
}

interface FullNote {
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  exams_requested: string | null;
  medications: string | null;
  free_notes: string | null;
}

const FIELD_LABELS: { key: keyof FullNote; label: string; color: string }[] = [
  { key: "subjective", label: "O que mudou desde a última consulta", color: "text-blue-600 dark:text-blue-400" },
  { key: "objective", label: "Achados objetivos", color: "text-violet-600 dark:text-violet-400" },
  { key: "assessment", label: "Avaliação clínica", color: "text-amber-600 dark:text-amber-400" },
  { key: "plan", label: "Conduta / Plano", color: "text-emerald-600 dark:text-emerald-400" },
  { key: "exams_requested", label: "Exames pedidos / Próximos passos", color: "text-cyan-600 dark:text-cyan-400" },
  { key: "medications", label: "Medicações", color: "text-pink-600 dark:text-pink-400" },
  { key: "free_notes", label: "Observações", color: "text-muted-foreground" },
];

export function EncounterInlineDetail({
  encounterId,
  patientId,
  isFinalized,
}: EncounterInlineDetailProps) {
  const navigate = useNavigate();
  const [note, setNote] = useState<FullNote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    (supabase as any)
      .from("clinical_evolution_notes")
      .select("subjective, objective, assessment, plan, exams_requested, medications, free_notes")
      .eq("encounter_id", encounterId)
      .single()
      .then(({ data }: any) => {
        setNote(data ?? null);
        setLoading(false);
      });
  }, [encounterId]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filledFields = FIELD_LABELS.filter(({ key }) => note && note[key]);
  const hasAnyContent = filledFields.length > 0;

  return (
    <Card className="mt-2 border-dashed bg-muted/30">
      <CardContent className="p-3 sm:p-4 space-y-2.5">
        {!hasAnyContent ? (
          <p className="text-xs text-muted-foreground italic">Nenhuma anotação registrada nesta consulta.</p>
        ) : (
          filledFields.map(({ key, label, color }) => (
            <div key={key} className="group">
              <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${color}`}>
                {label}
              </p>
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed line-clamp-4">
                {note![key]}
              </p>
            </div>
          ))
        )}

        <Separator />

        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant={isFinalized ? "outline" : "default"}
            className="gap-1.5 text-xs h-7"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/patient/${patientId}/encounter/${encounterId}`);
            }}
          >
            {isFinalized ? (
              <>
                <ExternalLink className="h-3 w-3" />
                Ver consulta
              </>
            ) : (
              <>
                <PenLine className="h-3 w-3" />
                Continuar editando
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
