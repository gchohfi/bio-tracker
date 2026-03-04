import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Beaker, LogOut, Sliders } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              onClick={() => navigate("/")}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Beaker className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold tracking-tight">LabTrack</span>
            </button>
            <nav className="flex items-center gap-1">
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
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="container flex-1 min-h-0 overflow-y-auto py-6">{children}</main>
    </div>
  );
}
