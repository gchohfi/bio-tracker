/**
 * EncounterTimelineCard — Card resumido de consulta na timeline.
 * Mostra data, especialidade, QP, achados e conduta resumida.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  PenLine,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface EncounterTimelineCardProps {
  encounter: {
    id: string;
    encounter_date: string;
    status: "draft" | "finalized";
    chief_complaint: string | null;
    specialty_id: string;
    created_at: string;
  };
  specialtyLabel: string;
  isExpanded: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}

interface NoteSummary {
  assessment: string | null;
  plan: string | null;
  objective: string | null;
  exams_requested: string | null;
}

export function EncounterTimelineCard({
  encounter,
  specialtyLabel,
  isExpanded,
  onToggle,
  children,
}: EncounterTimelineCardProps) {
  const [noteSummary, setNoteSummary] = useState<NoteSummary | null>(null);

  useEffect(() => {
    (supabase as any)
      .from("clinical_evolution_notes")
      .select("assessment, plan, objective, exams_requested")
      .eq("encounter_id", encounter.id)
      .single()
      .then(({ data }: any) => {
        if (data) setNoteSummary(data);
      });
  }, [encounter.id]);

  const isDraft = encounter.status === "draft";
  const hasContent = noteSummary && (noteSummary.assessment || noteSummary.plan || noteSummary.objective);

  return (
    <div className="relative">
      {/* Timeline dot + line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      <div
        className={cn(
          "absolute left-2.5 top-5 h-3 w-3 rounded-full border-2 border-background z-10",
          isDraft ? "bg-amber-400" : "bg-emerald-500"
        )}
      />

      <div className="pl-10">
        <Card
          className={cn(
            "cursor-pointer transition-all hover:shadow-sm",
            isExpanded && "ring-1 ring-primary/20",
            isDraft && "border-l-2 border-l-amber-400"
          )}
          onClick={onToggle}
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {/* Date + status */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">
                    {format(parseISO(encounter.encounter_date), "dd 'de' MMM yyyy", { locale: ptBR })}
                  </span>
                  <Badge
                    variant={isDraft ? "outline" : "default"}
                    className={cn(
                      "text-[9px] h-4 px-1.5",
                      !isDraft && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0",
                      isDraft && "border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-300"
                    )}
                  >
                    {isDraft ? "Rascunho" : "Finalizada"}
                  </Badge>
                </div>

                {/* Specialty */}
                <p className="text-[11px] text-muted-foreground mt-0.5">{specialtyLabel}</p>

                {/* Chief complaint */}
                {encounter.chief_complaint && (
                  <p className="text-xs text-foreground/80 mt-1">
                    <span className="font-medium text-muted-foreground">QP:</span>{" "}
                    {encounter.chief_complaint}
                  </p>
                )}

                {/* Quick summary — only when collapsed */}
                {!isExpanded && hasContent && (
                  <div className="mt-2 space-y-0.5">
                    {noteSummary.assessment && (
                      <p className="text-[11px] text-foreground/70 line-clamp-1">
                        <span className="font-medium text-muted-foreground">Avaliação:</span>{" "}
                        {noteSummary.assessment}
                      </p>
                    )}
                    {noteSummary.plan && (
                      <p className="text-[11px] text-foreground/70 line-clamp-1">
                        <span className="font-medium text-muted-foreground">Conduta:</span>{" "}
                        {noteSummary.plan}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Expand icon */}
              <div className="shrink-0 mt-1 text-muted-foreground">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inline detail — rendered as children */}
        {isExpanded && children}
      </div>
    </div>
  );
}
