import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  ChevronRight,
  Users,
  ArrowUpDown,
  Loader2,
  User,
} from "lucide-react";
import { format, parseISO, differenceInYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

type SortField = "name" | "created_at";
type SortDir = "asc" | "desc";

export default function Patients() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [sexFilter, setSexFilter] = useState<"all" | "M" | "F">("all");

  // New patient dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSex, setNewSex] = useState<"M" | "F">("F");
  const [newBirthDate, setNewBirthDate] = useState("");

  const fetchPatients = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("practitioner_id", user.id)
      .order("name", { ascending: true });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setPatients(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) fetchPatients();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    const { data, error } = await supabase
      .from("patients")
      .insert({ name: newName.trim(), sex: newSex, birth_date: newBirthDate || null, practitioner_id: user.id })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else if (data) {
      setDialogOpen(false);
      setNewName("");
      setNewBirthDate("");
      navigate(`/patient/${data.id}`);
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let list = patients;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }

    // Sex filter
    if (sexFilter !== "all") {
      list = list.filter((p) => p.sex === sexFilter);
    }

    // Sort
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name, "pt-BR");
      } else {
        cmp = a.created_at.localeCompare(b.created_at);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [patients, search, sexFilter, sortField, sortDir]);

  const getAge = (birthDate: string | null) => {
    if (!birthDate) return null;
    try {
      return differenceInYears(new Date(), parseISO(birthDate));
    } catch {
      return null;
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto py-6 px-3 sm:px-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">Pacientes</h1>
            <Badge variant="secondary" className="text-xs">
              {patients.length}
            </Badge>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Novo Paciente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Paciente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 mt-2">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nome completo"
                    required
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Sexo</Label>
                    <Select value={newSex} onValueChange={(v) => setNewSex(v as "M" | "F")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="F">Feminino</SelectItem>
                        <SelectItem value="M">Masculino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nascimento</Label>
                    <Input type="date" value={newBirthDate} onChange={(e) => setNewBirthDate(e.target.value)} />
                  </div>
                </div>
                <Button type="submit" className="w-full">Criar paciente</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar paciente por nome..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={sexFilter} onValueChange={(v) => setSexFilter(v as any)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Sexo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="F">Feminino</SelectItem>
                <SelectItem value="M">Masculino</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => toggleSort(sortField === "name" ? "created_at" : "name")}
              title={`Ordenar por ${sortField === "name" ? "data" : "nome"}`}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Sort indicator */}
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>
            Ordenando por {sortField === "name" ? "nome" : "data de cadastro"} ({sortDir === "asc" ? "A→Z" : "Z→A"})
          </span>
          <span>•</span>
          <span>{filtered.length} de {patients.length} pacientes</span>
        </div>

        {/* Patient list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 flex flex-col items-center text-center gap-3">
              <Users className="h-8 w-8 text-muted-foreground/50" />
              {search ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Nenhum paciente encontrado para "<strong>{search}</strong>"
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setSearch("")}>
                    Limpar busca
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">Nenhum paciente cadastrado</p>
                  <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Criar primeiro paciente
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((p) => {
              const age = getAge(p.birth_date);
              return (
                <Card
                  key={p.id}
                  className="cursor-pointer hover:border-primary/30 hover:bg-accent/30 transition-colors"
                  onClick={() => navigate(`/patient/${p.id}`)}
                >
                  <CardContent className="py-3 px-4 flex items-center gap-3">
                    <div className="flex items-center justify-center h-9 w-9 rounded-full bg-primary/10 shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{p.name}</span>
                        <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                          {p.sex === "M" ? "Masc" : "Fem"}
                        </Badge>
                        {age !== null && (
                          <span className="text-[10px] text-muted-foreground shrink-0">{age} anos</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        {p.birth_date && (
                          <span>{format(parseISO(p.birth_date), "dd/MM/yyyy")}</span>
                        )}
                        {(p.objectives?.length ?? 0) > 0 && (
                          <>
                            <span>•</span>
                            <span>{p.objectives!.length} objetivo{p.objectives!.length > 1 ? "s" : ""}</span>
                          </>
                        )}
                        {p.main_complaints && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px]">{p.main_complaints}</span>
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
      </div>
    </AppLayout>
  );
}
