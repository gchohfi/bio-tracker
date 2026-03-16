/**
 * EncounterInlineDetail — Detalhe expandido inline de uma consulta.
 * Mostra todos os campos SOAP com labels práticos, read-only.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, ExternalLink } from "lucide-react";

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

const FIELD_LABELS: { key: keyof FullNote; label: string }[] = [
  { key: "subjective", label: "O que mudou desde a última consulta" },
  { key: "objective", label: "Achados objetivos" },
  { key: "assessment", label: "Avaliação clínica" },
  { key: "plan", label: "Conduta / Plano" },
  { key: "exams_requested", label: "Exames pedidos / Próximos passos" },
  { key: "medications", label: "Medicações" },
  { key: "free_notes", label: "Observações" },
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

  const hasAnyContent = note && FIELD_LABELS.some(({ key }) => note[key]);

  return (
    <Card className="mt-2 border-dashed">
      <CardContent className="p-4 space-y-3">
        {!hasAnyContent ? (
          <p className="text-xs text-muted-foreground italic">Nenhuma anotação registrada nesta consulta.</p>
        ) : (
          FIELD_LABELS.filter(({ key }) => note && note[key]).map(({ key, label }) => (
            <div key={key}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                {label}
              </p>
              <p className="text-xs text-foreground/80 whitespace-pre-wrap leading-relaxed">
                {note![key]}
              </p>
            </div>
          ))
        )}

        <Separator />

        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/patient/${patientId}/encounter/${encounterId}`);
            }}
          >
            <ExternalLink className="h-3 w-3" />
            Abrir consulta completa
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
