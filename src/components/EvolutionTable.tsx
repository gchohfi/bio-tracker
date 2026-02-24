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
  type Category,
  type MarkerDef,
} from "@/lib/markers";
import type { Tables } from "@/integrations/supabase/types";

type LabSession = Tables<"lab_sessions">;
type LabResult = Tables<"lab_results">;

type StatusFilter = "all" | "with_data" | "alerts";

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
      map[r.marker_id][r.session_id] = r.value;
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

  // Sorted sessions oldest → newest (left to right)
  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => a.session_date.localeCompare(b.session_date)),
    [sessions]
  );

  // Filter markers
  const filteredMarkers = useMemo(() => {
    let markers = activeCategory === "Todos" ? MARKERS : getMarkersByCategory(activeCategory);

    if (statusFilter === "with_data") {
      markers = markers.filter((m) => {
        if (m.qualitative) {
          return textMap[m.id] && Object.keys(textMap[m.id]).length > 0;
        }
        return resultMap[m.id] && Object.keys(resultMap[m.id]).length > 0;
      });
    } else if (statusFilter === "alerts") {
      markers = markers.filter((m) => {
        const vals = resultMap[m.id];
        if (!vals) return false;
        return Object.values(vals).some((v) => getMarkerStatus(v, m, sex) !== "normal");
      });
    }

    return markers;
  }, [activeCategory, statusFilter, resultMap, textMap, sex]);

  // Alert count
  const alertCount = useMemo(() => {
    let count = 0;
    MARKERS.forEach((m) => {
      const vals = resultMap[m.id];
      if (!vals) return;
      // Check only the latest session
      const latestSession = sortedSessions[sortedSessions.length - 1];
      if (latestSession && vals[latestSession.id] !== undefined) {
        if (getMarkerStatus(vals[latestSession.id], m, sex) !== "normal") count++;
      }
    });
    return count;
  }, [resultMap, sortedSessions, sex]);

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
      {/* Alert banner */}
      {alertCount > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm font-medium text-destructive">
                {alertCount} marcador{alertCount > 1 ? "es" : ""} fora da faixa funcional
              </p>
              <p className="text-xs text-muted-foreground">
                Na sessão mais recente
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto text-xs"
              onClick={() => { setActiveCategory("Todos"); setStatusFilter("alerts"); }}
            >
              Ver alertas
            </Button>
          </CardContent>
        </Card>
      )}

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

        <div className="flex gap-1">
          {(
            [
              ["all", "Todos"],
              ["with_data", "Com dados"],
              ["alerts", "Alertas"],
            ] as [StatusFilter, string][]
          ).map(([key, label]) => (
            <Button
              key={key}
              variant={statusFilter === key ? "secondary" : "ghost"}
              size="sm"
              className="text-xs"
              onClick={() => setStatusFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
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
                    <th className="sticky left-0 z-10 min-w-[180px] bg-muted/30 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                      Marcador
                    </th>
                    <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      Ref.
                    </th>
                    {sortedSessions.map((s) => (
                      <th
                        key={s.id}
                        className="min-w-[90px] px-2 py-2 text-center text-xs font-medium text-muted-foreground"
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
                        const [min, max] = marker.refRange[sex];
                        const isQualitative = marker.qualitative;
                        return (
                          <tr
                            key={marker.id}
                            className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                          >
                            <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                              <div className="text-xs font-medium">{marker.name}</div>
                              <div className="text-[10px] text-muted-foreground">
                                {isQualitative ? "qualitativo" : marker.unit}
                              </div>
                            </td>
                            <td className="px-2 py-1.5 text-[10px] text-muted-foreground whitespace-nowrap">
                              {isQualitative ? "—" : `${min}–${max}`}
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
                              const status = getMarkerStatus(val, marker, sex);
                              return (
                                <td key={s.id} className="px-2 py-1.5 text-center">
                                  <span
                                    className={cn(
                                      "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-bold",
                                      status === "normal" && "bg-emerald-50 text-emerald-700",
                                      status === "low" && "bg-red-50 text-red-700",
                                      status === "high" && "bg-red-50 text-red-700"
                                    )}
                                  >
                                    {status === "low" && "↓"}
                                    {status === "high" && "↑"}
                                    {val}
                                    {status === "normal" && " ✓"}
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
