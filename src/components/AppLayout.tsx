import { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Beaker, LogOut } from "lucide-react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Beaker className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold tracking-tight">LabTrack</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="container flex-1 py-6">{children}</main>
    </div>
  );
}
