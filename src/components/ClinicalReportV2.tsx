import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Activity,
  Lightbulb,
  Stethoscope,
  ChevronDown,
  ChevronRight,
  Shield,
  FlaskConical,
  Info,
} from "lucide-react";

// ── Types matching analysisResponseV2.types.ts ──────────────────────────

type ClinicalPriority = "critical" | "high" | "medium" | "low";
type ConfidenceLevel = "high" | "moderate" | "low";
type SourceType = "deterministic" | "llm" | "hybrid";
type RedFlagSeverity = "critical" | "high" | "moderate";

interface ClinicalItemBase {
  id: string;
  source_type: SourceType;
  specialty_relevant: boolean;
  cross_specialty_alert: boolean;
}

interface RedFlagItem extends ClinicalItemBase {
  finding: string;
  severity: RedFlagSeverity;
  suggested_action: string;
  evidence: string[];
}

interface ClinicalFindingItem extends ClinicalItemBase {
  system: string;
  markers: string[];
  interpretation: string;
  priority: ClinicalPriority;
  confidence: ConfidenceLevel;
}

interface DiagnosticHypothesisItem extends ClinicalItemBase {
  hypothesis: string;
  supporting_findings: string[];
  contradicting_findings?: string[];
  confirmatory_exams?: string[];
  likelihood: "probable" | "possible" | "unlikely";
  priority: ClinicalPriority;
}

interface SuggestedActionItem extends ClinicalItemBase {
  action_type: "investigate" | "treat" | "monitor" | "refer";
  description: string;
  rationale: string;
  priority: ClinicalPriority;
  confidence: ConfidenceLevel;
}

interface FollowUp {
  suggested_exams: string[];
  suggested_return_days?: number;
  notes?: string;
}

