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
  parseOperatorValue,
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
  text_value?: string;
}

/* ─── Color palette ─── */
const BRAND = { r: 34, g: 60, b: 90 };        // Deep navy
const BRAND_LIGHT = { r: 45, g: 80, b: 120 };  // Lighter navy
const ACCENT = { r: 0, g: 150, b: 136 };        // Teal accent
const GREEN = { r: 22, g: 160, b: 90 };
const BLUE = { r: 37, g: 99, b: 235 };
const RED = { r: 210, g: 45, b: 45 };
const GRAY = { r: 120, g: 130, b: 140 };
const LIGHT_BG = { r: 248, g: 250, b: 252 };

/* ─── Category colors (RGB) mapped from HSL ─── */
function getCategoryRGB(cat: Category): { r: number; g: number; b: number } {
  const map: Record<Category, { r: number; g: number; b: number }> = {
    Hemograma: { r: 55, g: 115, b: 210 },
    Ferro: { r: 204, g: 120, b: 25 },
    Glicemia: { r: 140, g: 70, b: 190 },
    Lipídios: { r: 200, g: 55, b: 100 },
    Tireoide: { r: 30, g: 150, b: 130 },
    Hormônios: { r: 165, g: 75, b: 165 },
    "Eixo GH": { r: 120, g: 80, b: 200 },
    "Eixo Adrenal": { r: 190, g: 110, b: 40 },
    Andrógenos: { r: 170, g: 60, b: 140 },
    Vitaminas: { r: 190, g: 160, b: 20 },
    Minerais: { r: 40, g: 140, b: 170 },
    Hepático: { r: 55, g: 140, b: 70 },
    Renal: { r: 65, g: 130, b: 190 },
    Eletrólitos: { r: 210, g: 80, b: 60 },
    Coagulação: { r: 190, g: 50, b: 50 },
    Pancreático: { r: 160, g: 140, b: 30 },
    Imunologia: { r: 110, g: 80, b: 190 },
    Sorologia: { r: 130, g: 90, b: 180 },
    Proteínas: { r: 40, g: 150, b: 140 },
    "Marcadores Tumorais": { r: 180, g: 50, b: 80 },
    Toxicologia: { r: 200, g: 100, b: 30 },
    Urina: { r: 140, g: 160, b: 40 },
    Fezes: { r: 170, g: 130, b: 50 },
  };
  return map[cat] || BRAND;
}

/* ─── Sparkline drawing ─── */
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
  doc.setFillColor(220, 245, 225);
  const bandTop = toY(refMax);
  const bandBottom = toY(refMin);
  doc.roundedRect(x, bandTop, w, Math.max(bandBottom - bandTop, 0.5), 0.5, 0.5, "F");

  // Line with smooth appearance
  doc.setDrawColor(60, 70, 85);
  doc.setLineWidth(0.4);
  for (let i = 1; i < values.length; i++) {
    doc.line(toX(i - 1), toY(values[i - 1]), toX(i), toY(values[i]));
  }

  // Dots
  values.forEach((v, i) => {
    const status = v < refMin ? "low" : v > refMax ? "high" : "normal";
    if (status === "normal") doc.setFillColor(GREEN.r, GREEN.g, GREEN.b);
    else if (status === "low") doc.setFillColor(RED.r, RED.g, RED.b);
    else doc.setFillColor(RED.r, RED.g, RED.b);
    doc.circle(toX(i), toY(v), 0.9, "F");
  });
}

/* ─── Trend helpers ─── */
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
  if (trend === "up") return "▲";
  if (trend === "down") return "▼";
  if (trend === "stable") return "●";
  return "";
}

/* ─── Status dot (small colored circle) ─── */
function drawStatusDot(doc: jsPDF, x: number, y: number, status: "normal" | "low" | "high") {
  if (status === "normal") doc.setFillColor(GREEN.r, GREEN.g, GREEN.b);
  else if (status === "low") doc.setFillColor(RED.r, RED.g, RED.b);
  else doc.setFillColor(RED.r, RED.g, RED.b);
  doc.circle(x, y, 1, "F");
}

