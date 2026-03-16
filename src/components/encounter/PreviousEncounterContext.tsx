/**
 * PreviousEncounterContext — Bloco de resumo da consulta anterior.
 * Exibido no EncounterWorkspace para continuidade longitudinal.
 * Mostra: data, QP, achados, conduta, exames pedidos e status da análise IA.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, ChevronDown, ExternalLink, Brain, Pill } from "lucide-react";

interface PreviousEncounterContextProps {
  patientId: string;
  currentEncounterId: string;
  practitionerId: string;
}

interface PrevData {
  encounter_id: string;
  encounter_date: string;
  chief_complaint: string | null;
  assessment: string | null;
  plan: string | null;
  objective: string | null;
  exams_requested: string | null;
  hasAnalysis: boolean;
  hasPrescription: boolean;
}

const SECTIONS: { key: keyof Pick<PrevData, "objective" | "assessment" | "plan" | "exams_requested">; label: string; color: string }[] = [
  { key: "objective", label: "Achados", color: "text-violet-600 dark:text-violet-400" },
  { key: "assessment", label: "Avaliação anterior", color: "text-amber-600 dark:text-amber-400" },
  { key: "plan", label: "Última conduta", color: "text-emerald-600 dark:text-emerald-400" },
  { key: "exams_requested", label: "Exames pedidos", color: "text-cyan-600 dark:text-cyan-400" },
];

export function PreviousEncounterContext({
  patientId,
  currentEncounterId,
  practitionerId,
}: PreviousEncounterContextProps) {
  const navigate = useNavigate();
  const [prev, setPrev] = useState<PrevData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    (async () => {
      // Get current encounter date
      const { data: current } = await (supabase as any)
        .from("clinical_encounters")
        .select("encounter_date")
        .eq("id", currentEncounterId)
        .single();

      if (!current) { setLoading(false); return; }

      // Find the most recent encounter BEFORE this one
      const { data: prevList } = await (supabase as any)
        .from("clinical_encounters")
        .select("id, encounter_date, chief_complaint")
        .eq("patient_id", patientId)
        .eq("practitioner_id", practitionerId)
        .lt("encounter_date", current.encounter_date)
        .order("encounter_date", { ascending: false })
        .limit(1);

      const prevEnc = prevList?.[0] ?? null;

      if (!prevEnc) { setLoading(false); return; }

      // Fetch notes, analysis, and prescription in parallel
      const [noteRes, analysisRes, prescriptionRes] = await Promise.all([
        (supabase as any)
          .from("clinical_evolution_notes")
          .select("assessment, plan, objective, exams_requested")
          .eq("encounter_id", prevEnc.id)
          .single(),
        (supabase as any)
          .from("patient_analyses")
          .select("id")
          .eq("encounter_id", prevEnc.id)
          .limit(1),
        (supabase as any)
          .from("clinical_prescriptions")
          .select("id")
          .eq("encounter_id", prevEnc.id)
          .limit(1),
      ]);

      setPrev({
        encounter_id: prevEnc.id,
        encounter_date: prevEnc.encounter_date,
        chief_complaint: prevEnc.chief_complaint,
        assessment: noteRes.data?.assessment ?? null,
        plan: noteRes.data?.plan ?? null,
        objective: noteRes.data?.objective ?? null,
        exams_requested: noteRes.data?.exams_requested ?? null,
        hasAnalysis: (analysisRes.data?.length ?? 0) > 0,
        hasPrescription: (prescriptionRes.data?.length ?? 0) > 0,
      });
      setLoading(false);
    })();
  }, [patientId, currentEncounterId, practitionerId]);

  if (loading || !prev) return null;

  const hasContent = prev.assessment || prev.plan || prev.objective || prev.exams_requested;
  if (!hasContent && !prev.chief_complaint) return null;

  const filledSections = SECTIONS.filter(({ key }) => prev[key]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-muted bg-muted/20 overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardContent className="p-3 cursor-pointer hover:bg-muted/40 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted shrink-0">
                  <History className="h-3 w-3 text-muted-foreground" />
                </div>
                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                  <span className="text-xs font-medium text-foreground">
                    Última consulta
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {format(parseISO(prev.encounter_date), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  {prev.chief_complaint && (
                    <span className="text-[11px] text-foreground/60 truncate max-w-[200px]">
                      — {prev.chief_complaint}
                    </span>
                  )}
                </div>
                {/* Status badges inline */}
                {(prev.hasAnalysis || prev.hasPrescription) && (
                  <div className="flex items-center gap-1 ml-1">
                    {prev.hasAnalysis && (
                      <Badge variant="secondary" className="text-[8px] h-3.5 px-1 gap-0.5">
                        <Brain className="h-2 w-2" />
                        IA
                      </Badge>
                    )}
                    {prev.hasPrescription && (
                      <Badge variant="secondary" className="text-[8px] h-3.5 px-1 gap-0.5">
                        <Pill className="h-2 w-2" />
                        Rx
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0",
                open && "rotate-180"
              )} />
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator />
          <CardContent className="p-3 space-y-2.5">
            {filledSections.map(({ key, label, color }) => (
              <div key={key}>
                <p className={cn("text-[10px] font-semibold uppercase tracking-wide mb-0.5", color)}>
                  {label}
                </p>
                <p className="text-xs text-foreground/70 whitespace-pre-wrap leading-relaxed line-clamp-3">
                  {prev[key]}
                </p>
              </div>
            ))}

            {/* Action: view full encounter */}
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/patient/${patientId}/encounter/${prev.encounter_id}`);
                }}
              >
                <ExternalLink className="h-3 w-3" />
                Ver consulta anterior completa
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
