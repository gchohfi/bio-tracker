import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarCheck,
  Brain,
  TrendingUp,
  Clock,
  FlaskConical,
} from "lucide-react";
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-3">
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
            ? `${redFlags.length} alerta${redFlags.length > 1 ? "s" : ""} crítico${redFlags.length > 1 ? "s" : ""}`
            : topFindings.length > 0
            ? `${topFindings.length} achado${topFindings.length > 1 ? "s" : ""} relevante${topFindings.length > 1 ? "s" : ""}`
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
      />

      {/* Next steps */}
      <BriefCard
        icon={<Brain className="h-3.5 w-3.5 text-primary" />}
        label="Próximos Passos"
        value={
          topActions.length > 0
            ? `${topActions.length} ação${topActions.length > 1 ? "ões" : ""} sugerida${topActions.length > 1 ? "s" : ""}`
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
      />
    </div>
  );
}

function BriefCard({
  icon,
  label,
  value,
  sub,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  variant?: "default" | "destructive";
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        variant === "destructive"
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
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
      {sub && (
        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{sub}</p>
      )}
    </div>
  );
}
