import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { MARKERS } from "@/lib/markers";
import { Plus, Trash2, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "labtrack_custom_aliases";

export interface CustomAlias {
  id: string;
  markerId: string;
  alias: string;
}

export function loadCustomAliases(): CustomAlias[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCustomAliases(aliases: CustomAlias[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(aliases));
}

interface AliasConfigDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AliasConfigDialog({ open, onClose }: AliasConfigDialogProps) {
  const { toast } = useToast();
  const [aliases, setAliases] = useState<CustomAlias[]>(() => loadCustomAliases());
  const [newAlias, setNewAlias] = useState("");
  const [newMarkerId, setNewMarkerId] = useState("");

  const sortedMarkers = useMemo(
    () => [...MARKERS].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    []
  );

  const handleAdd = () => {
    if (!newAlias.trim() || !newMarkerId) {
      toast({ title: "Preencha o alias e selecione o marcador.", variant: "destructive" });
      return;
    }
    const duplicate = aliases.some(
      (a) => a.alias.toLowerCase() === newAlias.trim().toLowerCase()
    );
    if (duplicate) {
      toast({ title: "Este alias já existe.", variant: "destructive" });
      return;
    }
    const updated = [
      ...aliases,
      { id: crypto.randomUUID(), markerId: newMarkerId, alias: newAlias.trim() },
    ];
    setAliases(updated);
    saveCustomAliases(updated);
    setNewAlias("");
    setNewMarkerId("");
    toast({ title: "Alias adicionado!" });
  };

  const handleRemove = (id: string) => {
    const updated = aliases.filter((a) => a.id !== id);
    setAliases(updated);
    saveCustomAliases(updated);
  };

  const getMarkerName = (markerId: string) =>
    MARKERS.find((m) => m.id === markerId)?.name ?? markerId;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Aliases Personalizados
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Defina nomes alternativos que o seu laboratório usa para exames conhecidos.
            Esses aliases são usados durante a extração do PDF para melhorar o reconhecimento.
          </p>
        </DialogHeader>

        {/* Add new alias */}
        <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Adicionar novo alias
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Nome no laudo</Label>
              <Input
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder='Ex: "GLICEMIA CAPILAR"'
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Marcador correspondente</Label>
              <Select value={newMarkerId} onValueChange={setNewMarkerId}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {sortedMarkers.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-sm">
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" onClick={handleAdd} className="w-full">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>

        {/* List of existing aliases */}
        <ScrollArea className="flex-1 pr-1">
          {aliases.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum alias personalizado cadastrado.
            </p>
          ) : (
            <div className="space-y-1.5">
              {aliases.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                    {a.alias}
                  </span>
                  <span className="text-muted-foreground text-xs">→</span>
                  <Badge variant="outline" className="text-xs">
                    {getMarkerName(a.markerId)}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-auto text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(a.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mr-auto">
            {aliases.length} alias(es) cadastrado(s)
          </p>
          <Button size="sm" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
