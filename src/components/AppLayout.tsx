import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Beaker, LogOut, Search, Sliders, Users } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import type { Tables } from "@/integrations/supabase/types";

type PatientSearchRow = Pick<Tables<"patients">, "id" | "name" | "sex">;

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PatientSearchRow[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2 || !user?.id) {
      setResults([]);
      setSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await supabase
        .from("patients")
        .select("id, name, sex")
        .eq("practitioner_id", user.id)
        .ilike("name", `%${normalized}%`)
        .order("name", { ascending: true })
        .limit(8);
      setResults((data as PatientSearchRow[]) ?? []);
      setSearching(false);
    }, 180);

    return () => clearTimeout(timer);
  }, [query, user?.id]);

  useEffect(() => {
    setQuery("");
    setResults([]);
  }, [location.pathname]);

  const hasSearchUi = query.trim().length >= 2;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <button
              className="flex items-center gap-2 transition-opacity hover:opacity-80"
              onClick={() => navigate("/")}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Beaker className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold tracking-tight">LabTrack</span>
            </button>
            <nav className="hidden items-center gap-1 md:flex">
              <Button
                variant={location.pathname === "/patients" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => navigate("/patients")}
                className="gap-1.5 text-sm"
              >
                <Users className="h-3.5 w-3.5" />
                Pacientes
              </Button>
              <Button
                variant={location.pathname === "/prompts" ? "secondary" : "ghost"}
                size="sm"
                onClick={() => navigate("/prompts")}
                className="gap-1.5 text-sm"
                title="Gerenciar prompts de análise por especialidade"
              >
                <Sliders className="h-3.5 w-3.5" />
                Prompts IA
              </Button>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-48 sm:w-64 lg:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-9 pr-8"
                placeholder="Buscar paciente..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query.length > 0 && (
                <button
                  onClick={() => { setQuery(""); setResults([]); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  ×
                </button>
              )}

              {hasSearchUi && (
                <div className="absolute left-0 right-0 top-11 z-50 rounded-md border bg-popover p-1 shadow-md">
                  {searching ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Buscando...</div>
                  ) : results.length === 0 ? (
                    <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum paciente encontrado</div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto">
                      {results.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => navigate(`/patient/${p.id}`)}
                          className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                        >
                          <span className="truncate">{p.name}</span>
                          <Badge variant="secondary" className="ml-2 shrink-0 text-[10px]">
                            {p.sex === "M" ? "Masc" : "Fem"}
                          </Badge>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <span className="hidden text-sm text-muted-foreground md:block">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="container min-h-0 flex-1 overflow-y-auto py-6">{children}</main>
    </div>
  );
}
