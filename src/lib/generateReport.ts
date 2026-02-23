import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  MARKERS,
  getMarkersByCategory,
  getMarkerStatus,
  type Category,
  type MarkerDef,
} from "@/lib/markers";

interface Session {
  id: string;
  session_date: string;
}

interface Result {
  marker_id: string;
  session_id: string;
  value: number;
}

// Generate a tiny sparkline as a SVG data URL drawn on the PDF canvas
function drawSparkline(
  doc: jsPDF,
  values: number[],
  refMin: number,
  refMax: number,
  x: number,
  y: number,
  w: number,
  h: number
) {
  if (values.length < 2) return;

  const allVals = [...values, refMin, refMax];
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;

  const toY = (v: number) => y + h - ((v - min) / range) * h;
  const toX = (i: number) => x + (i / (values.length - 1)) * w;

  // Reference range band
  doc.setFillColor(220, 240, 220);
  const bandTop = toY(refMax);
  const bandBottom = toY(refMin);
  doc.rect(x, bandTop, w, bandBottom - bandTop, "F");

  // Line
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.3);
  for (let i = 1; i < values.length; i++) {
    doc.line(toX(i - 1), toY(values[i - 1]), toX(i), toY(values[i]));
  }

  // Dots
  values.forEach((v, i) => {
    const status =
      v < refMin ? "low" : v > refMax ? "high" : "normal";
    if (status === "normal") doc.setFillColor(34, 160, 90);
    else if (status === "low") doc.setFillColor(59, 130, 246);
    else doc.setFillColor(220, 50, 50);
    doc.circle(toX(i), toY(v), 0.8, "F");
  });
}

function getTrend(values: number[]): "up" | "down" | "stable" | null {
  if (values.length < 2) return null;
  const last = values[values.length - 1];
  const prev = values[values.length - 2];
  const pctChange = ((last - prev) / (prev || 1)) * 100;
  if (pctChange > 5) return "up";
  if (pctChange < -5) return "down";
  return "stable";
}

function trendSymbol(trend: "up" | "down" | "stable" | null): string {
  if (trend === "up") return "↑";
  if (trend === "down") return "↓";
  if (trend === "stable") return "→";
  return "";
}

