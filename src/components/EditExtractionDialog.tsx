import { useState, useMemo, useEffect } from "react";
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
import { MARKERS } from "@/lib/markers";
import { Pencil, Check, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditExtractionDialogProps {
  open: boolean;
  onClose: () => void;
  markerValues: Record<string, string>;
  onConfirm: (updated: Record<string, string>) => void;
}

export default function EditExtractionDialog({
  open,
  onClose,
  markerValues,
  onConfirm,
}: EditExtractionDialogProps) {
  // Only show markers that were extracted (have a value)
  const extractedMarkers = useMemo(
    () => MARKERS.filter((m) => markerValues[m.id] !== undefined && markerValues[m.id] !== ""),
    [markerValues]
  );

  const [localValues, setLocalValues] = useState<Record<string, string>>(() => ({ ...markerValues }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [search, setSearch] = useState("");

  // Sync localValues whenever the dialog opens with new data
  useEffect(() => {
    if (open) {
      setLocalValues({ ...markerValues });
      setEditingId(null);
      setEditBuffer("");
      setSearch("");
    }
  }, [open, markerValues]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return extractedMarkers.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.includes(q)
    );
  }, [extractedMarkers, search]);

  const startEdit = (markerId: string) => {
    setEditingId(markerId);
    setEditBuffer(localValues[markerId] ?? "");
  };

  const commitEdit = () => {
    if (editingId) {
      setLocalValues((prev) => ({ ...prev, [editingId]: editBuffer }));
    }
    setEditingId(null);
    setEditBuffer("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditBuffer("");
  };

  const removeMarker = (markerId: string) => {
    setLocalValues((prev) => {
      const next = { ...prev };
      delete next[markerId];
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(localValues);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Revisar Exames Extraídos
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Corrija valores extraídos incorretamente antes de salvar.
            Clique no ícone de lápis para editar, ou no X para remover um exame.
          </p>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Buscar exame..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-1 min-h-0 pr-2">
          <div className="space-y-1.5">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum exame encontrado.
              </p>
            )}
            {filtered.map((marker) => {
              const val = localValues[marker.id];
              if (val === undefined) return null; // was removed
              const isEditing = editingId === marker.id;

              return (
                <div
                  key={marker.id}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                    isEditing && "border-primary bg-primary/5"
                  )}
                >
                  <span className="flex-1 font-medium truncate">{marker.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">{marker.unit}</span>

                  {isEditing ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Input
                        autoFocus
                        value={editBuffer}
                        onChange={(e) => setEditBuffer(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="h-7 w-28 text-sm"
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={commitEdit}>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEdit}>
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="font-mono text-xs h-5 px-1.5">
                        {val}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => startEdit(marker.id)}
                        title="Editar valor"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMarker(marker.id)}
                        title="Remover exame"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground mr-auto">
            {Object.values(localValues).filter(Boolean).length} exames confirmados
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            Confirmar e Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
