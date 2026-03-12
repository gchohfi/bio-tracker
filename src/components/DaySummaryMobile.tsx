import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertTriangle,
  Brain,
  ChevronRight,
  Stethoscope,
  Sun,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import QuickActions from "@/components/QuickActions";

interface CriticalPatient {
  patient_id: string;
  patient_name: string;
  red_flags: Array<{ finding: string; severity: string }>;
  analysis_date: string;
  specialty_name: string | null;
}

interface TodayEncounter {
  id: string;
  patient_id: string;
  patient_name: string;
  chief_complaint: string | null;
  status: string;
  encounter_date: string;
}

interface PendingReviewSession {
  session_id: string;
  patient_id: string;
  patient_name: string;
  session_date: string;
  alert_count: number;
}

interface DaySummaryMobileProps {
  criticalPatients: CriticalPatient[];
  todayEncounters: TodayEncounter[];
  pendingReviews: PendingReviewSession[];
  totalAlerts: number;
  loading: boolean;
}

export default function DaySummaryMobile({
  criticalPatients,
  todayEncounters,
  pendingReviews,
  totalAlerts,
  loading,
}: DaySummaryMobileProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const today = new Date();
  const greeting = today.getHours() < 12 ? "Bom dia" : today.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const urgentCount = criticalPatients.length + pendingReviews.filter(p => p.alert_count > 0).length;

  return (
    <div className="space-y-5 pb-8">
      {/* Greeting header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Sun className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">{greeting}</h1>
          <p className="text-xs text-muted-foreground">
            {format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {todayEncounters.length > 0 && (
          <Badge variant="secondary" className="shrink-0 gap-1 py-1 px-2.5 text-xs">
            <Stethoscope className="h-3 w-3" />
            {todayEncounters.length} consulta{todayEncounters.length > 1 ? "s" : ""}
          </Badge>
        )}
        {urgentCount > 0 && (
          <Badge variant="destructive" className="shrink-0 gap-1 py-1 px-2.5 text-xs">
            <AlertTriangle className="h-3 w-3" />
            {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
          </Badge>
        )}
        {pendingReviews.length > 0 && (
          <Badge variant="outline" className="shrink-0 gap-1 py-1 px-2.5 text-xs">
            <Brain className="h-3 w-3" />
            {pendingReviews.length} sem análise
          </Badge>
        )}
        {urgentCount === 0 && todayEncounters.length === 0 && pendingReviews.length === 0 && (
          <Badge variant="secondary" className="shrink-0 py-1 px-2.5 text-xs">
            ✓ Nenhuma pendência
          </Badge>
        )}
      </div>

      {/* Today's encounters */}
      {todayEncounters.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Stethoscope className="h-3.5 w-3.5" />
            Consultas de Hoje
          </h2>
          <div className="space-y-2">
            {todayEncounters.map((enc) => (
              <Card
                key={enc.id}
                className="cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/patient/${enc.patient_id}?tab=consultas`)}
              >
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {enc.patient_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{enc.patient_name}</p>
                      {enc.chief_complaint && (
                        <p className="text-[11px] text-muted-foreground truncate">{enc.chief_complaint}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge
                      variant={enc.status === "finalized" ? "secondary" : "outline"}
                      className="text-[9px] h-5 px-1.5"
                    >
                      {enc.status === "finalized" ? "Finalizada" : "Rascunho"}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Critical alerts */}
      {criticalPatients.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Alertas Críticos
          </h2>
          <div className="space-y-2">
            {criticalPatients.map((cp) => (
              <Card
                key={cp.patient_id}
                className="border-destructive/25 cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/patient/${cp.patient_id}?tab=analysis`)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-[10px] font-bold text-destructive">
                        {cp.patient_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium truncate">{cp.patient_name}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  <div className="space-y-0.5 pl-9">
                    {cp.red_flags.slice(0, 2).map((rf, i) => (
                      <p key={i} className="text-[11px] text-destructive/80 leading-snug">
                        ⚠ {rf.finding}
                      </p>
                    ))}
                    {cp.red_flags.length > 2 && (
                      <p className="text-[10px] text-muted-foreground">
                        +{cp.red_flags.length - 2} alerta{cp.red_flags.length - 2 > 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Pending reviews */}
      {pendingReviews.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Brain className="h-3.5 w-3.5 text-primary" />
            Exames Pendentes
          </h2>
          <div className="space-y-2">
            {pendingReviews.map((pr) => (
              <Card
                key={pr.session_id}
                className="cursor-pointer active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/patient/${pr.patient_id}?tab=exames`)}
              >
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {pr.patient_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{pr.patient_name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(parseISO(pr.session_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {pr.alert_count > 0 && (
                      <Badge variant="destructive" className="text-[9px] h-5 px-1.5">
                        {pr.alert_count} alerta{pr.alert_count > 1 ? "s" : ""}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Quick actions — compact on mobile */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Ações Rápidas</h2>
        <QuickActions />
      </section>
    </div>
  );
}
