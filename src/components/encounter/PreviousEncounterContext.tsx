/**
 * PreviousEncounterContext — Card mostrando contexto da última consulta.
 * Exibido no EncounterWorkspace para dar continuidade longitudinal.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, ChevronDown } from "lucide-react";

interface PreviousEncounterContextProps {
  patientId: string;
  currentEncounterId: string;
  practitionerId: string;
}

interface PrevData {
  encounter_date: string;
  chief_complaint: string | null;
  assessment: string | null;
  plan: string | null;
  objective: string | null;
  exams_requested: string | null;
}

export function PreviousEncounterContext({
  patientId,
  currentEncounterId,
  practitionerId,
}: PreviousEncounterContextProps) {
  const [prev, setPrev] = useState<PrevData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    (async () => {
      // Get current encounter date first
      const { data: current } = await (supabase as any)
        .from("clinical_encounters")
        .select("encounter_date")
        .eq("id", currentEncounterId)
        .single();

      if (!current) { setLoading(false); return; }

      // Find the most recent encounter BEFORE this one
      const { data: prevEnc } = await (supabase as any)
        .from("clinical_encounters")
        .select("id, encounter_date, chief_complaint")
        .eq("patient_id", patientId)
        .eq("practitioner_id", practitionerId)
        .lt("encounter_date", current.encounter_date)
        .order("encounter_date", { ascending: false })
        .limit(1)
        .single();

      if (!prevEnc) { setLoading(false); return; }

      // Get notes from that encounter
      const { data: prevNote } = await (supabase as any)
        .from("clinical_evolution_notes")
        .select("assessment, plan, objective, exams_requested")
        .eq("encounter_id", prevEnc.id)
        .single();

      setPrev({
        encounter_date: prevEnc.encounter_date,
        chief_complaint: prevEnc.chief_complaint,
        assessment: prevNote?.assessment ?? null,
        plan: prevNote?.plan ?? null,
        objective: prevNote?.objective ?? null,
        exams_requested: prevNote?.exams_requested ?? null,
      });
      setLoading(false);
    })();
  }, [patientId, currentEncounterId, practitionerId]);

  if (loading || !prev) return null;

  const hasContent = prev.assessment || prev.plan || prev.objective;
  if (!hasContent && !prev.chief_complaint) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-muted bg-muted/30">
        <CollapsibleTrigger asChild>
          <CardContent className="p-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  Última consulta — {format(parseISO(prev.encounter_date), "dd/MM/yyyy", { locale: ptBR })}
                </span>
                {prev.chief_complaint && (
                  <span className="text-[11px] text-foreground/60 truncate max-w-[200px]">
                    • {prev.chief_complaint}
                  </span>
                )}
              </div>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
            </div>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="px-3 pb-3 pt-0 space-y-2">
            {prev.assessment && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Avaliação anterior</p>
                <p className="text-xs text-foreground/70 whitespace-pre-wrap">{prev.assessment}</p>
              </div>
            )}
            {prev.plan && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Última conduta</p>
                <p className="text-xs text-foreground/70 whitespace-pre-wrap">{prev.plan}</p>
              </div>
            )}
            {prev.exams_requested && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Exames pedidos</p>
                <p className="text-xs text-foreground/70 whitespace-pre-wrap">{prev.exams_requested}</p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
