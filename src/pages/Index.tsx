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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Search,
  AlertTriangle,
  ChevronRight,
  Clock,
  FlaskConical,
  FileEdit,
  Sun,
  Users,
  Stethoscope,
} from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import QuickActions from "@/components/QuickActions";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

// ── Interfaces ──

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

interface RecentPatient {
  id: string;
  name: string;
  sex: string;
  birth_date: string | null;
  last_activity: string;
  activity_type: "encounter" | "session" | "analysis";
}

// ══════════════════════════════════════════════════════════════════════
// COMPONENT
// ══════════════════════════════════════════════════════════════════════

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [newName, setNewName] = useState("");
  const [newSex, setNewSex] = useState<"M" | "F">("F");
  const [newBirthDate, setNewBirthDate] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAllPatients, setShowAllPatients] = useState(false);

  const [criticalPatients, setCriticalPatients] = useState<CriticalPatient[]>([]);
  const [draftEncounters, setDraftEncounters] = useState<DraftEncounter[]>([]);
  const [recentImports, setRecentImports] = useState<RecentImport[]>([]);
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);

  const fetchAllData = async () => {
    if (!user) return;
    setLoading(true);

    const [patientsRes, analysesRes, draftsRes, sessionsRes] = await Promise.all([
      supabase.from("patients").select("*").eq("practitioner_id", user.id).order("created_at", { ascending: false }),
      (supabase as any).from("patient_analyses").select("patient_id, analysis_v2_data, specialty_name, created_at, patients(name)").order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("clinical_encounters").select("id, patient_id, chief_complaint, encounter_date, specialty_id, status, updated_at, patients(name)").eq("practitioner_id", user.id).eq("status", "draft").order("updated_at", { ascending: false }).limit(10),
      (supabase as any).from("lab_sessions").select("id, patient_id, session_date, created_at, patients(name)").order("created_at", { ascending: false }).limit(8),
    ]);

    if (patientsRes.error) {
      toast({ title: "Erro", description: patientsRes.error.message, variant: "destructive" });
    } else {
      setPatients(patientsRes.data || []);
    }

    // Critical patients (red flags)
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

    // Draft encounters
    const drafts: DraftEncounter[] = (draftsRes.data ?? []).map((e: any) => ({
      id: e.id,
      patient_id: e.patient_id,
      patient_name: e.patients?.name ?? "—",
      chief_complaint: e.chief_complaint,
      encounter_date: e.encounter_date,
      specialty_id: e.specialty_id,
    }));
    setDraftEncounters(drafts);

    // Recent imports
    const imports: RecentImport[] = (sessionsRes.data ?? []).map((s: any) => ({
      session_id: s.id,
      patient_id: s.patient_id,
      patient_name: s.patients?.name ?? "—",
      session_date: s.session_date,
      created_at: s.created_at,
    }));
    setRecentImports(imports);

    // Recent patients — derive from encounters + sessions + analyses activity
    // Track activity type for context
    const patientActivity = new Map<string, { ts: string; type: "encounter" | "session" | "analysis" }>();
    const updateActivity = (pid: string, ts: string, type: "encounter" | "session" | "analysis") => {
      const existing = patientActivity.get(pid);
      if (!existing || ts > existing.ts) {
        patientActivity.set(pid, { ts, type });
      }
    };
    for (const e of (draftsRes.data ?? [])) {
      updateActivity(e.patient_id, e.updated_at, "encounter");
    }
    for (const s of (sessionsRes.data ?? [])) {
      updateActivity(s.patient_id, s.created_at, "session");
    }
    for (const a of (analysesRes.data ?? [])) {
      updateActivity(a.patient_id, a.created_at, "analysis");
    }

    const allPatients = patientsRes.data ?? [];
    const recents: RecentPatient[] = Array.from(patientActivity.entries())
      .sort((a, b) => b[1].ts.localeCompare(a[1].ts))
      .slice(0, 8)
      .map(([pid, activity]) => {
        const p = allPatients.find(pp => pp.id === pid);
        return {
          id: pid,
          name: p?.name ?? "—",
          sex: p?.sex ?? "F",
          birth_date: p?.birth_date ?? null,
          last_activity: activity.ts,
          activity_type: activity.type,
        };
      })
      .filter(r => r.name !== "—");
    setRecentPatients(recents);

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

  // ── Deduplicate patients across blocks ──
  // Patients shown in priority blocks shouldn't repeat in "Últimos Acessados"
  const priorityPatientIds = useMemo(() => {
    const ids = new Set<string>();
    draftEncounters.forEach(e => ids.add(e.patient_id));
    criticalPatients.forEach(c => ids.add(c.patient_id));
    return ids;
  }, [draftEncounters, criticalPatients]);

  // Also deduplicate recent imports from priority
  const filteredImports = useMemo(
    () => recentImports.filter(imp => !priorityPatientIds.has(imp.patient_id)),
    [recentImports, priorityPatientIds]
  );

  const filteredRecents = useMemo(
    () => recentPatients.filter(rp => !priorityPatientIds.has(rp.id)),
    [recentPatients, priorityPatientIds]
  );

  // Greeting
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Bom dia" : now.getHours() < 18 ? "Boa tarde" : "Boa noite";

  const hasPriority = criticalPatients.length > 0 || draftEncounters.length > 0;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  const activityLabel = (type: "encounter" | "session" | "analysis") => {
    switch (type) {
      case "encounter": return "Consulta";
      case "session": return "Exame";
      case "analysis": return "Análise";
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* ── HEADER — no inline search (use global header search) ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Sun className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight">{greeting}</h1>
              <p className="text-xs text-muted-foreground">
                {format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                {patients.length > 0 && (
                  <span className="ml-1">• {patients.length} paciente{patients.length > 1 ? "s" : ""}</span>
                )}
              </p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size={isMobile ? "sm" : "default"}>
                <Plus className="mr-1.5 h-4 w-4" />
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
                <Button type="submit" className="w-full">Criar</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* ── SUMMARY PILLS (mobile) ── */}
        {isMobile && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {draftEncounters.length > 0 && (
              <Badge variant="outline" className="shrink-0 gap-1 py-1 px-2.5 text-xs">
                <FileEdit className="h-3 w-3" />
                {draftEncounters.length} rascunho{draftEncounters.length > 1 ? "s" : ""}
              </Badge>
            )}
            {criticalPatients.length > 0 && (
              <Badge variant="destructive" className="shrink-0 gap-1 py-1 px-2.5 text-xs">
                <AlertTriangle className="h-3 w-3" />
                {criticalPatients.length} alerta{criticalPatients.length > 1 ? "s" : ""}
              </Badge>
            )}
            {filteredImports.length > 0 && (
              <Badge variant="secondary" className="shrink-0 gap-1 py-1 px-2.5 text-xs">
                <FlaskConical className="h-3 w-3" />
                {filteredImports.length} exame{filteredImports.length > 1 ? "s" : ""} novo{filteredImports.length > 1 ? "s" : ""}
              </Badge>
            )}
            {!hasPriority && filteredImports.length === 0 && (
              <Badge variant="secondary" className="shrink-0 py-1 px-2.5 text-xs">
                ✓ Nenhuma pendência
              </Badge>
            )}
          </div>
        )}

        {/* ── DRAFTS (standalone, more prominent) ── */}
        {draftEncounters.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm sm:text-base font-semibold flex items-center gap-2">
              <FileEdit className="h-4 w-4 text-primary" />
              Rascunhos Abertos
              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{draftEncounters.length}</Badge>
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {draftEncounters.map((enc) => (
                <Card
                  key={enc.id}
                  className="cursor-pointer border-l-4 border-l-amber-400 hover:bg-muted/50 active:scale-[0.98] transition-all"
                  onClick={() => navigate(`/patient/${enc.patient_id}/encounter/${enc.id}`)}
                >
                  <CardContent className="flex items-center justify-between gap-2 p-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                        {enc.patient_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{enc.patient_name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(parseISO(enc.encounter_date), "dd/MM/yyyy", { locale: ptBR })}
                          {enc.chief_complaint && (
                            <span className="ml-1 text-foreground/70">• {enc.chief_complaint}</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* ── CRITICAL ALERTS ── */}
        {criticalPatients.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm sm:text-base font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Alertas Críticos
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {criticalPatients.map((cp) => (
                <Card
                  key={cp.patient_id}
                  className="cursor-pointer border-destructive/20 bg-destructive/5 hover:bg-destructive/10 active:scale-[0.98] transition-all"
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
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDistanceToNow(parseISO(cp.analysis_date), { addSuffix: true, locale: ptBR })}
                      </span>
                    </div>
                    {cp.red_flags.map((rf, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[11px] text-destructive/80 ml-9">
                        <span className="mt-0.5 shrink-0">⚠</span>
                        <span className="line-clamp-1">{rf.finding}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* ── RECENT IMPORTS (deduplicated from priority) ── */}
        {filteredImports.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm sm:text-base font-semibold flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              Exames Recém-Importados
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {filteredImports.slice(0, isMobile ? 4 : 8).map((imp) => (
                <Card
                  key={imp.session_id}
                  className="cursor-pointer hover:bg-muted/50 active:scale-[0.98] transition-all"
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

        {/* ── QUICK ACTIONS ── */}
        <section>
          <h2 className="mb-3 text-sm sm:text-base font-semibold">Ações Rápidas</h2>
          <QuickActions />
        </section>

        {/* ── RECENT PATIENTS (deduplicated from priority blocks) ── */}
        {filteredRecents.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm sm:text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Últimos Acessados
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRecents.map((rp) => {
                const age = rp.birth_date ? (() => {
                  const today = new Date();
                  const birth = new Date(rp.birth_date);
                  return today.getFullYear() - birth.getFullYear() -
                    (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
                })() : null;

                return (
                  <Card
                    key={rp.id}
                    className="cursor-pointer hover:bg-muted/50 active:scale-[0.98] transition-all"
                    onClick={() => navigate(`/patient/${rp.id}`)}
                  >
                    <CardContent className="flex items-center gap-3 p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {rp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{rp.name}</p>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span>{rp.sex === "M" ? "Masc" : "Fem"}</span>
                          {age !== null && (
                            <>
                              <span>•</span>
                              <span>{age} anos</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{activityLabel(rp.activity_type)} {formatDistanceToNow(parseISO(rp.last_activity), { addSuffix: true, locale: ptBR })}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* ── PATIENT LIST (toggle) ── */}
        {showAllPatients && (
          <>
            <Separator />
            <section>
              <h2 className="mb-3 text-sm sm:text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Todos os Pacientes
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{patients.length}</Badge>
              </h2>

              {patients.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-lg font-medium">Nenhum paciente cadastrado</p>
                    <p className="text-sm text-muted-foreground">
                      Clique em "Novo Paciente" para começar
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {patients.map((p) => {
                    const age = p.birth_date ? (() => {
                      const today = new Date();
                      const birth = new Date(p.birth_date);
                      return today.getFullYear() - birth.getFullYear() -
                        (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
                    })() : null;

                    return (
                      <Card
                        key={p.id}
                        className="cursor-pointer hover:bg-muted/50 active:scale-[0.98] transition-all"
                        onClick={() => navigate(`/patient/${p.id}`)}
                      >
                        <CardContent className="flex items-center gap-3 p-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {p.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{p.name}</p>
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
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* Show all patients toggle */}
        {!showAllPatients && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => setShowAllPatients(true)}
            >
              <Users className="h-3.5 w-3.5" />
              Ver todos os {patients.length} pacientes
            </Button>
          </div>
        )}
        {showAllPatients && (
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground"
              onClick={() => setShowAllPatients(false)}
            >
              Recolher lista
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