export function generatePatientReport(
  patientName: string,
  sex: "M" | "F",
  sessions: Session[],
  results: Result[]
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Sort sessions oldest → newest
  const sorted = [...sessions].sort((a, b) =>
    a.session_date.localeCompare(b.session_date)
  );

  // Build result map
  const resultMap: Record<string, Record<string, number>> = {};
  results.forEach((r) => {
    if (!resultMap[r.marker_id]) resultMap[r.marker_id] = {};
    resultMap[r.marker_id][r.session_id] = r.value;
  });

  // ── Header ──
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de Evolução Laboratorial", 14, 16);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(`Paciente: ${patientName}  |  Sexo: ${sex === "M" ? "Masculino" : "Feminino"}`, 14, 23);
  doc.text(
    `Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    14,
    28
  );
  doc.text(
    `Período: ${sorted.length > 0 ? format(parseISO(sorted[0].session_date), "dd/MM/yyyy") : "—"} a ${sorted.length > 0 ? format(parseISO(sorted[sorted.length - 1].session_date), "dd/MM/yyyy") : "—"}`,
    14,
    33
  );
  doc.setTextColor(0);

  // Divider
  doc.setDrawColor(200);
  doc.line(14, 36, pageW - 14, 36);

  let startY = 40;

  // ── Iterate categories ──
  CATEGORIES.forEach((cat) => {
    const markers = getMarkersByCategory(cat);
    // Only show markers that have data
    const markersWithData = markers.filter(
      (m) => resultMap[m.id] && Object.keys(resultMap[m.id]).length > 0
    );
    if (markersWithData.length === 0) return;

    // Check if we need a new page
    if (startY > pageH - 30) {
      doc.addPage();
      startY = 16;
    }

    // Category header
    const [h, s, l] = CATEGORY_COLORS[cat].split(" ").map((v) => parseInt(v));
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(`● ${cat}`, 14, startY);
    startY += 2;

    // Build table data
    const sessionDateHeaders = sorted.map((s) =>
      format(parseISO(s.session_date), "dd/MM/yy")
    );

    const head = [
      ["Marcador", "Un.", "Ref.", ...sessionDateHeaders, "Trend", "Spark"],
    ];

    const body: any[][] = [];
    const sparklineData: {
      marker: MarkerDef;
      values: number[];
      rowIndex: number;
    }[] = [];

    markersWithData.forEach((marker, idx) => {
      const [min, max] = marker.refRange[sex];
      const values = sorted.map((s) => resultMap[marker.id]?.[s.id]);
      const numericValues = values.filter((v) => v !== undefined) as number[];
      const trend = getTrend(numericValues);

      const row: any[] = [
        marker.name,
        marker.unit,
        `${min}–${max}`,
        ...values.map((v) => (v !== undefined ? String(v) : "—")),
        trendSymbol(trend),
        "", // placeholder for sparkline
      ];

      body.push(row);
      if (numericValues.length >= 2) {
        sparklineData.push({ marker, values: numericValues, rowIndex: idx });
      }
    });

    const sparkColIdx = head[0].length - 1;
    const trendColIdx = head[0].length - 2;

    autoTable(doc, {
      startY,
      head,
      body,
      margin: { left: 14, right: 14 },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: [60, 60, 70],
        textColor: 255,
        fontSize: 7,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: "bold" },
        1: { cellWidth: 18 },
        2: { cellWidth: 18 },
        [trendColIdx]: { cellWidth: 10, halign: "center" },
        [sparkColIdx]: { cellWidth: 28 },
      },
      didParseCell(data) {
        // Color code values
        if (data.section === "body" && data.column.index >= 3 && data.column.index < trendColIdx) {
          const val = parseFloat(data.cell.raw as string);
          if (!isNaN(val)) {
            const marker = markersWithData[data.row.index];
            if (marker) {
              const status = getMarkerStatus(val, marker, sex);
              if (status === "normal") {
                data.cell.styles.textColor = [22, 120, 60];
                data.cell.styles.fontStyle = "bold";
              } else if (status === "low") {
                data.cell.styles.textColor = [37, 99, 235];
                data.cell.styles.fontStyle = "bold";
              } else if (status === "high") {
                data.cell.styles.textColor = [200, 30, 30];
                data.cell.styles.fontStyle = "bold";
              }
            }
          }
        }
        // Color trend arrows
        if (data.section === "body" && data.column.index === trendColIdx) {
          const sym = data.cell.raw as string;
          if (sym === "↑") data.cell.styles.textColor = [200, 30, 30];
          else if (sym === "↓") data.cell.styles.textColor = [37, 99, 235];
          else if (sym === "→") data.cell.styles.textColor = [100, 100, 100];
        }
      },
      didDrawCell(data) {
        // Draw sparklines in the last column
        if (data.section === "body" && data.column.index === sparkColIdx) {
          const sparkData = sparklineData.find(
            (s) => s.rowIndex === data.row.index
          );
          if (sparkData) {
            const [min, max] = sparkData.marker.refRange[sex];
            drawSparkline(
              doc,
              sparkData.values,
              min,
              max,
              data.cell.x + 1,
              data.cell.y + 1,
              data.cell.width - 2,
              data.cell.height - 2
            );
          }
        }
      },
    });

    startY = (doc as any).lastAutoTable.finalY + 6;
  });

  // ── Summary footer on last page ──
  if (startY > pageH - 25) {
    doc.addPage();
    startY = 16;
  }

  doc.setDrawColor(200);
  doc.line(14, startY, pageW - 14, startY);
  startY += 5;

  // Count alerts
  let alertCount = 0;
  const latestSession = sorted[sorted.length - 1];
  if (latestSession) {
    MARKERS.forEach((m) => {
      const val = resultMap[m.id]?.[latestSession.id];
      if (val !== undefined && getMarkerStatus(val, m, sex) !== "normal") {
        alertCount++;
      }
    });
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo:", 14, startY);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${sorted.length} sessões  |  ${results.length} resultados  |  ${alertCount} marcador(es) fora da faixa funcional na última sessão`,
    40,
    startY
  );

  startY += 5;
  doc.setFontSize(7);
  doc.setTextColor(130);
  doc.text("Legenda: Verde = dentro da faixa funcional  |  Azul = abaixo  |  Vermelho = acima  |  Faixa verde no sparkline = faixa de referência", 14, startY);
  doc.text("↑ subindo  |  ↓ descendo  |  → estável (variação < 5%)", 14, startY + 4);

  // Page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${totalPages}`, pageW - 30, pageH - 6);
    doc.text("LabTrack", 14, pageH - 6);
  }

  doc.save(`Relatorio_${patientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
}
