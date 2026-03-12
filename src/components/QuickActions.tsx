import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, FileUp, Stethoscope, FileDown } from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  tab: string;
  action?: string;
}

const ACTIONS: QuickAction[] = [
  {
    id: "soap",
    label: "Nova Nota SOAP",
    description: "Registrar evolução clínica",
    icon: <FileText className="h-5 w-5" />,
    tab: "clinical_evolution",
    action: "new_soap",
  },
  {
    id: "import",
    label: "Importar Exame",
    description: "Upload de PDF de laboratório",
    icon: <FileUp className="h-5 w-5" />,
    tab: "sessions",
    action: "import",
  },
  {
    id: "encounter",
    label: "Nova Consulta",
    description: "Iniciar novo atendimento",
    icon: <Stethoscope className="h-5 w-5" />,
    tab: "clinical_evolution",
    action: "new_encounter",
  },
  {
    id: "pdf",
    label: "Gerar PDF",
    description: "Exportar relatório da análise",
    icon: <FileDown className="h-5 w-5" />,
    tab: "analysis",
  },
];

type PatientRow = { id: string; name: string; sex: string };

export default function QuickActions() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<QuickAction | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const openPicker = (action: QuickAction) => {
    setSelectedAction(action);
    setPickerOpen(true);
    setQuery("");
    setResults([]);
  };

  const handleSearch = (value: string) => {
    setQuery(value);
    if (debounceTimer) clearTimeout(debounceTimer);
    const trimmed = value.trim();
    if (trimmed.length < 2 || !user?.id) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("patients")
        .select("id, name, sex")
        .eq("practitioner_id", user.id)
        .ilike("name", `%${trimmed}%`)
        .order("name", { ascending: true })
        .limit(8);
      setResults((data as PatientRow[]) ?? []);
      setSearching(false);
    }, 200);
    setDebounceTimer(timer);
  };

  const handleSelect = (patient: PatientRow) => {
    setPickerOpen(false);
    if (!selectedAction) return;
    const params = new URLSearchParams({ tab: selectedAction.tab });
    if (selectedAction.action) params.set("action", selectedAction.action);
    navigate(`/patient/${patient.id}?${params.toString()}`);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map((a) => (
          <button
            key={a.id}
            onClick={() => openPicker(a)}
            className="group flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              {a.icon}
            </div>
            <div>
              <p className="text-sm font-medium">{a.label}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{a.description}</p>
            </div>
          </button>
        ))}
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedAction?.icon}
              {selectedAction?.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar paciente pelo nome..."
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="max-h-64 min-h-[80px] overflow-y-auto rounded-md border">
              {query.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Digite o nome do paciente
                </p>
              ) : searching ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">Buscando...</p>
              ) : results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Nenhum paciente encontrado
                </p>
              ) : (
                results.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{p.name}</span>
                    </div>
                    <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
                      {p.sex === "M" ? "Masc" : "Fem"}
                    </Badge>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
