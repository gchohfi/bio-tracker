/**
 * EncounterAIInlineSummary — Resumo inline da análise IA dentro da consulta.
 * Mostra: resumo executivo, red flags, achados principais, hipóteses, ações sugeridas.
 * Inclui status de revisão e CTA para gerar análise quando ausente.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Brain,
  AlertTriangle,
  Stethoscope,
  Lightbulb,
  Activity,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Pencil,
  X,
  Sparkles,
} from "lucide-react";
import type { AnalysisV2Data } from "@/components/ClinicalReportV2";

interface EncounterAIInlineSummaryProps {
  v2Data: AnalysisV2Data | null;
  analysisId?: string;
  onOpenFullAnalysis: () => void;
  onRequestGenerate?: () => void;
  isGenerating?: boolean;
}

interface ReviewStats {
  total: number;
  accepted: number;
  edited: number;
  rejected: number;
  pending: number;
}

export function EncounterAIInlineSummary({
  v2Data,
  analysisId,
  onOpenFullAnalysis,
  onRequestGenerate,
  isGenerating,
}: EncounterAIInlineSummaryProps) {
  const { user } = useAuth();
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Fetch review stats if analysis exists
  useEffect(() => {
    if (!analysisId || !user?.id) return;
    (supabase as any)
      .from("analysis_reviews")
      .select("review_state_json")
      .eq("analysis_id", analysisId)
      .eq("practitioner_id", user.id)
      .single()
      .then(({ data }: any) => {
        if (!data?.review_state_json) return;
        const state = data.review_state_json as Record<string, { decision: string }>;
        const entries = Object.values(state);
        const accepted = entries.filter((e) => e.decision === "accepted").length;
        const edited = entries.filter((e) => e.decision === "edited").length;
        const rejected = entries.filter((e) => e.decision === "rejected").length;
        const total = entries.length;
        setReviewStats({ total, accepted, edited, rejected, pending: total - accepted - edited - rejected });
      });
  }, [analysisId, user?.id]);

  // ── Empty state: no analysis ──
  if (!v2Data) {
    return (
      <Card className="border-dashed border-muted-foreground/30">
        <CardContent className="py-6 flex flex-col items-center text-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Nenhuma análise IA nesta consulta</p>
            <p className="text-xs text-muted-foreground mt-1">
              Gere uma análise para obter insights clínicos, hipóteses diagnósticas e sugestões de conduta.
            </p>
          </div>
          {onRequestGenerate && (
            <Button size="sm" onClick={onRequestGenerate} disabled={isGenerating} className="gap-1.5 mt-1">
              {isGenerating ? (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  Gerando...
                </>
              ) : (
                <>
                  <Brain className="h-3.5 w-3.5" />
                  Gerar Análise IA
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const redFlags = v2Data.red_flags ?? [];
  const findings = v2Data.clinical_findings ?? [];
  const hypotheses = v2Data.diagnostic_hypotheses ?? [];
  const actions = v2Data.suggested_actions ?? [];

  // Top findings: critical/high priority only, max 3
  const topFindings = findings
    .filter((f) => f.priority === "critical" || f.priority === "high")
    .slice(0, 3);

  // Top hypotheses: probable/possible, max 3
  const topHypotheses = hypotheses
    .filter((h) => h.likelihood === "probable" || h.likelihood === "possible")
    .slice(0, 3);

  // Top actions: critical/high, max 3
  const topActions = actions
    .filter((a) => a.priority === "critical" || a.priority === "high")
    .slice(0, 3);

  const ACTION_ICONS: Record<string, string> = {
    investigate: "🔍",
    treat: "💊",
    monitor: "📊",
    refer: "🏥",
  };

  const reviewComplete = reviewStats && reviewStats.pending === 0 && reviewStats.total > 0;

  return (
    <Card className="border-primary/20 overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-primary/5">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Análise IA</span>
            {reviewStats && (
              <Badge
                variant={reviewComplete ? "default" : "outline"}
                className={cn(
                  "text-[8px] h-4 px-1.5",
                  reviewComplete && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0"
                )}
              >
                {reviewComplete ? (
                  <><CheckCircle2 className="h-2 w-2 mr-0.5" />Revisada</>
                ) : (
                  <>{reviewStats.pending} pendente{reviewStats.pending !== 1 ? "s" : ""}</>
                )}
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="text-xs h-7 gap-1 text-primary hover:text-primary"
            onClick={onOpenFullAnalysis}
          >
            Ver completa
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>

        {/* Executive summary */}
        <div className="px-4 py-3">
          <p className="text-xs leading-relaxed text-foreground/80">{v2Data.executive_summary}</p>
        </div>

        {/* Red flags — always visible if present */}
        {redFlags.length > 0 && (
          <div className="px-4 pb-3">
            <div className="rounded-md bg-destructive/10 px-3 py-2 space-y-1">
              {redFlags.slice(0, 2).map((rf, i) => (
                <div key={rf.id ?? i} className="flex items-start gap-1.5 text-[11px]">
                  <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-destructive">{rf.finding}</span>
                    {rf.suggested_action && (
                      <span className="text-destructive/70"> — {rf.suggested_action}</span>
                    )}
                  </div>
                </div>
              ))}
              {redFlags.length > 2 && (
                <p className="text-[10px] text-destructive/60 pl-4.5">
                  +{redFlags.length - 2} alerta{redFlags.length - 2 > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Expandable details */}
        <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-center gap-1 py-2 border-t border-border/50 text-[11px] text-muted-foreground hover:bg-muted/30 transition-colors">
              <ChevronDown className={cn("h-3 w-3 transition-transform", detailsOpen && "rotate-180")} />
              {detailsOpen ? "Ocultar detalhes" : "Ver achados, hipóteses e ações"}
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-3">
              {/* Top clinical findings */}
              {topFindings.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Activity className="h-3 w-3 text-violet-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-400">
                      Achados Principais
                    </span>
                  </div>
                  <div className="space-y-1">
                    {topFindings.map((f) => (
                      <div key={f.id} className="text-[11px] text-foreground/70 flex items-start gap-1.5">
                        <span className="shrink-0 mt-0.5 text-[9px]">
                          {f.priority === "critical" ? "🔴" : "🟠"}
                        </span>
                        <div>
                          <span className="font-medium text-foreground/80">{f.system}:</span>{" "}
                          {f.interpretation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Diagnostic hypotheses */}
              {topHypotheses.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Stethoscope className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      Hipóteses Diagnósticas
                    </span>
                  </div>
                  <div className="space-y-1">
                    {topHypotheses.map((h) => (
                      <div key={h.id} className="text-[11px] text-foreground/70 flex items-start gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[8px] h-3.5 px-1 shrink-0 mt-0.5",
                            h.likelihood === "probable" && "border-amber-400 text-amber-700 dark:text-amber-300"
                          )}
                        >
                          {h.likelihood === "probable" ? "Provável" : "Possível"}
                        </Badge>
                        <span>{h.hypothesis}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested actions */}
              {topActions.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Lightbulb className="h-3 w-3 text-emerald-500" />
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      Ações Sugeridas
                    </span>
                  </div>
                  <div className="space-y-1">
                    {topActions.map((a) => (
                      <div key={a.id} className="text-[11px] text-foreground/70 flex items-start gap-1.5">
                        <span className="shrink-0">{ACTION_ICONS[a.action_type] ?? "▸"}</span>
                        <span>{a.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Review summary */}
              {reviewStats && reviewStats.total > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>Revisão:</span>
                    {reviewStats.accepted > 0 && (
                      <span className="flex items-center gap-0.5 text-emerald-600">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        {reviewStats.accepted} aceito{reviewStats.accepted !== 1 ? "s" : ""}
                      </span>
                    )}
                    {reviewStats.edited > 0 && (
                      <span className="flex items-center gap-0.5 text-blue-600">
                        <Pencil className="h-2.5 w-2.5" />
                        {reviewStats.edited} editado{reviewStats.edited !== 1 ? "s" : ""}
                      </span>
                    )}
                    {reviewStats.rejected > 0 && (
                      <span className="flex items-center gap-0.5 text-destructive">
                        <X className="h-2.5 w-2.5" />
                        {reviewStats.rejected} rejeitado{reviewStats.rejected !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
