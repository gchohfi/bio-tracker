import { useMemo, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  MARKERS,
  getMarkersByCategory,
  type Category,
} from "@/lib/markers";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  BarChart3,
  FileSearch,
  MinusCircle,
} from "lucide-react";

interface ImportVerificationProps {
  open: boolean;
  onClose: () => void;
  importedMarkers: Record<string, string>;
  pdfText: string;
}

export default function ImportVerification({
  open,
  onClose,
  importedMarkers,
  pdfText,
}: ImportVerificationProps) {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  // Markers manually marked as "not done" by the patient
  const [notDone, setNotDone] = useState<Set<string>>(new Set());

  const toggleNotDone = useCallback((markerId: string) => {
    setNotDone((prev) => {
      const next = new Set(prev);
      if (next.has(markerId)) next.delete(markerId);
      else next.add(markerId);
      return next;
    });
  }, []);

  const found = useMemo(
    () =>
      MARKERS.filter(
        (m) => importedMarkers[m.id] !== undefined && importedMarkers[m.id] !== ""
      ),
    [importedMarkers]
  );

  const notFound = useMemo(
    () =>
      MARKERS.filter(
        (m) => importedMarkers[m.id] === undefined || importedMarkers[m.id] === ""
      ),
    [importedMarkers]
  );

  const notExtracted = useMemo(
    () => notFound.filter((m) => !notDone.has(m.id)),
    [notFound, notDone]
  );

  const toggleCat = (cat: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const catStats = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const markers = getMarkersByCategory(cat);
      const foundInCat = markers.filter(
        (m) => importedMarkers[m.id] !== undefined && importedMarkers[m.id] !== ""
      );
      const notDoneInCat = markers.filter((m) => notDone.has(m.id));
      return { cat, total: markers.length, found: foundInCat.length, notDone: notDoneInCat.length, markers };
    });
  }, [importedMarkers, notDone]);

  const pdfLines = useMemo(() => {
    return pdfText
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .slice(0, 500);
  }, [pdfText]);

  const highlightLine = (line: string) => {
    const lower = line.toLowerCase();
    const matchedMarker = found.find(
      (m) =>
        lower.includes(m.name.toLowerCase()) ||
        lower.includes(m.id.replace(/_/g, " "))
    );
    if (matchedMarker) {
      return (
        <span className="bg-emerald-100 dark:bg-emerald-900/30 rounded px-1">
          {line}
        </span>
      );
    }
    return <span>{line}</span>;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Conferência da Importação
          </DialogTitle>
        </DialogHeader>

        {/* Summary bar */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">{found.length} encontrados</span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <XCircle className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {notExtracted.length} não extraídos
            </span>
          </div>
          {notDone.size > 0 && (
            <>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <MinusCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  {notDone.size} não realizados
                </span>
              </div>
            </>
          )}
          <div className="ml-auto">
            <Badge
              variant={found.length > MARKERS.length * 0.7 ? "default" : "secondary"}
              className="text-xs"
            >
              {Math.round((found.length / MARKERS.length) * 100)}% cobertura
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="checklist" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="checklist" className="gap-1.5 text-xs">
              <ClipboardList className="h-3.5 w-3.5" />
              Checklist
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" />
              Resumo
            </TabsTrigger>
            <TabsTrigger value="pdf" className="gap-1.5 text-xs">
              <FileSearch className="h-3.5 w-3.5" />
              Texto do PDF
            </TabsTrigger>
          </TabsList>

          {/* Checklist by category */}
          <TabsContent value="checklist" className="flex-1 overflow-hidden mt-2">
            <p className="text-xs text-muted-foreground mb-2">
              Clique em <MinusCircle className="inline h-3 w-3" /> nos exames que o paciente <strong>não realizou</strong> para distinguir de "não extraído".
            </p>
            <ScrollArea className="h-[370px] pr-3">
              <div className="space-y-1">
                {catStats.map(({ cat, total, found: catFound, notDone: catNotDone, markers }) => (
                  <div key={cat} className="rounded-lg border">
                    <button
                      onClick={() => toggleCat(cat)}
                      className="flex w-full items-center gap-2 p-2.5 text-left hover:bg-muted/50 transition-colors"
                    >
                      {expandedCats.has(cat) ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <div
                        className="h-2.5 w-2.5 rounded-full"
                        style={{
                          backgroundColor: `hsl(${CATEGORY_COLORS[cat as Category]})`,
                        }}
                      />
                      <span className="text-sm font-medium flex-1">{cat}</span>
                      <span className="text-xs text-muted-foreground">
                        {catFound}/{total}
                        {catNotDone > 0 && (
                          <span className="ml-1 text-muted-foreground/60">
                            ({catNotDone} n/r)
                          </span>
                        )}
                      </span>
                      {catFound === total ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : catFound > 0 ? (
                        <Badge variant="outline" className="h-5 text-[10px] border-amber-400 text-amber-600">
                          parcial
                        </Badge>
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </button>
                    {expandedCats.has(cat) && (
                      <div className="border-t px-3 py-2 space-y-1">
                        {markers.map((m) => {
                          const hasVal =
                            importedMarkers[m.id] !== undefined &&
                            importedMarkers[m.id] !== "";
                          const isNotDone = notDone.has(m.id);
                          return (
                            <div
                              key={m.id}
                              className={cn(
                                "flex items-center gap-2 text-sm py-0.5",
                                isNotDone && "opacity-50"
                              )}
                            >
                              {hasVal ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              ) : isNotDone ? (
                                <MinusCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                              )}
                              <span
                                className={cn(
                                  "flex-1",
                                  isNotDone && "line-through text-muted-foreground",
                                  !hasVal && !isNotDone && "text-muted-foreground"
                                )}
                              >
                                {m.name}
                              </span>
                              {hasVal ? (
                                <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                                  {importedMarkers[m.id]} {m.unit}
                                </span>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleNotDone(m.id);
                                  }}
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded border transition-colors",
                                    isNotDone
                                      ? "bg-muted border-border text-muted-foreground hover:bg-background"
                                      : "border-dashed border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground hover:bg-muted"
                                  )}
                                >
                                  {isNotDone ? "Desfazer" : "Não realizou"}
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Summary */}
          <TabsContent value="summary" className="flex-1 overflow-hidden mt-2">
            <ScrollArea className="h-[400px] pr-3">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Marcadores Encontrados ({found.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {found.map((m) => (
                      <Badge
                        key={m.id}
                        variant="outline"
                        className="text-[10px] border-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                      >
                        {m.name}: {importedMarkers[m.id]}
                      </Badge>
                    ))}
                  </div>
                </div>

                {notDone.size > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <MinusCircle className="h-4 w-4" />
                      Não Realizados pelo Paciente ({notDone.size})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {MARKERS.filter((m) => notDone.has(m.id)).map((m) => (
                        <Badge
                          key={m.id}
                          variant="outline"
                          className="text-[10px] text-muted-foreground line-through"
                        >
                          {m.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4" />
                    Não Extraídos ({notExtracted.length})
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {notExtracted.map((m) => (
                      <Badge
                        key={m.id}
                        variant="outline"
                        className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300"
                      >
                        {m.name}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    * Estes marcadores estão no sistema mas não foram encontrados no PDF. Use o checklist para marcar os que o paciente não realizou.
                  </p>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* PDF text comparison */}
          <TabsContent value="pdf" className="flex-1 overflow-hidden mt-2">
            <ScrollArea className="h-[400px]">
              <div className="space-y-0.5 font-mono text-xs leading-relaxed">
                {pdfLines.map((line, i) => (
                  <div key={i} className="flex gap-2 py-0.5">
                    <span className="w-8 text-right text-muted-foreground/50 shrink-0 select-none">
                      {i + 1}
                    </span>
                    <div className="flex-1 break-all">{highlightLine(line)}</div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const lines = [
                "EXAMES NÃO ENCONTRADOS NO PDF",
                `Total: ${notExtracted.length}`,
                "",
                ...catStats
                  .map(({ cat, markers }) => {
                    const missing = markers.filter(
                      (m) =>
                        (importedMarkers[m.id] === undefined || importedMarkers[m.id] === "") &&
                        !notDone.has(m.id)
                    );
                    if (missing.length === 0) return null;
                    return [
                      `── ${cat} (${missing.length}) ──`,
                      ...missing.map((m) => `  • ${m.name} (${m.unit})`),
                      "",
                    ].join("\n");
                  })
                  .filter(Boolean),
                ...(notDone.size > 0
                  ? [
                      "── NÃO REALIZADOS PELO PACIENTE ──",
                      ...MARKERS.filter((m) => notDone.has(m.id)).map((m) => `  • ${m.name}`),
                    ]
                  : []),
              ];
              const blob = new Blob([lines.join("\n")], { type: "text/plain" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = "exames-nao-encontrados.txt";
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            Exportar não encontrados
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}