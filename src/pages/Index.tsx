import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  Users,
  FlaskConical,
  AlertTriangle,
  CalendarIcon,
  ArrowRight,
  XCircle,
  Brain,
  Stethoscope,
  Clock,
  ChevronRight,
} from "lucide-react";
import { format, parseISO, isToday, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MARKERS, getMarkerStatus } from "@/lib/markers";
import QuickActions from "@/components/QuickActions";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;
type LabSession = Tables<"lab_sessions">;

const STANDARD_MARKERS = MARKERS.filter((m) => m.panel === "Padrão");
const MARKER_MAP = new Map(MARKERS.map(m => [m.id, m]));

interface RecentSession extends LabSession {
  patient_name: string;
  patient_sex: string;
  alert_count: number;
  missing_standard_ids: string[];
}

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

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newSex, setNewSex] = useState<"M" | "F">("F");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [totalSessions, setTotalSessions] = useState(0);
  const [totalAlerts, setTotalAlerts] = useState(0);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [criticalPatients, setCriticalPatients] = useState<CriticalPatient[]>([]);
  const [todayEncounters, setTodayEncounters] = useState<TodayEncounter[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReviewSession[]>([]);

  const fetchAllData = async () => {
    if (!user) return;
    setLoading(true);

    const todayStr = new Date().toISOString().split("T")[0];

    // Batch all queries
    const [patientsRes, sessionsRes, analysesRes, encountersRes] = await Promise.all([
      supabase.from("patients").select("*").eq("practitioner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("lab_sessions").select("*, patients(name, sex)").order("session_date", { ascending: false }),
      (supabase as any).from("patient_analyses").select("patient_id, analysis_v2_data, specialty_name, created_at, patients(name)").order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("clinical_encounters").select("id, patient_id, chief_complaint, status, encounter_date, patients(name)").eq("practitioner_id", user.id).eq("encounter_date", todayStr).order("created_at", { ascending: false }),
    ]);

    if (patientsRes.error) {
      toast({ title: "Erro", description: patientsRes.error.message, variant: "destructive" });
    } else {
      setPatients(patientsRes.data || []);
    }

    // Process today's encounters
    const encounters: TodayEncounter[] = (encountersRes.data ?? []).map((e: any) => ({
      id: e.id,
      patient_id: e.patient_id,
      patient_name: e.patients?.name ?? "—",
      chief_complaint: e.chief_complaint,
      status: e.status,
      encounter_date: e.encounter_date,
    }));
    setTodayEncounters(encounters);

    // Process critical patients from recent analyses with red flags
    const criticals: CriticalPatient[] = [];
    const seenPatients = new Set<string>();
    for (const a of (analysesRes.data ?? [])) {
      if (seenPatients.has(a.patient_id)) continue;
      const v2 = a.analysis_v2_data as any;
      if (!v2?.red_flags?.length) continue;
      seenPatients.add(a.patient_id);
      criticals.push({
        patient_id: a.patient_id,
        patient_name: a.patients?.name ?? "—",
        red_flags: v2.red_flags.slice(0, 3).map((rf: any) => ({
          finding: rf.finding,
          severity: rf.severity,
        })),
        analysis_date: a.created_at,
        specialty_name: a.specialty_name,
      });
    }
    setCriticalPatients(criticals.slice(0, 5));

    // Process sessions
    const sessions = sessionsRes.data;
    if (!sessions || sessions.length === 0) {
      setTotalSessions(0);
      setTotalAlerts(0);
      setRecentSessions([]);
      setPendingReviews([]);
      setLoading(false);
      return;
    }

    setTotalSessions(sessions.length);
    const sessionIds = sessions.map((s) => s.id);

    const { data: results } = await supabase
      .from("lab_results")
      .select("marker_id, session_id, value")
      .in("session_id", sessionIds);

    const sessionPatientMap = new Map<string, { name: string; sex: string; patient_id: string }>();
    sessions.forEach((s: any) => {
      sessionPatientMap.set(s.id, {
        name: s.patients?.name || "—",
        sex: s.patients?.sex || "F",
        patient_id: s.patient_id,
      });
    });

    const latestSessionPerPatient = new Map<string, string>();
    sessions.forEach((s) => {
      if (!latestSessionPerPatient.has(s.patient_id)) {
        latestSessionPerPatient.set(s.patient_id, s.id);
      }
    });
    const latestSessionIds = new Set(latestSessionPerPatient.values());

    const sessionFoundMarkers = new Map<string, Set<string>>();
    sessions.forEach((s) => sessionFoundMarkers.set(s.id, new Set()));

    let alertCount = 0;
    const sessionAlertMap = new Map<string, number>();

    (results || []).forEach((r) => {
      const marker = MARKER_MAP.get(r.marker_id);
      if (!marker) return;
      sessionFoundMarkers.get(r.session_id)?.add(r.marker_id);
      const patientInfo = sessionPatientMap.get(r.session_id);
      const sex = (patientInfo?.sex || "F") as "M" | "F";
      const status = getMarkerStatus(r.value, marker, sex);
      if (status !== "normal") {
        sessionAlertMap.set(r.session_id, (sessionAlertMap.get(r.session_id) || 0) + 1);
        if (latestSessionIds.has(r.session_id)) {
          alertCount++;
        }
      }
    });

    setTotalAlerts(alertCount);

    // Find sessions without analyses (pending review)
    const analysedPatientIds = new Set((analysesRes.data ?? []).map((a: any) => a.patient_id));
    const pending: PendingReviewSession[] = [];
    const seenPending = new Set<string>();
    for (const s of sessions.slice(0, 20)) {
      const info = sessionPatientMap.get(s.id);
      if (!info || seenPending.has(info.patient_id)) continue;
      // Consider "pending" if the latest session for this patient has no analysis
      if (latestSessionIds.has(s.id) && !analysedPatientIds.has(s.patient_id)) {
        seenPending.add(info.patient_id);
        pending.push({
          session_id: s.id,
          patient_id: s.patient_id,
          patient_name: info.name,
          session_date: s.session_date,
          alert_count: sessionAlertMap.get(s.id) || 0,
        });
      }
    }
    setPendingReviews(pending.slice(0, 5));

    const recent: RecentSession[] = sessions.slice(0, 8).map((s) => {
      const info = sessionPatientMap.get(s.id)!;
      const found = sessionFoundMarkers.get(s.id) || new Set();
      const missing = STANDARD_MARKERS
        .filter((m) => !found.has(m.id))
        .map((m) => m.id);
      return {
        ...s,
        patient_name: info.name,
        patient_sex: info.sex,
        alert_count: sessionAlertMap.get(s.id) || 0,
        missing_standard_ids: missing,
      };
    });
    setRecentSessions(recent);
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchAllData();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("patients").insert({
      name: newName.trim(),
      sex: newSex,
      birth_date: newBirthDate || null,
      practitioner_id: user.id,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewName("");
      setNewBirthDate("");
      setDialogOpen(false);
      fetchAllData();
      toast({ title: "Paciente criado!" });
    }
  };

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const hasPriorityContent = criticalPatients.length > 0 || todayEncounters.length > 0 || pendingReviews.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Painel Geral</h1>
            <p className="text-sm text-muted-foreground">
              Triagem diária — quem precisa de atenção primeiro
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64 sm:flex-none">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar paciente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Paciente
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Novo Paciente</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Nome do paciente"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Sexo biológico</Label>
                    <Select value={newSex} onValueChange={(v) => setNewSex(v as "M" | "F")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="F">Feminino</SelectItem>
                        <SelectItem value="M">Masculino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Data de Nascimento{" "}
                      <span className="text-muted-foreground text-xs">(opcional)</span>
                    </Label>
                    <Input
                      type="date"
                      value={newBirthDate}
                      onChange={(e) => setNewBirthDate(e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Criar
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{patients.length}</p>
                <p className="text-xs text-muted-foreground">Pacientes</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FlaskConical className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalSessions}</p>
                <p className="text-xs text-muted-foreground">Sessões</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalAlerts}</p>
                <p className="text-xs text-muted-foreground">Alertas pendentes</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ═══ PRIORITY TRIAGE SECTION ═══ */}
        {hasPriorityContent && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Atenção Prioritária
            </h2>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Critical Patients — Red Flags */}
              {criticalPatients.length > 0 && (
                <Card className="border-destructive/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      Alertas Críticos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-4 pt-0">
                    {criticalPatients.map((cp) => (
                      <div
                        key={cp.patient_id}
                        className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 cursor-pointer hover:bg-destructive/10 transition-colors"
                        onClick={() => navigate(`/patient/${cp.patient_id}?tab=analysis`)}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-[10px] font-bold text-destructive">
                              {cp.patient_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium truncate">{cp.patient_name}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {formatDistanceToNow(parseISO(cp.analysis_date), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        {cp.red_flags.map((rf, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px] text-destructive/80">
                            <span className="mt-0.5 shrink-0">⚠</span>
                            <span>{rf.finding}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Today's Encounters */}
              {todayEncounters.length > 0 && (
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-primary">
                      <Stethoscope className="h-4 w-4" />
                      Consultas de Hoje
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{todayEncounters.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-4 pt-0">
                    {todayEncounters.map((enc) => (
                      <div
                        key={enc.id}
                        className="rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between gap-2"
                        onClick={() => navigate(`/patient/${enc.patient_id}?tab=clinical_evolution`)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {enc.patient_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{enc.patient_name}</p>
                            {enc.chief_complaint && (
                              <p className="text-[10px] text-muted-foreground truncate">{enc.chief_complaint}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge
                            variant={enc.status === "finalized" ? "secondary" : "outline"}
                            className="text-[9px] h-4 px-1"
                          >
                            {enc.status === "finalized" ? "Finalizada" : "Rascunho"}
                          </Badge>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Pending Reviews — sessions without AI analysis */}
              {pendingReviews.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Brain className="h-4 w-4 text-primary" />
                      Exames Sem Análise IA
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">{pendingReviews.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-4 pt-0">
                    {pendingReviews.map((pr) => (
                      <div
                        key={pr.session_id}
                        className="rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between gap-2"
                        onClick={() => navigate(`/patient/${pr.patient_id}?tab=sessions`)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {pr.patient_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{pr.patient_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(parseISO(pr.session_date), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {pr.alert_count > 0 && (
                            <Badge variant="destructive" className="text-[9px] h-4 px-1">
                              {pr.alert_count} alerta{pr.alert_count > 1 ? "s" : ""}
                            </Badge>
                          )}
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="mb-3 text-base font-semibold flex items-center gap-2">
            Ações Rápidas
          </h2>
          <QuickActions />
        </div>

        {/* Recent Sessions */}
        {recentSessions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                Últimas Sessões
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 p-4 pt-0">
              {recentSessions.map((s) => {
                const missingNames = STANDARD_MARKERS
                  .filter((m) => s.missing_standard_ids.includes(m.id))
                  .map((m) => m.name)
                  .slice(0, 5);
                const extraMissing = s.missing_standard_ids.length - 5;

                return (
                  <div
                    key={s.id}
                    className="rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                    onClick={() => navigate(`/patient/${s.patient_id}`)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {s.patient_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.patient_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(s.session_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {s.alert_count > 0 && (
                          <Badge variant="destructive" className="text-[10px]">
                            {s.alert_count} {s.alert_count === 1 ? "alerta" : "alertas"}
                          </Badge>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    {missingNames.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <XCircle className="h-3 w-3 text-amber-500 shrink-0" />
                        <span className="text-[10px] text-amber-600 font-medium mr-0.5">Ausentes:</span>
                        {missingNames.map((name) => (
                          <Badge
                            key={name}
                            variant="outline"
                            className="text-[10px] h-4 px-1 border-amber-300 text-amber-700"
                          >
                            {name}
                          </Badge>
                        ))}
                        {extraMissing > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{extraMissing} mais
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Patient list */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Pacientes</h2>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-lg font-medium">Nenhum paciente encontrado</p>
                <p className="text-sm text-muted-foreground">
                  {patients.length === 0
                    ? "Clique em 'Novo Paciente' para começar"
                    : "Tente outro termo de busca"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((p) => {
                const age = p.birth_date ? (() => {
                  const today = new Date();
                  const birth = new Date(p.birth_date);
                  return today.getFullYear() - birth.getFullYear() -
                    (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
                })() : null;

                return (
                  <Card
                    key={p.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => navigate(`/patient/${p.id}`)}
                  >
                    <CardContent className="flex items-center gap-3 p-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.name}</p>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{p.sex === "M" ? "Masc" : "Fem"}</span>
                          {age !== null && (
                            <>
                              <span>•</span>
                              <span>{age} anos</span>
                            </>
                          )}
                        </div>
                      </div>
                      {p.objectives && p.objectives.length > 0 && (
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {p.objectives.length} obj.
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
