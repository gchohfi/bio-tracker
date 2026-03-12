import { useState, useEffect } from "react";
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
  Brain,
  Stethoscope,
  Clock,
  FlaskConical,
  FileEdit,
  Sun,
  Users,
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
  const [search, setSearch] = useState("");
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

    // Recent patients — derive from encounters + sessions activity
    const patientActivity = new Map<string, string>(); // patient_id -> latest timestamp
    for (const e of (draftsRes.data ?? [])) {
      const ts = e.updated_at;
      if (!patientActivity.has(e.patient_id) || ts > patientActivity.get(e.patient_id)!) {
        patientActivity.set(e.patient_id, ts);
      }
    }
    for (const s of (sessionsRes.data ?? [])) {
      const ts = s.created_at;
      if (!patientActivity.has(s.patient_id) || ts > patientActivity.get(s.patient_id)!) {
        patientActivity.set(s.patient_id, ts);
      }
    }
    for (const a of (analysesRes.data ?? [])) {
      const ts = a.created_at;
      if (!patientActivity.has(a.patient_id) || ts > patientActivity.get(a.patient_id)!) {
        patientActivity.set(a.patient_id, ts);
      }
    }

    const allPatients = patientsRes.data ?? [];
    const recents: RecentPatient[] = Array.from(patientActivity.entries())
      .sort((a, b) => b[1].localeCompare(a[1]))
      .slice(0, 6)
      .map(([pid, ts]) => {
        const p = allPatients.find(pp => pp.id === pid);
        return {
          id: pid,
          name: p?.name ?? "—",
          sex: p?.sex ?? "F",
          birth_date: p?.birth_date ?? null,
          last_activity: ts,
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

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
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

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* ── HEADER ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
              <Sun className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight">{greeting}</h1>
              <p className="text-xs text-muted-foreground">
                {format(now, "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {!isMobile && (
              <div className="relative flex-1 sm:w-64 sm:flex-none">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Buscar paciente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}
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
            {recentImports.length > 0 && (
              <Badge variant="secondary" className="shrink-0 gap-1 py-1 px-2.5 text-xs">
                <FlaskConical className="h-3 w-3" />
                {recentImports.length} exame{recentImports.length > 1 ? "s" : ""} recente{recentImports.length > 1 ? "s" : ""}
              </Badge>
            )}
            {!hasPriority && recentImports.length === 0 && (
              <Badge variant="secondary" className="shrink-0 py-1 px-2.5 text-xs">
                ✓ Nenhuma pendência
              </Badge>
            )}
          </div>
        )}

        {/* ── PRIORITY SECTION ── */}
        {hasPriority && (
          <section className="space-y-4">
            <h2 className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Atenção Prioritária
            </h2>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Draft Encounters */}
              {draftEncounters.length > 0 && (
                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-primary">
                      <FileEdit className="h-4 w-4" />
                      Rascunhos Abertos
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{draftEncounters.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 p-4 pt-0">
                    {draftEncounters.map((enc) => (
                      <div
                        key={enc.id}
                        className="rounded-lg border p-3 cursor-pointer hover:bg-muted/50 active:scale-[0.98] transition-all flex items-center justify-between gap-2"
                        onClick={() => navigate(`/patient/${enc.patient_id}/encounter/${enc.id}`)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {enc.patient_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{enc.patient_name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {format(parseISO(enc.encounter_date), "dd/MM/yyyy", { locale: ptBR })}
                              {enc.chief_complaint && ` • ${enc.chief_complaint}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className="text-[9px] h-4 px-1">Rascunho</Badge>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

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
                        className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 cursor-pointer hover:bg-destructive/10 active:scale-[0.98] transition-all"
                        onClick={() => navigate(`/patient/${cp.patient_id}?tab=resumo`)}
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
            </div>
          </section>
        )}

        {/* ── RECENT IMPORTS ── */}
        {recentImports.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm sm:text-base font-semibold flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-primary" />
              Exames Recém-Importados
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {recentImports.slice(0, isMobile ? 4 : 8).map((imp) => (
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

        {/* ── RECENT PATIENTS ── */}
        {recentPatients.length > 0 && !search && (
          <section>
            <h2 className="mb-3 text-sm sm:text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Últimos Acessados
            </h2>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {recentPatients.map((rp) => {
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
                          <span>{formatDistanceToNow(parseISO(rp.last_activity), { addSuffix: true, locale: ptBR })}</span>
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

        {/* ── PATIENT LIST (search or expanded) ── */}
        {(search || showAllPatients) && (
          <>
            <Separator />
            <section>
              {isMobile && !search && (
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Buscar paciente..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              )}
              <h2 className="mb-3 text-sm sm:text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                Todos os Pacientes
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{filtered.length}</Badge>
              </h2>

              {filtered.length === 0 ? (
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
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
        {!search && !showAllPatients && (
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
        {showAllPatients && !search && (
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
