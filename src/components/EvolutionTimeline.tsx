/**
 * EvolutionTimeline — Aba de evolução temporal.
 * Renderiza dados de lab_results + lab_historical_results unidos via buildEvolutionReport.
 * Linhas = analitos, Colunas = datas, Última coluna = referência.
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Clock, FileDown, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CATEGORY_COLORS, MARKERS } from "@/lib/markers";
import { CATEGORIES, type Category } from "@/lib/categoryConfig";
import {
  buildEvolutionReport,
  type EvolutionReportData,
  type EvolutionCellValue,
} from "@/lib/evolutionReportBuilder";
import { generateEvolutionPdf } from "@/lib/generateEvolutionPdf";
import { generateEvolutionExcel } from "@/lib/generateEvolutionExcel";
interface EvolutionTimelineProps {
  patientId: string;
  patientName?: string;
}

export default function EvolutionTimeline({ patientId, patientName }: EvolutionTimelineProps) {
  const [data, setData] = useState<EvolutionReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<Category | "Todos">("Todos");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    buildEvolutionReport(patientId).then((report) => {
      if (!cancelled) {
        setData(report);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [patientId]);

  const filteredSections = useMemo(() => {
    if (!data) return [];
    if (activeCategory === "Todos") return data.sections;
    return data.sections.filter((s) => s.category === activeCategory);
  }, [data, activeCategory]);

  // Categories that have data
  const activeCats = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(data.sections.map((s) => s.category));
  }, [data]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || data.dates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">Sem dados para evolução temporal</p>
          <p className="text-sm text-muted-foreground">
            Importe exames com laudo evolutivo ou adicione mais sessões.
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatCell = (cell: EvolutionCellValue | undefined) => {
    if (!cell) return <span className="text-muted-foreground/40">—</span>;
    const display = cell.text_value || (cell.value !== null ? String(cell.value) : "—");
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className={cn(
          "text-xs tabular-nums",
          cell.source === "historical" && !cell.flag && "text-muted-foreground",
          (cell.flag === "high" || cell.flag === "low") && "text-destructive font-semibold"
        )}>
          {display}
        </span>
        {cell.source === "historical" && (
          <span className="text-[8px] text-muted-foreground/60" title={cell.source_lab || "histórico"}>
            hist
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Category filter */}
      <ScrollArea className="w-full">
        <div className="flex gap-1 pb-2">
          <Button
            variant={activeCategory === "Todos" ? "default" : "outline"}
            size="sm"
            className="shrink-0 rounded-full text-xs"
            onClick={() => setActiveCategory("Todos")}
          >
            Todos
          </Button>
          {CATEGORIES.filter((c) => activeCats.has(c)).map((cat) => (
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

      {/* Summary + Download */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            {data.dates.length} datas
          </Badge>
          <Badge variant="outline">
            {data.sections.reduce((acc, s) => acc + s.markers.length, 0)} analitos
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => generateEvolutionPdf({ data, patientName: patientName || "Paciente" })}
          >
            <FileDown className="h-3.5 w-3.5" />
            PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => generateEvolutionExcel({ data, patientName: patientName || "Paciente" })}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Excel
          </Button>
        </div>
      </div>

      {/* Timeline table */}
      <Card className="max-h-[70vh] overflow-auto">
        <ScrollArea className="w-full">
          <div className="min-w-[600px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="sticky left-0 z-10 min-w-[160px] bg-muted/30 px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                    Analito
                  </th>
                  {data.dates.map((d) => (
                    <th
                      key={d}
                      className="min-w-[75px] px-1 py-2 text-center text-xs font-medium text-muted-foreground"
                    >
                      {format(parseISO(d), "dd/MM/yy")}
                    </th>
                  ))}
                  <th className="min-w-[90px] px-2 py-2 text-center text-xs font-medium text-muted-foreground">
                    Ref.
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSections.map((section) => (
                  <>
                    {/* Category header */}
                    <tr key={`cat-${section.category}`}>
                      <td colSpan={data.dates.length + 2} className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: `hsl(${CATEGORY_COLORS[section.category] || "220 10% 50%"})` }}
                          />
                          <span
                            className="text-xs font-semibold"
                            style={{ color: `hsl(${CATEGORY_COLORS[section.category] || "220 10% 50%"})` }}
                          >
                            {section.category}
                          </span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                      </td>
                    </tr>
                    {/* Marker rows */}
                    {section.markers.map((marker) => (
                      <tr
                        key={marker.marker_id}
                        className="border-b last:border-0 hover:bg-muted/20 transition-colors"
                      >
                        <td className="sticky left-0 z-10 bg-card px-3 py-1.5">
                          <div className="text-xs font-medium">
                            {marker.unit && !marker.marker_name.includes(`(${marker.unit})`)
                              ? `${marker.marker_name} (${marker.unit})`
                              : marker.marker_name}
                          </div>
                        </td>
                        {data.dates.map((d) => (
                          <td key={d} className="px-1 py-1.5 text-center">
                            {formatCell(marker.values_by_date[d])}
                          </td>
                        ))}
                        <td className="px-2 py-1.5 text-center text-[10px] text-muted-foreground max-w-[120px] truncate">
                          {marker.reference_text || "—"}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </Card>
    </div>
  );
}
