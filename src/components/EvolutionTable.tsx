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
  getMarkerStatusFromRef,
  resolveReference,
  parseOperatorValue,
  formatRefDisplay,
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
  // Fallback: if value is 0/null but text_value contains a parseable number, use that
  const resultMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    results.forEach((r) => {
      if (!map[r.marker_id]) map[r.marker_id] = {};
      let val = r.value ?? 0;
      // If value is 0 and text_value has a numeric value, parse it as fallback
      if (val === 0 && r.text_value) {
        const cleaned = r.text_value.replace(/[.\s]/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
        const parsed = parseFloat(cleaned);
        if (!isNaN(parsed) && parsed > 0) {
          val = parsed;
        }
      }
      map[r.marker_id][r.session_id] = val;
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

  // Build lab reference lookup: labRefMap[markerId] = { text, min, max }
  // AND per-session lookup: labRefBySession[markerId][sessionId] = lab_ref_text
  const { labRefMap, labRefBySession } = useMemo(() => {
    const map: Record<string, { text?: string; min?: number; max?: number }> = {};
    const bySession: Record<string, Record<string, string>> = {};
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
      // Per-session lab_ref_text
      if (refText) {
        if (!bySession[r.marker_id]) bySession[r.marker_id] = {};
        bySession[r.marker_id][r.session_id] = refText;
      }
      if ((refText || refMin !== undefined || refMax !== undefined) && !map[r.marker_id]) {
        map[r.marker_id] = { text: refText, min: refMin, max: refMax };
      }
    });
    return { labRefMap: map, labRefBySession: bySession };
  }, [results, sessions]);

  // Sorted sessions oldest → newest (left to right)
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.session_date.localeCompare(b.session_date)),
    [sessions]
  );

  // Helper to get status using resolveReference (functional vs lab)
  const getStatusWithOperator = (val: number, marker: MarkerDef, sessionId: string): "normal" | "low" | "high" => {
    const labRefText = labRefBySession[marker.id]?.[sessionId];
    const ref = resolveReference(marker, sex, labRefText);
    
    // If we have a text_value with operator, parse it for operator-aware status
    const textVal = textMap[marker.id]?.[sessionId];
    if (textVal && !marker.qualitative) {
      const parsed = parseOperatorValue(textVal);
      if (parsed) {
        return getMarkerStatusFromRef(parsed.numericValue, ref);
      }
    }
    return getMarkerStatusFromRef(val, ref);
  };

  // Client-side dedup: hide qualitative markers when quantitative counterpart exists in same session
  const QUAL_QUANT_PAIRS: [string, string][] = [
    ['urina_hemacias', 'urina_hemacias_quant'],
    ['urina_leucocitos', 'urina_leucocitos_quant'],
  ];
  const hiddenQualMarkers = useMemo(() => {
    const hidden = new Set<string>();
    for (const [qualId, quantId] of QUAL_QUANT_PAIRS) {
      // If both qual and quant have data in any session, hide the qualitative one
      const qualHasData = resultMap[qualId] || textMap[qualId];
      const quantHasData = resultMap[quantId];
      if (qualHasData && quantHasData) {
        // Check if they share at least one session
        const qualSessions = new Set([
          ...Object.keys(resultMap[qualId] || {}),
          ...Object.keys(textMap[qualId] || {}),
        ]);
        const quantSessions = Object.keys(quantHasData);
        if (quantSessions.some(sid => qualSessions.has(sid))) {
          hidden.add(qualId);
        }
      }
    }
    return hidden;
  }, [resultMap, textMap]);

  // Filter markers
  const filteredMarkers = useMemo(() => {
    let markers = activeCategory === "Todos" ? MARKERS : getMarkersByCategory(activeCategory);
    // Remove qualitative markers that are duplicated by their quantitative counterpart
    markers = markers.filter(m => !hiddenQualMarkers.has(m.id));

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
        <Card className="max-h-[70vh] overflow-auto">
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
                        // Referência laboratorial: preferir lab_ref_text do laudo (mais específico)
                        const labRefText = labRefMap[marker.id]?.text;
                        const resolvedRef = resolveReference(marker, sex, labRefText);
                        const min = resolvedRef.min ?? marker.labRange[sex][0];
                        const max = resolvedRef.max ?? marker.labRange[sex][1];
                        const isQualitative = marker.qualitative;
                        const markerPanel = (marker as any).panel as string | undefined;

                        // Check if any value in the latest session is altered
                        const latestSession = sortedSessions[sortedSessions.length - 1];
                        const latestVal = latestSession ? resultMap[marker.id]?.[latestSession.id] : undefined;
                        const latestStatus = latestVal !== undefined && !isQualitative
                          ? getStatusWithOperator(latestVal, marker, latestSession.id)
                          : "normal";
                        const rowHighlight = latestStatus === "low" || latestStatus === "high";

                        return (
                          <tr
                            key={marker.id}
                            className={cn(
                              "border-b last:border-0 transition-colors",
                              rowHighlight
                                ? "bg-destructive/[0.04] hover:bg-destructive/[0.08]"
                                : "hover:bg-muted/20"
                            )}
                          >
                            <td className={cn(
                              "sticky left-0 z-10 px-2 py-1.5",
                              rowHighlight ? "bg-destructive/[0.04]" : "bg-card"
                            )}>
                              <div className="flex items-center gap-1.5">
                                {rowHighlight && (
                                  <span className="flex h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                                )}
                                <span className={cn(
                                  "text-xs font-medium",
                                  rowHighlight && "text-destructive"
                                )}>{marker.name}</span>
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
                            <td className={cn(
                              "px-1 py-1.5 text-[10px]",
                              rowHighlight ? "text-foreground/70" : "text-muted-foreground"
                            )}>
                            {isQualitative ? (
                                labRefText || "—"
                              ) : labRefText && labRefText.includes(" / ") ? (
                                <div className="relative group cursor-help max-w-[120px]">
                                  <div className="text-[10px] font-semibold text-foreground/80 truncate" title={labRefText}>
                                    {formatRefDisplay(resolvedRef, min, max)} *
                                  </div>
                                  <div className="absolute left-0 top-full z-50 hidden group-hover:block bg-popover border rounded-md shadow-lg p-2 min-w-[200px] max-w-[320px] whitespace-pre-wrap text-[10px] text-popover-foreground">
                                    {labRefText.split(" / ").map((phase, i) => (
                                      <div key={i} className="py-0.5">{phase}</div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-0.5 whitespace-nowrap">
                                  <div className="text-[10px] font-semibold text-foreground/80" title="Referência laboratorial convencional (SBPC/ML)">
                                    {formatRefDisplay(resolvedRef, min, max)}
                                  </div>
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
                                <td key={s.id} className={cn(
                                  "px-2 py-1.5 text-center",
                                  status !== "normal" && "bg-destructive/[0.06]"
                                )}>
                                  <span
                                    className={cn(
                                      "inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold",
                                      status === "normal" && "bg-emerald-50 text-emerald-700",
                                      status === "low" && "bg-red-100 text-red-800 ring-1 ring-red-200",
                                      status === "high" && "bg-red-100 text-red-800 ring-1 ring-red-200",
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