export interface AnalysisV2Data {
  executive_summary: string;
  red_flags: RedFlagItem[];
  clinical_findings: ClinicalFindingItem[];
  diagnostic_hypotheses: DiagnosticHypothesisItem[];
  suggested_actions: SuggestedActionItem[];
  follow_up?: FollowUp;
  meta: {
    specialty_id: string;
    specialty_name: string;
    mode: string;
    version: string;
    model_used?: string;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<ClinicalPriority, { label: string; className: string }> = {
  critical: { label: "Crítico", className: "bg-destructive text-destructive-foreground" },
  high: { label: "Alto", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  medium: { label: "Médio", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  low: { label: "Baixo", className: "bg-muted text-muted-foreground" },
};

const SEVERITY_CONFIG: Record<RedFlagSeverity, { label: string; className: string }> = {
  critical: { label: "Crítico", className: "bg-destructive text-destructive-foreground" },
  high: { label: "Alto", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  moderate: { label: "Moderado", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
};

const SOURCE_LABELS: Record<SourceType, string> = {
  deterministic: "Dados Lab",
  llm: "IA",
  hybrid: "Híbrido",
};

const ACTION_TYPE_ICONS: Record<string, string> = {
  investigate: "🔍",
  treat: "💊",
  monitor: "📊",
  refer: "🏥",
};

function PriorityBadge({ priority }: { priority: ClinicalPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return <Badge className={cn("text-[10px] font-medium", cfg.className)}>{cfg.label}</Badge>;
}

function SourceBadge({ source }: { source: SourceType }) {
  return (
    <Badge variant="outline" className="text-[9px] font-normal gap-1">
      {source === "deterministic" && <Shield className="h-2.5 w-2.5" />}
      {source === "llm" && <Lightbulb className="h-2.5 w-2.5" />}
      {SOURCE_LABELS[source]}
    </Badge>
  );
}

// ── Section Components ──────────────────────────────────────────────────

function RedFlagsSection({ flags }: { flags: RedFlagItem[] }) {
  if (flags.length === 0) return null;

  return (
    <div className="rounded-lg border-2 border-destructive/50 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h3 className="font-bold text-sm text-destructive uppercase tracking-wide">
          Alertas Críticos ({flags.length})
        </h3>
      </div>
      <div className="space-y-2">
        {flags.map((flag) => (
          <div key={flag.id} className="rounded-md bg-background p-3 border border-destructive/20 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{flag.finding}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge className={cn("text-[10px]", SEVERITY_CONFIG[flag.severity].className)}>
                  {SEVERITY_CONFIG[flag.severity].label}
                </Badge>
                <SourceBadge source={flag.source_type} />
              </div>
            </div>
            {flag.evidence.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5">
                {flag.evidence.map((e, i) => (
                  <p key={i}>• {e}</p>
                ))}
              </div>
            )}
            <p className="text-xs font-medium text-destructive/80">
              ➜ {flag.suggested_action}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClinicalFindingsSection({ findings }: { findings: ClinicalFindingItem[] }) {
  if (findings.length === 0) return null;

  // Group by system
  const grouped: Record<string, ClinicalFindingItem[]> = {};
  for (const f of findings) {
    if (!grouped[f.system]) grouped[f.system] = [];
    grouped[f.system].push(f);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-sm text-primary uppercase tracking-wide">
          Achados Clínicos ({findings.length})
        </h3>
      </div>
      <div className="space-y-2">
        {Object.entries(grouped).map(([system, items]) => (
          <CollapsibleFindingGroup key={system} system={system} items={items} />
        ))}
      </div>
    </div>
  );
}

function CollapsibleFindingGroup({ system, items }: { system: string; items: ClinicalFindingItem[] }) {
  const [open, setOpen] = useState(true);
  const highestPriority = items.reduce<ClinicalPriority>((acc, item) => {
    const order: ClinicalPriority[] = ["critical", "high", "medium", "low"];
    return order.indexOf(item.priority) < order.indexOf(acc) ? item.priority : acc;
  }, "low");

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full rounded-md border bg-background p-3 hover:bg-muted/50 transition-colors text-left">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm font-semibold">{system}</span>
            <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
          </div>
          <PriorityBadge priority={highestPriority} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-1 space-y-1.5">
          {items.map((item) => (
            <div key={item.id} className="rounded border p-2.5 bg-muted/20 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">{item.interpretation}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <PriorityBadge priority={item.priority} />
                  <SourceBadge source={item.source_type} />
                </div>
              </div>
              {item.markers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.markers.map((m) => (
                    <Badge key={m} variant="secondary" className="text-[9px] font-mono">{m}</Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function HypothesesSection({ hypotheses }: { hypotheses: DiagnosticHypothesisItem[] }) {
  if (hypotheses.length === 0) return null;

  const likelihoodLabels: Record<string, string> = {
    probable: "Provável",
    possible: "Possível",
    unlikely: "Improvável",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Stethoscope className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-sm text-primary uppercase tracking-wide">
          Hipóteses Diagnósticas ({hypotheses.length})
        </h3>
      </div>
      <div className="space-y-2">
        {hypotheses.map((h) => (
          <div key={h.id} className="rounded-md border bg-background p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{h.hypothesis}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="outline" className="text-[10px]">
                  {likelihoodLabels[h.likelihood] ?? h.likelihood}
                </Badge>
                <PriorityBadge priority={h.priority} />
                <SourceBadge source={h.source_type} />
              </div>
            </div>
            {h.supporting_findings.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Achados de suporte: </span>
                {h.supporting_findings.join("; ")}
              </div>
            )}
            {h.confirmatory_exams && h.confirmatory_exams.length > 0 && (
              <div className="text-xs text-muted-foreground">
                <span className="font-medium">Exames confirmatórios: </span>
                {h.confirmatory_exams.join("; ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestedActionsSection({ actions }: { actions: SuggestedActionItem[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-sm text-primary uppercase tracking-wide">
          Ações Sugeridas ({actions.length})
        </h3>
      </div>
      <div className="space-y-2">
        {actions.map((a) => (
          <div key={a.id} className="rounded-md border bg-background p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{ACTION_TYPE_ICONS[a.action_type] ?? "📋"}</span>
                <span className="text-sm font-medium">{a.description}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <PriorityBadge priority={a.priority} />
                <SourceBadge source={a.source_type} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{a.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FollowUpSection({ followUp }: { followUp?: FollowUp }) {
  if (!followUp) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-sm text-primary uppercase tracking-wide">Follow-up</h3>
      </div>
      <div className="rounded-md border bg-background p-3 space-y-2">
        {followUp.suggested_exams.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Exames sugeridos:</p>
            <ul className="space-y-0.5">
              {followUp.suggested_exams.map((e, i) => (
                <li key={i} className="text-sm flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {followUp.suggested_return_days && (
          <p className="text-xs text-muted-foreground">
            Retorno sugerido: <span className="font-medium">{followUp.suggested_return_days} dias</span>
          </p>
        )}
        {followUp.notes && (
          <p className="text-xs text-muted-foreground italic">{followUp.notes}</p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

interface ClinicalReportV2Props {
  data: AnalysisV2Data;
}

export default function ClinicalReportV2({ data }: ClinicalReportV2Props) {
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Relatório Clínico Estruturado
            <Badge variant="outline" className="text-[10px] font-mono">v2</Badge>
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {data.meta.specialty_name}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Executive Summary ── */}
        {data.executive_summary && (
          <div className="rounded-lg bg-muted/50 p-4 border-l-4 border-primary">
            <h3 className="font-bold text-sm text-primary mb-2 uppercase tracking-wide">
              Sumário Executivo
            </h3>
            <p className="text-sm leading-relaxed">{data.executive_summary}</p>
          </div>
        )}

        {/* ── Red Flags ── */}
        <RedFlagsSection flags={data.red_flags} />

        {/* ── Clinical Findings ── */}
        <ClinicalFindingsSection findings={data.clinical_findings} />

        {/* ── Diagnostic Hypotheses ── */}
        <HypothesesSection hypotheses={data.diagnostic_hypotheses} />

        {/* ── Suggested Actions ── */}
        <SuggestedActionsSection actions={data.suggested_actions} />

        {/* ── Follow-up ── */}
        <FollowUpSection followUp={data.follow_up} />

        {/* ── Provenance Legend ── */}
        <div className="border-t pt-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>Proveniência:</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Dados Lab = determinístico</span>
          </div>
          <div className="flex items-center gap-1">
            <Lightbulb className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">IA = modelo de linguagem</span>
          </div>
          {data.meta.model_used && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              Modelo: {data.meta.model_used}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
