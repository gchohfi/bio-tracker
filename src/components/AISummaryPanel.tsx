import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  Brain,
  ChevronRight,
  AlertTriangle,
  TrendingUp,
  ListChecks,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AnalysisV2Data } from "@/components/ClinicalReportV2";

interface AISummaryPanelProps {
  analysis: {
    id: string;
    summary?: string | null;
    specialty_name?: string | null;
    created_at: string;
    model_used?: string | null;
  } | null;
  v2Data?: AnalysisV2Data | null;
  onOpenFullAnalysis: () => void;
}

export default function AISummaryPanel({ analysis, v2Data, onOpenFullAnalysis }: AISummaryPanelProps) {
  const [open, setOpen] = useState(false);

  if (!analysis) return null;

  const redFlags = v2Data?.red_flags ?? [];
  const findings = v2Data?.clinical_findings ?? [];
  const actions = v2Data?.suggested_actions ?? [];
  const executiveSummary = v2Data?.executive_summary ?? analysis.summary;

  // Pick top priority findings (high/critical)
  const topFindings = findings
    .filter((f: any) => f.priority === "critical" || f.priority === "high")
    .slice(0, 3);

  // Pick top actions
  const topActions = actions
    .filter((a: any) => a.priority === "critical" || a.priority === "high")
    .slice(0, 3);

  const hasContent = executiveSummary || redFlags.length > 0 || topFindings.length > 0;

  if (!hasContent) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "w-full justify-between gap-2 border border-dashed rounded-lg px-3 py-2 h-auto transition-colors",
            open
              ? "border-primary/30 bg-primary/5"
              : "border-muted-foreground/20 hover:border-primary/30 hover:bg-primary/5"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-medium truncate">
              Resumo IA — {analysis.specialty_name ?? "Análise"}
            </span>
            {redFlags.length > 0 && (
              <Badge variant="destructive" className="text-[9px] h-4 px-1 shrink-0">
                {redFlags.length} alerta{redFlags.length > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-90"
            )}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Card className="mt-2 border-primary/20 shadow-sm">
          <CardContent className="p-4 space-y-3">
            {/* Meta */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {format(parseISO(analysis.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </span>
              <span>{analysis.model_used ?? ""}</span>
            </div>

            {/* Executive Summary — expanded, no truncation */}
            {executiveSummary && (
              <p className="text-xs leading-relaxed text-foreground/90">
                {executiveSummary}
              </p>
            )}

            {/* Red Flags */}
            {redFlags.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Alertas Críticos
                </div>
                {redFlags.slice(0, 3).map((rf: any, i: number) => (
                  <div
                    key={rf.id ?? i}
                    className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive"
                  >
                    <span className="font-medium">{rf.finding}</span>
                    {rf.suggested_action && (
                      <span className="text-destructive/70 block mt-0.5 text-[10px]">→ {rf.suggested_action}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Top Findings */}
            {topFindings.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                  Achados Relevantes
                </div>
                {topFindings.map((f: any, i: number) => (
                  <div
                    key={f.id ?? i}
                    className="text-[11px] text-foreground/70 flex items-start gap-1.5"
                  >
                    <span className="text-primary mt-0.5">•</span>
                    <span>
                      <span className="font-medium text-foreground/90">{f.system}:</span>{" "}
                      {f.interpretation}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Top Actions */}
            {topActions.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                  <ListChecks className="h-3.5 w-3.5 text-primary" />
                  Próximos Passos
                </div>
                {topActions.map((a: any, i: number) => (
                  <div
                    key={a.id ?? i}
                    className="text-[11px] text-foreground/70 flex items-start gap-1.5"
                  >
                    <span className="text-primary mt-0.5">→</span>
                    <span>{a.description}</span>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs h-7 gap-1.5 border-primary/20 text-primary hover:bg-primary/5"
              onClick={onOpenFullAnalysis}
            >
              <Brain className="h-3 w-3" />
              Ver análise completa
              <ExternalLink className="h-3 w-3" />
            </Button>
          </CardContent>
        </Card>
      </CollapsibleContent>
    </Collapsible>
  );
}
