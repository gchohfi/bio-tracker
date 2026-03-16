import { useMemo, useState } from "react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarCheck,
  Brain,
  TrendingUp,
  FlaskConical,
  ChevronDown,
} from "lucide-react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import type { AnalysisV2Data } from "@/components/ClinicalReportV2";

interface PatientClinicalBriefProps {
  lastEncounter?: { encounter_date: string; chief_complaint?: string | null } | null;
  lastAnalysis?: {
    created_at: string;
    specialty_name?: string | null;
  } | null;
  v2Data?: AnalysisV2Data | null;
  sessionsCount: number;
  lastSessionDate?: string | null;
}

/** Truncate to ~maxLen chars at word boundary, add "…" */
function smartTruncate(text: string, maxLen = 80): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const last = cut.lastIndexOf(" ");
  return (last > maxLen * 0.4 ? cut.slice(0, last) : cut) + "…";
}

export default function PatientClinicalBrief({
  lastEncounter,
  lastAnalysis,
  v2Data,
  sessionsCount,
  lastSessionDate,
}: PatientClinicalBriefProps) {
  const redFlags = v2Data?.red_flags ?? [];
  const topFindings = useMemo(
    () =>
      (v2Data?.clinical_findings ?? [])
        .filter((f: any) => f.priority === "critical" || f.priority === "high")
        .slice(0, 2),
    [v2Data]
  );
  const topActions = useMemo(
    () =>
      (v2Data?.suggested_actions ?? [])
        .filter((a: any) => a.priority === "critical" || a.priority === "high")
        .slice(0, 2),
    [v2Data]
  );

  const hasAnyContent = lastEncounter || lastAnalysis || sessionsCount > 0;
  if (!hasAnyContent) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3">
        {/* Last encounter */}
        <BriefCard
          icon={<CalendarCheck className="h-3.5 w-3.5 text-primary" />}
          label="Última Consulta"
          value={
            lastEncounter
              ? formatDistanceToNow(parseISO(lastEncounter.encounter_date), {
                  addSuffix: true,
                  locale: ptBR,
                })
              : "Nenhuma"
          }
          sub={lastEncounter?.chief_complaint ?? undefined}
        />

        {/* Last exams */}
        <BriefCard
          icon={<FlaskConical className="h-3.5 w-3.5 text-primary" />}
          label="Exames"
          value={
            sessionsCount > 0
              ? `${sessionsCount} sessão${sessionsCount > 1 ? "ões" : ""}`
              : "Nenhum"
          }
          sub={
            lastSessionDate
              ? `Último: ${format(parseISO(lastSessionDate), "dd/MM/yyyy", { locale: ptBR })}`
              : undefined
          }
        />

        {/* Red flags / findings */}
        <BriefCard
          icon={
            redFlags.length > 0 ? (
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
            ) : (
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            )
          }
          label={redFlags.length > 0 ? "Alertas" : "Achados"}
          value={
            redFlags.length > 0
              ? `${redFlags.length} alerta${redFlags.length > 1 ? "s" : ""}`
              : topFindings.length > 0
              ? `${topFindings.length} achado${topFindings.length > 1 ? "s" : ""}`
              : "Sem alertas"
          }
          sub={
            redFlags.length > 0
              ? redFlags[0]?.finding
              : topFindings.length > 0
              ? topFindings[0]?.interpretation
              : undefined
          }
          variant={redFlags.length > 0 ? "destructive" : "default"}
          expandable
        />

        {/* Next steps */}
        <BriefCard
          icon={<Brain className="h-3.5 w-3.5 text-primary" />}
          label="Próximos Passos"
          value={
            topActions.length > 0
              ? `${topActions.length} ação${topActions.length > 1 ? "ões" : ""}`
              : lastAnalysis
              ? "Análise disponível"
              : "Sem análise"
          }
          sub={
            topActions.length > 0
              ? topActions[0]?.description
              : lastAnalysis
              ? `${lastAnalysis.specialty_name ?? "IA"} — ${formatDistanceToNow(parseISO(lastAnalysis.created_at), { addSuffix: true, locale: ptBR })}`
              : undefined
          }
          expandable
        />
      </div>
    </TooltipProvider>
  );
}

function BriefCard({
  icon,
  label,
  value,
  sub,
  variant = "default",
  expandable = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  variant?: "default" | "destructive";
  expandable?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = (sub?.length ?? 0) > 60;
  const needsExpand = expandable && isLong;
  const displaySub = sub
    ? needsExpand && !expanded
      ? smartTruncate(sub, 55)
      : sub
    : undefined;

  return (
    <div
      className={`rounded-lg border px-3 py-2.5 min-h-[4.5rem] flex flex-col ${
        variant === "destructive"
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p
        className={`text-xs font-semibold leading-tight ${
          variant === "destructive" ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
      {displaySub && (
        <Tooltip>
          <TooltipTrigger asChild>
            <p
              className="text-[11px] text-muted-foreground mt-1 leading-snug cursor-default"
              onClick={needsExpand ? () => setExpanded(!expanded) : undefined}
            >
              {displaySub}
              {needsExpand && (
                <ChevronDown
                  className={`inline-block h-3 w-3 ml-0.5 align-text-bottom transition-transform ${
                    expanded ? "rotate-180" : ""
                  }`}
                />
              )}
            </p>
          </TooltipTrigger>
          {isLong && !expanded && (
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              {sub}
            </TooltipContent>
          )}
        </Tooltip>
      )}
    </div>
  );
}
