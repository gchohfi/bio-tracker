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
import { MARKERS, getMarkersByCategory, CATEGORIES, getMarkerStatus, type Category } from "@/lib/markers";
import { Pencil, Check, X, Search, FileDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResultRow {
  marker_id: string;
  session_id: string;
  value: number;
  text_value?: string;
  lab_ref_min?: number;
  lab_ref_max?: number;
  lab_ref_text?: string;
}

interface EditReportDialogProps {
  open: boolean;
  onClose: () => void;
  results: ResultRow[];
  sex: "M" | "F";
  onConfirm: (updatedResults: ResultRow[]) => void;
}

export default function EditReportDialog({
  open,
  onClose,
  results,
  sex,
  onConfirm,
}: EditReportDialogProps) {
  const [localResults, setLocalResults] = useState<ResultRow[]>(() => results.map(r => ({ ...r })));
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState("");
  const [search, setSearch] = useState("");

  // Reset when dialog opens with new data
  useEffect(() => {
    if (open) {
      setLocalResults(results.map(r => ({ ...r })));
      setEditingKey(null);
      setSearch("");
    }
  }, [open]);

  // Group by marker, show latest value per marker
  const markerLatestMap = useMemo(() => {
    const map: Record<string, ResultRow> = {};
    localResults.forEach((r) => {
      // Keep last occurrence (results are typically ordered)
      map[r.marker_id] = r;
    });
    return map;
  }, [localResults]);

  const markersWithData = useMemo(() => {
    return MARKERS.filter((m) => markerLatestMap[m.id]);
  }, [markerLatestMap]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return markersWithData.filter(
      (m) => m.name.toLowerCase().includes(q) || m.id.includes(q)
    );
  }, [markersWithData, search]);

  const startEdit = (markerId: string) => {
    const row = markerLatestMap[markerId];
    const marker = MARKERS.find(m => m.id === markerId);
    setEditingKey(markerId);
    if (marker?.qualitative) {
      setEditBuffer(row?.text_value || "");
    } else if (row?.text_value && /^[<>]=?\s*\d/.test(row.text_value)) {
      setEditBuffer(row.text_value);
    } else {
      setEditBuffer(String(row?.value ?? ""));
    }
  };

  const commitEdit = () => {
    if (!editingKey) return;
    const marker = MARKERS.find(m => m.id === editingKey);
    setLocalResults((prev) =>
      prev.map((r) => {
        if (r.marker_id !== editingKey) return r;
        if (marker?.qualitative) {
          return { ...r, text_value: editBuffer };
        }
        const opMatch = editBuffer.match(/^([<>]=?)\s*(\d+[.,]?\d*)$/);
        if (opMatch) {
          return { ...r, value: Number(opMatch[2].replace(",", ".")), text_value: editBuffer };
        }
        const num = Number(editBuffer.replace(",", "."));
        if (!isNaN(num)) {
          return { ...r, value: num, text_value: undefined };
        }
        return r;
      })
    );
    setEditingKey(null);
    setEditBuffer("");
  };

  const cancelEdit = () => {
    setEditingKey(null);
    setEditBuffer("");
  };

  const handleConfirm = () => {
    onConfirm(localResults);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Revisar Valores do Relatório
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Revise e corrija valores antes de gerar o PDF. Clique no lápis para editar.
          </p>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Buscar exame..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-1.5">
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum exame encontrado.
              </p>
            )}
            {filtered.map((marker) => {
              const row = markerLatestMap[marker.id];
              if (!row) return null;
              const isEditing = editingKey === marker.id;
              const displayVal = marker.qualitative
                ? (row.text_value || "—")
                : (row.text_value && /^[<>]/.test(row.text_value) ? row.text_value : String(row.value));
              
              const status = marker.qualitative ? "normal" : getMarkerStatus(row.value, marker, sex);

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
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-xs h-5 px-1.5",
                          status === "normal" && "border-green-300 text-green-700",
                          status === "high" && "border-red-300 text-red-700",
                          status === "low" && "border-red-300 text-red-700"
                        )}
                      >
                        {displayVal}
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground mr-auto">
            {markersWithData.length} exames no relatório
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleConfirm}>
            <FileDown className="mr-2 h-3.5 w-3.5" />
            Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

