import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  ChevronRight,
  FileEdit,
  FlaskConical,
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

interface DraftEncounter {
  id: string;
  patient_id: string;
  patient_name: string;
  chief_complaint: string | null;
  encounter_date: string;
  specialty_id: string;
}

interface RecentImport {
  session_id: string;
  patient_id: string;
  patient_name: string;
  session_date: string;
  created_at: string;
}

interface DaySummaryMobileProps {
  criticalPatients: CriticalPatient[];
  draftEncounters: DraftEncounter[];
  recentImports: RecentImport[];
}

export default function DaySummaryMobile({
  criticalPatients,
  draftEncounters,
  recentImports,
}: DaySummaryMobileProps) {
  const navigate = useNavigate();

  const today = new Date();
  const greeting =
    today.getHours() < 12 ? "Bom dia" : today.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const urgentCount = criticalPatients.length;
  const hasPriority = urgentCount > 0 || draftEncounters.length > 0;

  return (
    <div className="space-y-5 pb-8">
      {/* Greeting */}
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
        {draftEncounters.length > 0 && (
          <Badge variant="outline" className="shrink-0 gap-1 py-1 px-2.5 text-xs">
            <FileEdit className="h-3 w-3" />
            {draftEncounters.length} rascunho{draftEncounters.length > 1 ? "s" : ""}
          </Badge>
        )}
        {urgentCount > 0 && (
          <Badge variant="destructive" className="shrink-0 gap-1 py-1 px-2.5 text-xs">
            <AlertTriangle className="h-3 w-3" />
            {urgentCount} alerta{urgentCount > 1 ? "s" : ""}
          </Badge>
        )}
        {recentImports.length > 0 && (
          <Badge variant="secondary" className="shrink-0 gap-1 py-1 px-2.5 text-xs">
            <FlaskConical className="h-3 w-3" />
            {recentImports.length} exame{recentImports.length > 1 ? "s" : ""} novo{recentImports.length > 1 ? "s" : ""}
          </Badge>
        )}
        {!hasPriority && recentImports.length === 0 && (
          <Badge variant="secondary" className="shrink-0 py-1 px-2.5 text-xs">
            ✓ Nenhuma pendência
          </Badge>
        )}
      </div>

      {/* Critical alerts */}
      {criticalPatients.length > 0 && (
        <section className="rounded-xl border border-destructive/15 bg-destructive/[0.02] p-3 space-y-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Alertas Críticos
            <Badge variant="destructive" className="text-[9px] h-4 px-1.5 ml-auto">
              {criticalPatients.length}
            </Badge>
          </h2>
          <div className="space-y-2">
            {criticalPatients.map((cp) => (
              <Card
                key={cp.patient_id}
                className="cursor-pointer border-destructive/20 bg-destructive/5 active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/patient/${cp.patient_id}?tab=resumo`)}
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

      {/* Draft encounters */}
      {draftEncounters.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
            <FileEdit className="h-3.5 w-3.5" />
            Rascunhos em Aberto
          </h2>
          <div className="space-y-2">
            {draftEncounters.map((enc) => (
              <Card
                key={enc.id}
                className="cursor-pointer border-l-4 border-l-amber-400 active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/patient/${enc.patient_id}/encounter/${enc.id}`)}
              >
                <CardContent className="flex items-center justify-between gap-2 p-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-xs font-bold text-amber-700 dark:text-amber-300">
                      {enc.patient_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{enc.patient_name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(parseISO(enc.encounter_date), "dd/MM/yyyy", { locale: ptBR })}
                        {enc.chief_complaint && (
                          <span className="ml-1">• {enc.chief_complaint}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Recent imports */}
      {recentImports.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <FlaskConical className="h-3.5 w-3.5 text-primary" />
            Exames Recém-Importados
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 ml-auto border-primary/30 text-primary">
              {recentImports.length} pendente{recentImports.length > 1 ? "s" : ""}
            </Badge>
          </h2>
          <div className="space-y-2">
            {recentImports.slice(0, 4).map((imp) => (
              <Card
                key={imp.session_id}
                className="cursor-pointer border-l-4 border-l-primary/40 active:scale-[0.98] transition-transform"
                onClick={() => navigate(`/patient/${imp.patient_id}?tab=exames`)}
              >
                <CardContent className="flex items-center gap-2.5 p-3">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                    {imp.patient_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{imp.patient_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {format(parseISO(imp.session_date), "dd/MM/yyyy", { locale: ptBR })}
                      <span className="ml-1">• {formatDistanceToNow(parseISO(imp.created_at), { addSuffix: true, locale: ptBR })}</span>
                    </p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Quick actions */}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Ações Rápidas</h2>
        <QuickActions />
      </section>
    </div>
  );
}
