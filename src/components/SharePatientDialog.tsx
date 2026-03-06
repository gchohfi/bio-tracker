import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Share2, Trash2, UserCheck, Clock } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type PatientShare = Tables<"patient_shares">;

interface SharePatientDialogProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

export function SharePatientDialog({
  open,
  onClose,
  patientId,
  patientName,
}: SharePatientDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [shares, setShares] = useState<PatientShare[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchShares = async () => {
    const { data, error } = await supabase
      .from("patient_shares")
      .select("*")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    if (!error && data) {
      setShares(data);
    }
  };

  useEffect(() => {
    if (open) {
      fetchShares();
    }
  }, [open, patientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !email.trim()) return;

    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail === user.email?.toLowerCase()) {
      toast({
        title: "Erro",
        description: "Você não pode compartilhar um paciente consigo mesmo.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("patient_shares").insert({
      patient_id: patientId,
      owner_id: user.id,
      shared_with_email: normalizedEmail,
    });
    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Aviso",
          description: "Este e-mail já tem acesso a este paciente.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao compartilhar",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      toast({ title: "Paciente compartilhado!", description: `Acesso concedido para ${normalizedEmail}.` });
      setEmail("");
      fetchShares();
    }
  };

  const handleRevoke = async (shareId: string, sharedEmail: string) => {
    const { error } = await supabase
      .from("patient_shares")
      .delete()
      .eq("id", shareId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Acesso revogado", description: `Acesso de ${sharedEmail} removido.` });
      fetchShares();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Compartilhar Paciente
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Compartilhe <span className="font-medium text-foreground">{patientName}</span> com outro profissional de saúde via e-mail.
        </p>

        <form onSubmit={handleShare} className="flex gap-2">
          <div className="flex-1">
            <Label className="sr-only">E-mail do profissional</Label>
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? "..." : "Compartilhar"}
          </Button>
        </form>

        {shares.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Acesso compartilhado com
            </p>
            <ul className="space-y-2">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {share.shared_with_id ? (
                      <UserCheck className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <span className="truncate">{share.shared_with_email}</span>
                    {!share.shared_with_id && (
                      <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">
                        Pendente
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                    onClick={() => handleRevoke(share.id, share.shared_with_email)}
                    title="Revogar acesso"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
