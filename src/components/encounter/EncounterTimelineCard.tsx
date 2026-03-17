/**
 * EncounterTimelineCard — Card resumido de consulta na timeline.
 * Mostra data, especialidade, QP, achados, conduta e status de análise/prescrição.
 * Expande inline com animação suave ao clicar.
 */
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronDown,
  ChevronRight,
  Brain,
  Pill,
  FileText,
  FileDown,
  Loader2,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportEncounterPdfStandalone } from "@/lib/exportEncounterPdfStandalone";

interface EncounterTimelineCardProps {
  encounter: {
    id: string;
    encounter_date: string;
    status: "draft" | "finalized";
    chief_complaint: string | null;
    specialty_id: string;
    created_at: string;
    patient_id?: string;
  };
  specialtyLabel: string;
  patientId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
  children?: React.ReactNode;
}

interface NoteSummary {
  assessment: string | null;
  plan: string | null;
  objective: string | null;
  exams_requested: string | null;
}

interface StatusInfo {
  hasAnalysis: boolean;
  hasPrescription: boolean;
  prescriptionStatus?: "draft" | "finalized";
}

export function EncounterTimelineCard({
  encounter,
  specialtyLabel,
  patientId,
  isExpanded,
  onToggle,
  onClose,
  children,
}: EncounterTimelineCardProps) {
  const { toast } = useToast();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [noteSummary, setNoteSummary] = useState<NoteSummary | null>(null);
  const [statusInfo, setStatusInfo] = useState<StatusInfo>({ hasAnalysis: false, hasPrescription: false });
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchNote = (supabase as any)
      .from("clinical_evolution_notes")
      .select("assessment, plan, objective, exams_requested")
      .eq("encounter_id", encounter.id)
      .single()
      .then(({ data }: any) => {
        if (data) setNoteSummary(data);
      });

    const fetchAnalysis = (supabase as any)
      .from("patient_analyses")
      .select("id")
      .eq("encounter_id", encounter.id)
      .limit(1)
      .then(({ data }: any) => ({ hasAnalysis: (data?.length ?? 0) > 0 }));

    const fetchPrescription = (supabase as any)
      .from("clinical_prescriptions")
      .select("id, status")
      .eq("encounter_id", encounter.id)
      .limit(1)
      .then(({ data }: any) => ({
        hasPrescription: (data?.length ?? 0) > 0,
        prescriptionStatus: data?.[0]?.status,
      }));

    Promise.all([fetchNote, fetchAnalysis, fetchPrescription]).then(
      ([, analysisResult, prescriptionResult]) => {
        setStatusInfo({
          hasAnalysis: analysisResult.hasAnalysis,
          hasPrescription: prescriptionResult.hasPrescription,
          prescriptionStatus: prescriptionResult.prescriptionStatus,
        });
      }
    );
  }, [encounter.id]);

  // Scroll into view when expanded
  useEffect(() => {
    if (isExpanded && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 150);
    }
  }, [isExpanded]);

  const isDraft = encounter.status === "draft";
  const hasContent = noteSummary && (noteSummary.assessment || noteSummary.plan || noteSummary.objective);

  return (
    <div className="relative" ref={cardRef}>
      {/* Timeline dot + line */}
      <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
      <div
        className={cn(
          "absolute left-2.5 top-5 h-3 w-3 rounded-full border-2 z-10 transition-colors",
          isExpanded
            ? "bg-primary border-primary"
            : isDraft
              ? "bg-amber-400 border-background"
              : "bg-emerald-500 border-background"
        )}
      />

      <div className="pl-10">
        <Card
          className={cn(
            "cursor-pointer transition-all duration-200",
            isExpanded
              ? "ring-2 ring-primary/30 shadow-md border-primary/20"
              : "hover:shadow-sm"
            ,
            isDraft && !isExpanded && "border-l-2 border-l-amber-400"
          )}
          onClick={onToggle}
        >
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {/* Date + status */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn(
                    "text-sm font-semibold",
                    isExpanded ? "text-primary" : "text-foreground"
                  )}>
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
                    {noteSummary.objective && (
                      <p className="text-[11px] text-foreground/70 line-clamp-1">
                        <span className="font-medium text-muted-foreground">Achados:</span>{" "}
                        {noteSummary.objective}
                      </p>
                    )}
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

                {/* Status badges */}
                {(statusInfo.hasAnalysis || statusInfo.hasPrescription || noteSummary?.exams_requested) && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {statusInfo.hasAnalysis && (
                      <Badge variant="secondary" className="text-[9px] h-4 px-1.5 gap-0.5">
                        <Brain className="h-2.5 w-2.5" />
                        Análise IA
                      </Badge>
                    )}
                    {statusInfo.hasPrescription && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[9px] h-4 px-1.5 gap-0.5",
                          statusInfo.prescriptionStatus === "finalized" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                        )}
                      >
                        <Pill className="h-2.5 w-2.5" />
                        Prescrição
                      </Badge>
                    )}
                    {noteSummary?.exams_requested && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5">
                        <FileText className="h-2.5 w-2.5" />
                        Exames
                      </Badge>
                    )}
                  </div>
                )}
              </div>

              {/* Expand / close icon */}
              <div className="shrink-0 mt-1 text-muted-foreground">
                {isExpanded ? (
                  <button
                    className="p-0.5 rounded hover:bg-muted transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    aria-label="Fechar detalhe"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inline detail — animated */}
        <Collapsible open={isExpanded}>
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2 duration-200">
            {isExpanded && children}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
