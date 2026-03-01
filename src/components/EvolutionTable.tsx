import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle } from "lucide-react";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  MARKERS,
  getMarkersByCategory,
  getMarkerStatus,
  parseOperatorValue,
  type Category,
  type MarkerDef,
} from "@/lib/markers";
import type { Tables } from "@/integrations/supabase/types";

type LabSession = Tables<"lab_sessions">;
type LabResult = Tables<"lab_results">;

type StatusFilter = "all" | "with_data" | "alerts" | "normal" | "low" | "high";
type PanelFilter = "all" | "Padrão" | "Adicional";

interface EvolutionTableProps {
  patientId: string;
  sessions: LabSession[];
  sex: "M" | "F";
}

export default function EvolutionTable({ patientId, sessions, sex }: EvolutionTableProps) {
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | "Todos">("Todos");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [panelFilter, setPanelFilter] = useState<PanelFilter>("Padrão");

  useEffect(() => {
    if (sessions.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }
    const fetchResults = async () => {
      setLoading(true);
      const sessionIds = sessions.map((s) => s.id);
      const { data } = await supabase
        .from("lab_results")
        .select("*")
        .in("session_id", sessionIds);
      setResults(data || []);
      setLoading(false);
    };
    fetchResults();
  }, [sessions]);

  // Build lookup: resultMap[markerId][sessionId] = value
  const resultMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    results.forEach((r) => {
      if (!map[r.marker_id]) map[r.marker_id] = {};
      map[r.marker_id][r.session_id] = r.value ?? 0;
    });
    return map;
  }, [results]);

  // Build text lookup: textMap[markerId][sessionId] = text_value
  const textMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    results.forEach((r) => {
      const textVal = (r as any).text_value;
      if (textVal) {
        if (!map[r.marker_id]) map[r.marker_id] = {};
        map[r.marker_id][r.session_id] = textVal;
      }
    });
    return map;
  }, [results]);

  // Build lab reference lookup: labRefMap[markerId][sessionId] = { text, min, max }
  // Uses the most recent session that has a lab reference for each marker
  const labRefMap = useMemo(() => {
    const map: Record<string, { text?: string; min?: number; max?: number }> = {};
    // Sort results by session date (newest first) to prefer most recent reference
    const sortedResults = [...results].sort((a, b) => {
      const sA = sessions.find(s => s.id === a.session_id);
      const sB = sessions.find(s => s.id === b.session_id);
      if (!sA || !sB) return 0;
      return sB.session_date.localeCompare(sA.session_date);
    });
    sortedResults.forEach((r) => {
      const refText = (r as any).lab_ref_text;
      const refMin = (r as any).lab_ref_min;
      const refMax = (r as any).lab_ref_max;
      if ((refText || refMin !== undefined || refMax !== undefined) && !map[r.marker_id]) {
        map[r.marker_id] = { text: refText, min: refMin, max: refMax };
      }
    });
    return map;
  }, [results, sessions]);

  // Sorted sessions oldest → newest (left to right)
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.session_date.localeCompare(b.session_date)),
    [sessions]
  );

  // Helper to get status considering operator from text_value
  const getStatusWithOperator = (val: number, marker: MarkerDef, sessionId: string): "normal" | "low" | "high" => {
    const textVal = textMap[marker.id]?.[sessionId];
    if (textVal && !marker.qualitative) {
      const parsed = parseOperatorValue(textVal);
      if (parsed) {
        return getMarkerStatus(parsed.numericValue, marker, sex, parsed.operator);
      }
    }
    return getMarkerStatus(val, marker, sex);
  };

  // Filter markers
  const filteredMarkers = useMemo(() => {
    let markers = activeCategory === "Todos" ? MARKERS : getMarkersByCategory(activeCategory);

    // Filter by panel
    if (panelFilter !== "all") {
      markers = markers.filter((m) => (m as any).panel === panelFilter);
    }

    if (statusFilter === "with_data") {
      markers = markers.filter((m) => {
        if (m.qualitative) {
          return textMap[m.id] && Object.keys(textMap[m.id]).length > 0;
        }
        return resultMap[m.id] && Object.keys(resultMap[m.id]).length > 0;
      });
    } else if (statusFilter === "alerts") {
      markers = markers.filter((m) => {
        if (m.qualitative) return false;
        const vals = resultMap[m.id];
        if (!vals) return false;
        return Object.entries(vals).some(([sid, v]) => getStatusWithOperator(v, m, sid) !== "normal");
      });
    } else if (statusFilter === "normal" || statusFilter === "low" || statusFilter === "high") {
      markers = markers.filter((m) => {
        if (m.qualitative) return false;
        const vals = resultMap[m.id];
        if (!vals) return false;
        const latestSession = sortedSessions[sortedSessions.length - 1];
        if (!latestSession || vals[latestSession.id] === undefined) return false;
        return getStatusWithOperator(vals[latestSession.id], m, latestSession.id) === statusFilter;
      });
    }

    return markers;
  }, [activeCategory, statusFilter, panelFilter, resultMap, textMap, sex, sortedSessions]);

  // Summary stats for the latest session
  const summaryStats = useMemo(() => {
    const latestSession = sortedSessions[sortedSessions.length - 1];
    if (!latestSession) return { normal: 0, low: 0, high: 0, total: 0 };
    let normal = 0, low = 0, high = 0;
    MARKERS.forEach((m) => {
      if (m.qualitative) return;
      const val = resultMap[m.id]?.[latestSession.id];
      if (val === undefined) return;
      const status = getStatusWithOperator(val, m, latestSession.id);
      if (status === "normal") normal++;
      else if (status === "low") low++;
      else if (status === "high") high++;
    });
    return { normal, low, high, total: normal + low + high };
  }, [resultMap, textMap, sortedSessions, sex]);

  const alertCount = summaryStats.low + summaryStats.high;

  // Group filtered markers by category
  const groupedMarkers = useMemo(() => {
    const groups: { category: Category; markers: MarkerDef[] }[] = [];
    const catSet = new Set<string>();
    filteredMarkers.forEach((m) => {
      if (!catSet.has(m.category)) {
        catSet.add(m.category);
        groups.push({ category: m.category as Category, markers: [] });
      }
      groups.find((g) => g.category === m.category)!.markers.push(m);
    });
    return groups;
  }, [filteredMarkers]);


  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">Nenhuma sessão registrada</p>
          <p className="text-sm text-muted-foreground">
            Clique no botão <strong>"Nova Sessão"</strong> acima para adicionar exames laboratoriais.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">


      {/* Panel Filter */}
      <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/30">
        <span className="text-xs font-semibold text-muted-foreground shrink-0">Painel:</span>
        <div className="flex gap-1.5">
          {([
            ["all", "Todos os painéis", "outline"],
            ["Padrão", "⭐ Padrão", "blue"],
            ["Adicional", "➕ Adicional", "violet"],
          ] as [PanelFilter, string, string][]).map(([key, label, color]) => (
            <Button
              key={key}
              variant={panelFilter === key ? "default" : "outline"}
              size="sm"
              className={cn(
                "text-xs rounded-full h-7 px-3",
                panelFilter === key && key === "Padrão" && "bg-blue-600 hover:bg-blue-700 border-blue-600 text-white",
                panelFilter === key && key === "Adicional" && "bg-violet-600 hover:bg-violet-700 border-violet-600 text-white",
                panelFilter !== key && key === "Padrão" && "border-blue-300 text-blue-700 hover:bg-blue-50",
                panelFilter !== key && key === "Adicional" && "border-violet-300 text-violet-700 hover:bg-violet-50",
              )}
              onClick={() => setPanelFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {panelFilter === "Padrão" && "Exames solicitados rotineiramente"}
          {panelFilter === "Adicional" && "Exames complementares e especializados"}
          {panelFilter === "all" && "Todos os marcadores disponíveis"}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ScrollArea className="w-full sm:w-auto">
          <div className="flex gap-1 pb-2">
            <Button
              variant={activeCategory === "Todos" ? "default" : "outline"}
              size="sm"
              className="shrink-0 rounded-full text-xs"
              onClick={() => setActiveCategory("Todos")}
            >
              Todos
            </Button>
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                variant={activeCategory === cat ? "default" : "outline"}
                size="sm"
                className="shrink-0 rounded-full text-xs"
                style={
                  activeCategory === cat
                    ? { backgroundColor: `hsl(${CATEGORY_COLORS[cat]})`, borderColor: "transparent" }
                    : undefined
                }
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

      </div>

      {/* Evolution table */}
      {filteredMarkers.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Nenhum marcador encontrado com os filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground sm:hidden">
            <span>← Deslize para ver os valores →</span>
          </div>
          <ScrollArea className="w-full">
            <div className="min-w-[600px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="sticky left-0 z-10 min-w-[140px] bg-muted/30 px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      Marcador
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      Ref.
                    </th>
                    {sortedSessions.map((s) => (
                      <th
                        key={s.id}
                        className="min-w-[70px] px-1 py-2 text-center text-xs font-medium text-muted-foreground"
                      >
                        {format(parseISO(s.session_date), "dd/MM/yy")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupedMarkers.map((group) => (
                    <>
                      {/* Category divider */}
                      <tr key={`cat-${group.category}`}>
                        <td
                          colSpan={2 + sortedSessions.length}
                          className="px-3 py-2"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: `hsl(${CATEGORY_COLORS[group.category]})` }}
                            />
                            <span className="text-xs font-semibold" style={{ color: `hsl(${CATEGORY_COLORS[group.category]})` }}>
                              {group.category}
                            </span>
                            <div className="h-px flex-1 bg-border" />
                          </div>
                        </td>
                      </tr>
                      {group.markers.map((marker) => {
                        const [min, max] = marker.labRange[sex];   // ref. laboratorial convencional
                        const [fMin, fMax] = marker.refRange[sex];  // ref. funcional (descritiva)
                        const isQualitative = marker.qualitative;
                        const markerPanel = (marker as any).panel as string | undefined;
                        return (
                          <tr
                            key={marker.id}
                            className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                          >
                            <td className="sticky left-0 z-10 bg-card px-2 py-1.5">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium">{marker.name}</span>
                                {panelFilter === "all" && markerPanel && (
                                  <span className={cn(
                                    "inline-flex items-center rounded-full px-1.5 py-0 text-[9px] font-semibold",
                                    markerPanel === "Padrão" ? "bg-blue-100 text-blue-700" : "bg-violet-100 text-violet-700"
                                  )}>
                                    {markerPanel === "Padrão" ? "⭐" : "➕"}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {isQualitative ? "qualitativo" : marker.unit}
                              </div>
                            </td>
                            <td className="px-1 py-1.5 text-[10px] text-muted-foreground whitespace-nowrap">
                              {isQualitative ? (
                                "—"
                              ) : (
                                <div className="space-y-0.5">
                                  {/* Referência laboratorial convencional (principal) */}
                                  <div className="text-[10px] font-semibold text-foreground/80" title="Referência laboratorial convencional (SBPC/ML)">
                                    {min}–{max}
                                  </div>
                                  {/* Referência funcional (descritiva, secundária) */}
                                  {fMin !== fMax && (
                                    <div
                                      className="text-[9px] text-violet-500/80"
                                      title="Faixa funcional/ótima (medicina integrativa) — apenas informativa"
                                    >
                                      Func: {fMin}–{fMax}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                            {sortedSessions.map((s) => {
                              if (isQualitative) {
                                const textVal = textMap[marker.id]?.[s.id];
                                return (
                                  <td key={s.id} className="px-2 py-1.5 text-center">
                                    {textVal ? (
                                      <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold max-w-[120px] truncate" title={textVal}>
                                        {textVal}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground/40">—</span>
                                    )}
                                  </td>
                                );
                              }
                              const val = resultMap[marker.id]?.[s.id];
                              if (val === undefined) {
                                return (
                                  <td key={s.id} className="px-2 py-1.5 text-center text-[10px] text-muted-foreground/40">
                                    —
                                  </td>
                                );
                              }
                              const status = getStatusWithOperator(val, marker, s.id);
                              const textVal = textMap[marker.id]?.[s.id];
                              const displayVal = textVal || val.toString();
                              return (
                                <td key={s.id} className="px-2 py-1.5 text-center">
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                                      status === "normal" && "bg-emerald-50 text-emerald-700",
                                      status === "low" && "bg-red-50 text-red-700",
                                      status === "high" && "bg-red-50 text-red-800",
                                    )}
                                  >
                                    {status === "low" && "↓ "}
                                    {status === "high" && "↑ "}
                                    {displayVal}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      )}
    </div>
  );
}
