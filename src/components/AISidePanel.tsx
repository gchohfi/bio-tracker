import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Brain,
  AlertTriangle,
  TrendingUp,
  ListChecks,
  Lightbulb,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AnalysisV2Data } from "@/components/ClinicalReportV2";
import PatientChatPanel from "@/components/PatientChatPanel";

interface AISidePanelProps {
  analysis: {
    id: string;
    summary?: string | null;
    specialty_name?: string | null;
    created_at: string;
    model_used?: string | null;
  } | null;
  v2Data?: AnalysisV2Data | null;
  patientId: string;
  patientName: string;
  onOpenFullAnalysis: () => void;
}

function PanelContent({
  analysis,
  v2Data,
  patientId,
  patientName,
  onOpenFullAnalysis,
}: AISidePanelProps) {
  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <Brain className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Nenhuma análise IA</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Importe exames e gere uma análise para ver insights aqui.
        </p>
      </div>
    );
  }

  const redFlags = v2Data?.red_flags ?? [];
  const findings = (v2Data?.clinical_findings ?? [])
    .filter((f: any) => f.priority === "critical" || f.priority === "high")
    .slice(0, 5);
  const hypotheses = (v2Data?.diagnostic_hypotheses ?? []).slice(0, 3);
  const actions = (v2Data?.suggested_actions ?? [])
    .filter((a: any) => a.priority === "critical" || a.priority === "high")
    .slice(0, 4);
  const followUp = v2Data?.follow_up;
  const executiveSummary = v2Data?.executive_summary ?? analysis.summary;

  return (
    <div className="space-y-4">
      {/* Meta */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {analysis.specialty_name ?? "Análise"}
        </span>
        <span>{format(parseISO(analysis.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
      </div>

      {/* Executive Summary */}
      {executiveSummary && (
        <p className="text-xs leading-relaxed text-foreground/80 line-clamp-4">
          {executiveSummary}
        </p>
      )}

      {/* Red Flags */}
      {redFlags.length > 0 && (
        <Section
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          title="Alertas Críticos"
          variant="destructive"
          count={redFlags.length}
        >
          {redFlags.slice(0, 4).map((rf: any, i: number) => (
            <div
              key={rf.id ?? i}
              className="rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive"
            >
              <span className="font-medium">{rf.finding}</span>
              {rf.suggested_action && (
                <span className="text-destructive/60 block mt-0.5 text-[10px]">→ {rf.suggested_action}</span>
              )}
            </div>
          ))}
        </Section>
      )}

      {/* Findings */}
      {findings.length > 0 && (
        <Section
          icon={<TrendingUp className="h-3.5 w-3.5" />}
          title="Achados Relevantes"
        >
          {findings.map((f: any, i: number) => (
            <div key={f.id ?? i} className="text-[11px] text-foreground/70 flex items-start gap-1.5">
              <span className="text-primary mt-0.5 shrink-0">•</span>
              <span>
                <span className="font-medium text-foreground/90">{f.system}:</span>{" "}
                {f.interpretation}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Hypotheses */}
      {hypotheses.length > 0 && (
        <Section
          icon={<Lightbulb className="h-3.5 w-3.5" />}
          title="Hipóteses"
        >
          {hypotheses.map((h: any, i: number) => (
            <div key={h.id ?? i} className="text-[11px] text-foreground/70 flex items-start gap-1.5">
              <span className="text-primary mt-0.5 shrink-0">◆</span>
              <span>
                <span className="font-medium text-foreground/90">{h.hypothesis}</span>
                {h.probability && (
                  <Badge variant="outline" className="ml-1 text-[9px] h-3.5 px-1 align-middle">
                    {h.probability}
                  </Badge>
                )}
              </span>
            </div>
          ))}
        </Section>
      )}

      {/* Actions */}
      {actions.length > 0 && (
        <Section
          icon={<ListChecks className="h-3.5 w-3.5" />}
          title="Próximos Passos"
        >
          {actions.map((a: any, i: number) => (
            <div key={a.id ?? i} className="text-[11px] text-foreground/70 flex items-start gap-1.5">
              <span className="text-primary mt-0.5 shrink-0">→</span>
              <span>{a.description}</span>
            </div>
          ))}
        </Section>
      )}

      {/* Follow-up */}
      {followUp && (typeof followUp === "object") && (
        <Section
          icon={<CalendarCheck className="h-3.5 w-3.5" />}
          title="Follow-up"
        >
          {followUp.suggested_return_days && (
            <div className="text-[11px] text-foreground/70">
              <span className="font-medium">Retorno:</span> {followUp.suggested_return_days} dias
            </div>
          )}
          {followUp.suggested_exams && followUp.suggested_exams.length > 0 && (
            <div className="text-[11px] text-foreground/70">
              <span className="font-medium">Exames:</span>{" "}
              {followUp.suggested_exams.slice(0, 5).join(", ")}
            </div>
          )}
          {followUp.notes && (
            <div className="text-[11px] text-foreground/70 italic">{followUp.notes}</div>
          )}
        </Section>
      )}

      <Separator />

      {/* CTA */}
      <Button
        variant="outline"
        size="sm"
        className="w-full text-xs h-7 gap-1.5 border-primary/20 text-primary hover:bg-primary/5"
        onClick={onOpenFullAnalysis}
      >
        <Brain className="h-3 w-3" />
        Análise completa
        <ExternalLink className="h-3 w-3" />
      </Button>

      {/* Chat */}
      <PatientChatPanel patientId={patientId} patientName={patientName} />
    </div>
  );
}

/** Section helper */
function Section({
  icon,
  title,
  variant,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  variant?: "destructive";
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className={cn(
        "flex items-center gap-1.5 text-xs font-semibold",
        variant === "destructive" ? "text-destructive" : "text-foreground/80"
      )}>
        {icon}
        {title}
        {count != null && count > 0 && (
          <Badge
            variant={variant === "destructive" ? "destructive" : "secondary"}
            className="text-[9px] h-3.5 px-1"
          >
            {count}
          </Badge>
        )}
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

/** Desktop sidebar (collapsible) */
function DesktopSidebar(props: AISidePanelProps & { open: boolean; onToggle: () => void }) {
  const { open, onToggle, ...rest } = props;

  return (
    <div
      className={cn(
        "relative shrink-0 transition-all duration-300 ease-in-out border-l bg-card",
        open ? "w-72 xl:w-80" : "w-10"
      )}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        className={cn(
          "absolute -left-3 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent transition-colors",
        )}
        title={open ? "Recolher painel IA" : "Expandir painel IA"}
      >
        {open ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      {/* Collapsed indicator */}
      {!open && (
        <div className="flex flex-col items-center gap-3 pt-12">
          <Brain className="h-4 w-4 text-primary/60" />
          <span className="text-[9px] text-muted-foreground [writing-mode:vertical-lr] rotate-180">
            Assistente IA
          </span>
          {props.v2Data?.red_flags && props.v2Data.red_flags.length > 0 && (
            <Badge variant="destructive" className="text-[8px] h-4 w-4 p-0 flex items-center justify-center">
              {props.v2Data.red_flags.length}
            </Badge>
          )}
        </div>
      )}

      {/* Expanded content */}
      {open && (
        <ScrollArea className="h-[calc(100vh-8rem)]">
          <div className="p-3">
            <PanelContent {...rest} />
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

/** Main export: renders desktop sidebar or mobile sheet */
export default function AISidePanel(props: AISidePanelProps) {
  const isMobile = useIsMobile();
  const [desktopOpen, setDesktopOpen] = useState(true);

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="fixed bottom-4 right-4 z-40 gap-1.5 shadow-lg border-primary/30 bg-background"
          >
            <Brain className="h-4 w-4 text-primary" />
            IA
            {props.v2Data?.red_flags && props.v2Data.red_flags.length > 0 && (
              <Badge variant="destructive" className="text-[9px] h-4 px-1">
                {props.v2Data.red_flags.length}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[75vh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Brain className="h-4 w-4 text-primary" />
              Assistente IA
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(75vh-4rem)] mt-2">
            <div className="pr-2">
              <PanelContent {...props} />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <DesktopSidebar
      {...props}
      open={desktopOpen}
      onToggle={() => setDesktopOpen(!desktopOpen)}
    />
  );
}
