/**
 * PatientLongitudinalContext — Bloco de contexto longitudinal do paciente
 * dentro da consulta. Mostra: últimas consultas, achados recentes,
 * última conduta, última análise IA e tendências de exames.
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
import {
  History,
  ChevronDown,
  ChevronRight,
  Brain,
  Pill,
  Stethoscope,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  FlaskConical,
  ExternalLink,
} from "lucide-react";

interface Props {
  patientId: string;
  currentEncounterId: string;
  practitionerId: string;
}

interface EncounterSummary {
  id: string;
  encounter_date: string;
  chief_complaint: string | null;
  status: string;
  assessment: string | null;
  plan: string | null;
  hasAnalysis: boolean;
  hasPrescription: boolean;
}

interface AISummary {
  executive_summary: string | null;
  red_flags_count: number;
  specialty_name: string | null;
  created_at: string;
}

interface LabTrend {
  marker_name: string;
  current_value: number | null;
  previous_value: number | null;
  flag: string | null;
  direction: "up" | "down" | "stable";
}

export function PatientLongitudinalContext({
  patientId,
  currentEncounterId,
  practitionerId,
}: Props) {
  const navigate = useNavigate();
  const [encounters, setEncounters] = useState<EncounterSummary[]>([]);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [labTrends, setLabTrends] = useState<LabTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    loadContext();
  }, [patientId, currentEncounterId, practitionerId]);

  const loadContext = async () => {
    setLoading(true);

    // Fetch last 4 encounters (excluding current), latest analysis, and lab sessions in parallel
    const [encRes, analysisRes, sessionsRes] = await Promise.all([
      (supabase as any)
        .from("clinical_encounters")
        .select("id, encounter_date, chief_complaint, status")
        .eq("patient_id", patientId)
        .eq("practitioner_id", practitionerId)
        .neq("id", currentEncounterId)
        .order("encounter_date", { ascending: false })
        .limit(4),
      (supabase as any)
        .from("patient_analyses")
        .select("analysis_v2_data, specialty_name, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(1),
      (supabase as any)
        .from("lab_sessions")
        .select("id, session_date")
        .eq("patient_id", patientId)
        .order("session_date", { ascending: false })
        .limit(2),
    ]);

    const prevEncounters = encRes.data ?? [];

    // Fetch SOAP notes + linked data for each encounter
    if (prevEncounters.length > 0) {
      const encIds = prevEncounters.map((e: any) => e.id);

      const [notesRes, analysesCountRes, rxCountRes] = await Promise.all([
        (supabase as any)
          .from("clinical_evolution_notes")
          .select("encounter_id, assessment, plan")
          .in("encounter_id", encIds),
        (supabase as any)
          .from("patient_analyses")
          .select("encounter_id")
          .in("encounter_id", encIds),
        (supabase as any)
          .from("clinical_prescriptions")
          .select("encounter_id")
          .in("encounter_id", encIds),
      ]);

      const notesMap = new Map<string, { assessment: string | null; plan: string | null }>();
      for (const n of (notesRes.data ?? [])) {
        notesMap.set(n.encounter_id, { assessment: n.assessment, plan: n.plan });
      }
      const analysisSet = new Set((analysesCountRes.data ?? []).map((a: any) => a.encounter_id));
      const rxSet = new Set((rxCountRes.data ?? []).map((r: any) => r.encounter_id));

      setEncounters(
        prevEncounters.map((e: any) => ({
          id: e.id,
          encounter_date: e.encounter_date,
          chief_complaint: e.chief_complaint,
          status: e.status,
          assessment: notesMap.get(e.id)?.assessment ?? null,
          plan: notesMap.get(e.id)?.plan ?? null,
          hasAnalysis: analysisSet.has(e.id),
          hasPrescription: rxSet.has(e.id),
        }))
      );
    }

    // Latest AI analysis summary
    const latestAnalysis = analysisRes.data?.[0];
    if (latestAnalysis?.analysis_v2_data) {
      const v2 = typeof latestAnalysis.analysis_v2_data === "string"
        ? JSON.parse(latestAnalysis.analysis_v2_data)
        : latestAnalysis.analysis_v2_data;
      setAiSummary({
        executive_summary: v2.executive_summary ?? null,
        red_flags_count: v2.red_flags?.length ?? 0,
        specialty_name: latestAnalysis.specialty_name,
        created_at: latestAnalysis.created_at,
      });
    }

    // Lab trends: compare last 2 sessions for altered markers
    const sessions = sessionsRes.data ?? [];
    if (sessions.length >= 2) {
      const [currentLabRes, prevLabRes] = await Promise.all([
        (supabase as any)
          .from("lab_historical_results")
          .select("marker_name, value, flag")
          .eq("session_id", sessions[0].id)
          .in("flag", ["high", "low", "critical_high", "critical_low"])
          .limit(6),
        (supabase as any)
          .from("lab_historical_results")
          .select("marker_name, value")
          .eq("session_id", sessions[1].id)
          .limit(100),
      ]);

      const prevMap = new Map<string, number>();
      for (const r of (prevLabRes.data ?? [])) {
        if (r.value != null && r.marker_name) prevMap.set(r.marker_name, r.value);
      }

      const trends: LabTrend[] = (currentLabRes.data ?? [])
        .filter((r: any) => r.marker_name && r.value != null)
        .map((r: any) => {
          const prev = prevMap.get(r.marker_name);
          let direction: "up" | "down" | "stable" = "stable";
          if (prev != null && r.value != null) {
            const diff = r.value - prev;
            const pct = prev !== 0 ? Math.abs(diff / prev) : 0;
            if (pct > 0.05) direction = diff > 0 ? "up" : "down";
          }
          return {
            marker_name: r.marker_name,
            current_value: r.value,
            previous_value: prev ?? null,
            flag: r.flag,
            direction,
          };
        });
      setLabTrends(trends);
    } else if (sessions.length === 1) {
      // Just show current altered markers
      const { data: currentLab } = await (supabase as any)
        .from("lab_historical_results")
        .select("marker_name, value, flag")
        .eq("session_id", sessions[0].id)
        .in("flag", ["high", "low", "critical_high", "critical_low"])
        .limit(6);
      setLabTrends(
        (currentLab ?? [])
          .filter((r: any) => r.marker_name)
          .map((r: any) => ({
            marker_name: r.marker_name,
            current_value: r.value,
            previous_value: null,
            flag: r.flag,
            direction: "stable" as const,
          }))
      );
    }

    setLoading(false);
  };

  if (loading || (encounters.length === 0 && !aiSummary && labTrends.length === 0)) return null;

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
                <span className="text-xs font-medium text-foreground">
                  Contexto do Paciente
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {encounters.length} consulta{encounters.length !== 1 ? "s" : ""} anterior{encounters.length !== 1 ? "es" : ""}
                </span>
                {aiSummary && aiSummary.red_flags_count > 0 && (
                  <Badge variant="destructive" className="text-[8px] h-3.5 px-1 gap-0.5">
                    <AlertTriangle className="h-2 w-2" />
                    {aiSummary.red_flags_count} alerta{aiSummary.red_flags_count > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform shrink-0",
                  open && "rotate-180"
                )}
              />
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <Separator />
          <CardContent className="p-3 space-y-3">

            {/* ── Last AI summary ── */}
            {aiSummary?.executive_summary && (
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <Brain className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                    Última Análise IA
                  </span>
                  <span className="text-[9px] text-muted-foreground ml-auto">
                    {format(parseISO(aiSummary.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    {aiSummary.specialty_name && ` • ${aiSummary.specialty_name}`}
                  </span>
                </div>
                <p className="text-[11px] text-foreground/70 leading-relaxed line-clamp-3">
                  {aiSummary.executive_summary}
                </p>
              </div>
            )}

            {/* ── Lab trends ── */}
            {labTrends.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <FlaskConical className="h-3 w-3 text-violet-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                    Marcadores Alterados
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {labTrends.map((t, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-md px-2 py-1 text-[10px] flex items-center gap-1",
                        t.flag?.startsWith("critical")
                          ? "bg-destructive/10 text-destructive"
                          : "bg-accent text-foreground"
                      )}
                    >
                      <span className="font-medium">{t.marker_name}</span>
                      <span className="text-muted-foreground">
                        {t.current_value != null ? Number(t.current_value).toFixed(1) : "—"}
                      </span>
                      {t.direction === "up" && <TrendingUp className="h-2.5 w-2.5 text-destructive" />}
                      {t.direction === "down" && <TrendingDown className="h-2.5 w-2.5 text-emerald-600" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Previous encounters timeline ── */}
            {encounters.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Stethoscope className="h-3 w-3 text-amber-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    Consultas Anteriores
                  </span>
                </div>
                <div className="space-y-1.5">
                  {encounters.map((enc) => (
                    <button
                      key={enc.id}
                      onClick={() => navigate(`/patient/${patientId}/encounter/${enc.id}`)}
                      className="w-full text-left rounded-md px-2.5 py-2 bg-background border border-border/50 hover:border-primary/30 hover:bg-accent/30 transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                            {format(parseISO(enc.encounter_date), "dd/MM", { locale: ptBR })}
                          </span>
                          {enc.chief_complaint && (
                            <span className="text-[11px] text-foreground/80 truncate">
                              {enc.chief_complaint}
                            </span>
                          )}
                          {!enc.chief_complaint && enc.assessment && (
                            <span className="text-[11px] text-foreground/60 truncate italic">
                              {enc.assessment.slice(0, 60)}{enc.assessment.length > 60 ? "…" : ""}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {enc.hasAnalysis && (
                            <Brain className="h-2.5 w-2.5 text-primary/60" />
                          )}
                          {enc.hasPrescription && (
                            <Pill className="h-2.5 w-2.5 text-primary/60" />
                          )}
                          <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      {/* Show last plan/conduct for the most recent encounter */}
                      {enc === encounters[0] && enc.plan && (
                        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">Conduta: </span>
                          {enc.plan}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Link to full patient history */}
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs h-7 text-muted-foreground hover:text-foreground"
                onClick={() => navigate(`/patient/${patientId}?tab=consultas`)}
              >
                <ExternalLink className="h-3 w-3" />
                Ver histórico completo
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