/* ─── Draw rounded pill background ─── */
function drawPill(doc: jsPDF, x: number, y: number, w: number, h: number, color: { r: number; g: number; b: number }) {
  doc.setFillColor(color.r, color.g, color.b);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
}

/* ─── Header ─── */
function drawHeader(doc: jsPDF, pageW: number, patientName: string, sex: "M" | "F", period: string) {
  // Top brand bar
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, pageW, 28, "F");

  // Accent stripe
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(0, 28, pageW, 1.5, "F");

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Relatório de Evolução Laboratorial", 14, 13);

  // Subtitle info
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(200, 215, 230);
  doc.text(`Paciente: ${patientName}   •   Sexo: ${sex === "M" ? "Masculino" : "Feminino"}   •   ${period}`, 14, 21);

  // Generated date on right
  doc.setFontSize(7);
  doc.setTextColor(160, 180, 200);
  const dateStr = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  doc.text(`Gerado em: ${dateStr}`, pageW - 14, 21, { align: "right" });

  // Logo text (right side)
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.text("LabTrack", pageW - 14, 13, { align: "right" });
}

/* ─── Footer ─── */
function drawFooter(doc: jsPDF, pageW: number, pageH: number, pageNum: number, totalPages: number) {
  // Subtle line
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.3);
  doc.line(14, pageH - 12, pageW - 14, pageH - 12);

  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
  doc.text("LabTrack — Relatório de Evolução Laboratorial", 14, pageH - 7);
  doc.text(`Página ${pageNum} de ${totalPages}`, pageW - 14, pageH - 7, { align: "right" });
}

/* ─── Category header ─── */
function drawCategoryHeader(doc: jsPDF, cat: Category, y: number, pageW: number): number {
  const color = getCategoryRGB(cat);

  // Colored pill/badge
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  const textWidth = doc.getTextWidth(cat);
  const pillW = textWidth + 10;
  const pillH = 6;

  drawPill(doc, 14, y - 4, pillW, pillH, color);
  doc.setTextColor(255, 255, 255);
  doc.text(cat, 14 + 5, y);

  // Thin line across
  doc.setDrawColor(color.r, color.g, color.b);
  doc.setLineWidth(0.2);
  doc.line(14 + pillW + 3, y - 1, pageW - 14, y - 1);

  return y + 4;
}

/* ─── Legend ─── */
function drawLegend(doc: jsPDF, x: number, y: number) {
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("LEGENDA", x, y);
  y += 5;

  doc.setFont("helvetica", "normal");

  // Green dot + text
  doc.setFillColor(GREEN.r, GREEN.g, GREEN.b);
  doc.circle(x + 2, y - 1, 1.2, "F");
  doc.setTextColor(60, 60, 60);
  doc.text("Dentro da faixa funcional", x + 5, y);

  // Red dot + text (below range)
  doc.setFillColor(RED.r, RED.g, RED.b);
  doc.circle(x + 55, y - 1, 1.2, "F");
  doc.text("Abaixo da faixa", x + 58, y);

  // Red dot + text
  doc.setFillColor(RED.r, RED.g, RED.b);
  doc.circle(x + 95, y - 1, 1.2, "F");
  doc.text("Acima da faixa", x + 98, y);

  y += 5;
  doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
  doc.text("▲ Subindo (> 5%)    ▼ Descendo (> 5%)    ● Estável    Faixa verde no sparkline = faixa de referência funcional", x, y);

  return y + 3;
}

