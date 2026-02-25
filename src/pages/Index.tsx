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
import { Plus, Search, Users, FlaskConical, AlertTriangle, CalendarIcon, ArrowRight, TrendingDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MARKERS, getMarkerStatus } from "@/lib/markers";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;
type LabSession = Tables<"lab_sessions">;

interface RecentSession extends LabSession {
  patient_name: string;
  patient_sex: string;
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
  const [chartData, setChartData] = useState<{ date: string; alertas: number; normais: number; total: number }[]>([]);

  const fetchPatients = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("practitioner_id", user.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setPatients(data || []);
    }
    setLoading(false);
  };

  const fetchDashboardData = async () => {
    // Fetch all sessions with patient info
    const { data: sessions } = await supabase
      .from("lab_sessions")
      .select("*, patients(name, sex)")
      .order("session_date", { ascending: false });

    if (!sessions || sessions.length === 0) {
      setTotalSessions(0);
      setTotalAlerts(0);
      setRecentSessions([]);
      setChartData([]);
      return;
    }

    setTotalSessions(sessions.length);

    // Get all session IDs
    const sessionIds = sessions.map((s) => s.id);

    // Fetch all results for alert counting
    const { data: results } = await supabase
      .from("lab_results")
      .select("*")
      .in("session_id", sessionIds);

    // Build a map of session_id -> patient info
    const sessionPatientMap = new Map<string, { name: string; sex: string }>();
    sessions.forEach((s: any) => {
      sessionPatientMap.set(s.id, {
        name: s.patients?.name || "—",
        sex: s.patients?.sex || "F",
      });
    });

    // Count alerts (latest session per patient only)
    const latestSessionPerPatient = new Map<string, string>();
    sessions.forEach((s) => {
      if (!latestSessionPerPatient.has(s.patient_id)) {
        latestSessionPerPatient.set(s.patient_id, s.id);
      }
    });
    const latestSessionIds = new Set(latestSessionPerPatient.values());

    let alertCount = 0;
    const sessionAlertMap = new Map<string, number>();

    (results || []).forEach((r) => {
      const marker = MARKERS.find((m) => m.id === r.marker_id);
      if (!marker) return;
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

    // Build recent sessions (last 5)
    const recent: RecentSession[] = sessions.slice(0, 5).map((s) => {
      const info = sessionPatientMap.get(s.id)!;
      return {
        ...s,
        patient_name: info.name,
        patient_sex: info.sex,
        alert_count: sessionAlertMap.get(s.id) || 0,
      };
    });
    setRecentSessions(recent);

    // Build chart data: alerts + normals per session date (sorted asc)
    const sortedSessions = [...sessions].sort((a, b) => a.session_date.localeCompare(b.session_date));
    const sessionResultCount = new Map<string, number>();
    (results || []).forEach((r) => {
      sessionResultCount.set(r.session_id, (sessionResultCount.get(r.session_id) || 0) + 1);
    });

    const chart = sortedSessions.map((s) => {
      const alerts = sessionAlertMap.get(s.id) || 0;
      const total = sessionResultCount.get(s.id) || 0;
      const info = sessionPatientMap.get(s.id);
      return {
        date: format(parseISO(s.session_date), "dd/MM/yy"),
        label: `${info?.name || "—"} — ${format(parseISO(s.session_date), "dd/MM/yy")}`,
        alertas: alerts,
        normais: total - alerts,
        total,
      };
    });
    setChartData(chart);
  };

  useEffect(() => {
    if (user) {
      fetchPatients();
      fetchDashboardData();
    }
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
      fetchPatients();
      fetchDashboardData();
      toast({ title: "Paciente criado!" });
    }
  };

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Visão geral dos seus pacientes e exames
            </p>
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
                  <Label>Data de Nascimento <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Input
                    type="date"
                    value={newBirthDate}
                    onChange={(e) => setNewBirthDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                <Button type="submit" className="w-full">Criar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
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

        {/* Trend Chart */}
        {chartData.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  Alertas por Sessão
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
                      />
                      <Bar dataKey="normais" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} name="Normais" />
                      <Bar dataKey="alertas" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Alertas" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  Evolução de Alertas
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="alertGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="text-muted-foreground" />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
                      />
                      <Area
                        type="monotone"
                        dataKey="alertas"
                        stroke="hsl(var(--destructive))"
                        fill="url(#alertGradient)"
                        strokeWidth={2}
                        name="Alertas"
                        dot={{ r: 3, fill: "hsl(var(--destructive))" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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
              {recentSessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50 cursor-pointer"
                  onClick={() => navigate(`/patient/${s.patient_id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {s.patient_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.patient_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(s.session_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {s.alert_count > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {s.alert_count} {s.alert_count === 1 ? "alerta" : "alertas"}
                      </Badge>
                    )}
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Search & Patient List */}
        <div>
          <h2 className="mb-3 text-lg font-semibold">Pacientes</h2>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar paciente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

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
              {filtered.map((p) => (
                <Card key={p.id} className="cursor-pointer transition-colors hover:bg-muted/50" onClick={() => navigate(`/patient/${p.id}`)}>
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Badge variant="secondary">{p.sex === "M" ? "Masc" : "Fem"}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
