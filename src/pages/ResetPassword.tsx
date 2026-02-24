import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Beaker } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for PASSWORD_RECOVERY event (fires after code exchange)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
      // Also handle: user arrives already authenticated via recovery link
      if (event === "SIGNED_IN" && session) {
        // Check if URL had recovery indicators
        const params = new URLSearchParams(window.location.search);
        const hash = window.location.hash;
        if (params.has("code") || hash.includes("type=recovery")) {
          setReady(true);
        }
      }
    });

    // Check hash for type=recovery (implicit flow)
    if (window.location.hash.includes("type=recovery")) {
      setReady(true);
    }

    // Check for code param (PKCE flow) — Supabase will exchange it automatically
    const params = new URLSearchParams(window.location.search);
    if (params.has("code")) {
      // The code exchange happens automatically via onAuthStateChange
      // Set a timeout as fallback in case event was missed
      const timeout = setTimeout(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            setReady(true);
          } else {
            setError(true);
          }
        });
      }, 3000);
      return () => {
        subscription.unsubscribe();
        clearTimeout(timeout);
      };
    }

    // If no code and no hash, check if user is already in a recovery session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // User might have already exchanged the code
        setReady(true);
      } else {
        // No recovery indicators at all — show error after a delay
        setTimeout(() => {
          if (!ready) setError(true);
        }, 3000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha atualizada!", description: "Você já pode entrar com a nova senha." });
      navigate("/");
    }
    setLoading(false);
  };

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Beaker className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">Link inválido</CardTitle>
            <CardDescription>
              O link de recuperação expirou ou é inválido. Solicite um novo na tela de login.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate("/auth")}>Voltar ao login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Beaker className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">LabTrack</CardTitle>
            <CardDescription>Verificando link de recuperação...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Beaker className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Nova senha</CardTitle>
          <CardDescription>Digite sua nova senha abaixo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