/* ─── Main export ─── */
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
  const textResultMap: Record<string, Record<string, string>> = {};
  results.forEach((r) => {
    if (!resultMap[r.marker_id]) resultMap[r.marker_id] = {};
    if (!textResultMap[r.marker_id]) textResultMap[r.marker_id] = {};
    resultMap[r.marker_id][r.session_id] = r.value;
    if (r.text_value) textResultMap[r.marker_id][r.session_id] = r.text_value;
  });

  // Period string
  const periodStr = sorted.length > 0
    ? `Período: ${format(parseISO(sorted[0].session_date), "dd/MM/yyyy")} a ${format(parseISO(sorted[sorted.length - 1].session_date), "dd/MM/yyyy")}`
    : "Sem sessões registradas";

  // ── Header (first page) ──
  drawHeader(doc, pageW, patientName, sex, periodStr);

  let startY = 36;

  // ── Iterate categories ──
  CATEGORIES.forEach((cat) => {
    const markers = getMarkersByCategory(cat);
    const markersWithData = markers.filter(
      (m) => {
        const hasNumeric = resultMap[m.id] && Object.keys(resultMap[m.id]).length > 0;
        const hasText = textResultMap[m.id] && Object.keys(textResultMap[m.id]).length > 0;
        return hasNumeric || hasText;
      }
    );
    if (markersWithData.length === 0) return;

    // Check if we need a new page (leave space for category header + at least a few rows)
    if (startY > pageH - 35) {
      doc.addPage();
      startY = 16;
    }

    // Category header
    startY = drawCategoryHeader(doc, cat, startY, pageW);

    // Build table data
    const sessionDateHeaders = sorted.map((s) =>
      format(parseISO(s.session_date), "dd/MM/yy")
    );

    const head = [
      ["Marcador", "Un.", "Ref. Funcional", ...sessionDateHeaders, "Tend.", "Evolução"],
    ];

    const body: any[][] = [];
    const sparklineData: {
      marker: MarkerDef;
      values: number[];
      rowIndex: number;
    }[] = [];

    markersWithData.forEach((marker, idx) => {
      const isQualitative = marker.qualitative === true;
      const [min, max] = marker.refRange[sex];
      const values = sorted.map((s) => resultMap[marker.id]?.[s.id]);
      const textValues = sorted.map((s) => textResultMap[marker.id]?.[s.id]);
      const numericValues = values.filter((v) => v !== undefined) as number[];
      const trend = isQualitative ? null : getTrend(numericValues);

      const row: any[] = [
        marker.name,
        isQualitative ? "—" : marker.unit,
        isQualitative ? "Qualitativo" : `${min} – ${max}`,
        ...sorted.map((s, i) => {
          if (isQualitative) {
            return textValues[i] || "—";
          }
          // Show operator text_value (e.g. "< 34") if available, otherwise raw number
          if (textValues[i] && parseOperatorValue(textValues[i])) {
            return textValues[i];
          }
          return values[i] !== undefined ? String(values[i]) : "—";
        }),
        isQualitative ? "" : trendSymbol(trend),
        "", // placeholder for sparkline
      ];

      body.push(row);
      if (!isQualitative && numericValues.length >= 2) {
        sparklineData.push({ marker, values: numericValues, rowIndex: idx });
      }
    });

    const sparkColIdx = head[0].length - 1;
    const trendColIdx = head[0].length - 2;
    const catColor = getCategoryRGB(cat);

    autoTable(doc, {
      startY,
      head,
      body,
      margin: { left: 14, right: 14 },
      styles: {
        fontSize: 7.5,
        cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
        overflow: "linebreak",
        lineColor: [230, 235, 240],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [catColor.r, catColor.g, catColor.b],
        textColor: 255,
        fontSize: 7,
        fontStyle: "bold",
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
      },
      alternateRowStyles: {
        fillColor: [LIGHT_BG.r, LIGHT_BG.g, LIGHT_BG.b],
      },
      columnStyles: {
        0: { cellWidth: 32, fontStyle: "bold", textColor: [BRAND.r, BRAND.g, BRAND.b] },
        1: { cellWidth: 14, textColor: [GRAY.r, GRAY.g, GRAY.b] },
        2: { cellWidth: 18, textColor: [GRAY.r, GRAY.g, GRAY.b], fontStyle: "italic" },
        [trendColIdx]: { cellWidth: 8, halign: "center", fontSize: 8 },
        [sparkColIdx]: { cellWidth: 28 },
      },
      didParseCell(data) {
        // Color code result values
        if (data.section === "body" && data.column.index >= 3 && data.column.index < trendColIdx) {
          const rawStr = String(data.cell.raw || "");
          // Check for operator values like "< 34"
          const operatorParsed = parseOperatorValue(rawStr);
          const val = operatorParsed ? operatorParsed.numericValue : parseFloat(rawStr);
            if (!isNaN(val)) {
              const marker = markersWithData[data.row.index];
              if (marker) {
                const status = getMarkerStatus(val, marker, sex, operatorParsed?.operator);
                data.cell.styles.fontStyle = "bold";
                if (status === "normal") {
                  data.cell.styles.textColor = [GREEN.r, GREEN.g, GREEN.b];
                } else {
                  data.cell.styles.textColor = [RED.r, RED.g, RED.b];
                }
              }
          }
        }
        // Color trend symbols
        if (data.section === "body" && data.column.index === trendColIdx) {
          const sym = data.cell.raw as string;
          if (sym === "▲") data.cell.styles.textColor = [RED.r, RED.g, RED.b];
          else if (sym === "▼") data.cell.styles.textColor = [RED.r, RED.g, RED.b];
          else if (sym === "●") data.cell.styles.textColor = [GRAY.r, GRAY.g, GRAY.b];
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
              data.cell.x + 1.5,
              data.cell.y + 1.5,
              data.cell.width - 3,
              data.cell.height - 3
            );
          }
        }
      },
    });

    startY = (doc as any).lastAutoTable.finalY + 8;
  });

  // ── Summary section ──
  if (startY > pageH - 35) {
    doc.addPage();
    startY = 16;
  }

  // Divider
  doc.setDrawColor(200, 210, 220);
  doc.setLineWidth(0.3);
  doc.line(14, startY, pageW - 14, startY);
  startY += 6;

  // Count alerts
  let alertCount = 0;
  let normalCount = 0;
  let qualitativeCount = 0;
  const latestSession = sorted[sorted.length - 1];
  if (latestSession) {
    MARKERS.forEach((m) => {
      if (m.qualitative) {
        const hasText = textResultMap[m.id]?.[latestSession.id];
        if (hasText) qualitativeCount++;
        return;
      }
      const val = resultMap[m.id]?.[latestSession.id];
      if (val !== undefined) {
        if (getMarkerStatus(val, m, sex) !== "normal") alertCount++;
        else normalCount++;
      }
    });
  }

  // Summary card
  doc.setFillColor(LIGHT_BG.r, LIGHT_BG.g, LIGHT_BG.b);
  doc.roundedRect(14, startY - 2, pageW - 28, 16, 2, 2, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.text("RESUMO", 18, startY + 4);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  const summaryParts = [
    `${sorted.length} sessão(ões)`,
    `${results.length} resultados registrados`,
  ];
  if (latestSession) {
    summaryParts.push(`${normalCount} dentro da faixa`);
    summaryParts.push(`${alertCount} fora da faixa`);
    if (qualitativeCount > 0) summaryParts.push(`${qualitativeCount} qualitativos`);
  }
  doc.text(summaryParts.join("   •   "), 42, startY + 4);

  // Alert highlight
  if (alertCount > 0) {
    doc.setFillColor(RED.r, RED.g, RED.b);
    doc.roundedRect(18, startY + 7, 3, 3, 0.5, 0.5, "F");
    doc.setFontSize(7);
    doc.setTextColor(RED.r, RED.g, RED.b);
    doc.text(`${alertCount} marcador(es) requerem atenção`, 23, startY + 10);
  } else if (latestSession) {
    doc.setFillColor(GREEN.r, GREEN.g, GREEN.b);
    doc.roundedRect(18, startY + 7, 3, 3, 0.5, 0.5, "F");
    doc.setFontSize(7);
    doc.setTextColor(GREEN.r, GREEN.g, GREEN.b);
    doc.text("Todos os marcadores dentro da faixa funcional", 23, startY + 10);
  }

  startY += 20;

  // Legend
  if (startY > pageH - 20) {
    doc.addPage();
    startY = 16;
  }
  drawLegend(doc, 14, startY);

  // ── Page numbers & footer ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, pageW, pageH, i, totalPages);
  }

  doc.save(`Relatorio_${patientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
}
