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
  getCategoryRgb,
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
  lab_ref_min?: number | null;
  lab_ref_max?: number | null;
  lab_ref_text?: string | null;
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

/* ─── Category colors (RGB) — derivados automaticamente do categoryConfig.ts ─── */
// getCategoryRGB agora é um alias de getCategoryRgb (importado de markers.ts → categoryConfig.ts).
// Não é mais necessário manter um mapa manual aqui.
const getCategoryRGB = (cat: Category) => getCategoryRgb(cat);

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

/* ─── AI Analysis types ─── */
export interface ProtocolRecommendation {
  protocol_id: string;
  protocol_name: string;
  category: string;
  via: string;
  composition: string;
  justification: string;
  priority: "alta" | "media" | "baixa";
}

export interface AiAnalysis {
  summary: string;
  alerts: string[];
  patterns: string[];
  trends: string[];
  suggestions: string[];
  full_text: string;
  protocol_recommendations?: ProtocolRecommendation[];
}

/* ─── Main export ─── */
export function generatePatientReport(
  patientName: string,
  sex: "M" | "F",
  sessions: Session[],
  results: Result[],
  aiAnalysis?: AiAnalysis
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
  // Lab reference map: most recent reference per marker
  const labRefByMarker: Record<string, { min?: number; max?: number; text?: string }> = {};
  results.forEach((r) => {
    if (!resultMap[r.marker_id]) resultMap[r.marker_id] = {};
    if (!textResultMap[r.marker_id]) textResultMap[r.marker_id] = {};
    resultMap[r.marker_id][r.session_id] = r.value;
    if (r.text_value) textResultMap[r.marker_id][r.session_id] = r.text_value;
    // Capture lab reference (last write wins — results are sorted oldest→newest so newest is kept)
    if (r.lab_ref_text || r.lab_ref_min != null || r.lab_ref_max != null) {
      labRefByMarker[r.marker_id] = {
        text: r.lab_ref_text ?? undefined,
        min: r.lab_ref_min ?? undefined,
        max: r.lab_ref_max ?? undefined,
      };
    }
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
      ["Marcador", "Un.", "Ref. Funcional", "Ref. Lab.", ...sessionDateHeaders, "Tend.", "Evolução"],
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

      const labRef = labRefByMarker[marker.id];
      const labRefStr = isQualitative ? "—" :
        labRef
          ? (labRef.text || `${labRef.min ?? '?'} – ${labRef.max ?? '?'}`)
          : "—";

      const row: any[] = [
        marker.name,
        isQualitative ? "—" : marker.unit,
        isQualitative ? "Qualitativo" : `${min} – ${max}`,
        labRefStr,
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
    // With the new "Ref. Lab." column, data columns start at index 4 (was 3)
    const dataColStart = 4;
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
        0: { cellWidth: 30, fontStyle: "bold", textColor: [BRAND.r, BRAND.g, BRAND.b] },
        1: { cellWidth: 12, textColor: [GRAY.r, GRAY.g, GRAY.b] },
        2: { cellWidth: 16, textColor: [GRAY.r, GRAY.g, GRAY.b], fontStyle: "italic" },
        3: { cellWidth: 16, textColor: [37, 99, 235], fontStyle: "italic", fontSize: 6.5 },
        [trendColIdx]: { cellWidth: 8, halign: "center", fontSize: 8 },
        [sparkColIdx]: { cellWidth: 26 },
      },
      didParseCell(data) {
        // Color code result values (data columns start at index 4 now, after Ref. Lab. column)
        if (data.section === "body" && data.column.index >= dataColStart && data.column.index < trendColIdx) {
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

  // ── AI Analysis section ──
  if (aiAnalysis) {
    doc.addPage();
    let aiY = 16;

    // Section header
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.roundedRect(14, aiY - 4, pageW - 28, 12, 2, 2, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("ANÁLISE CLÍNICA — INTELIGÊNCIA ARTIFICIAL", 20, aiY + 3);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(180, 200, 220);
    doc.text("Gerada por GPT-4.1 • Uso exclusivo para profissionais de saúde • Não substitui avaliação clínica", pageW - 16, aiY + 3, { align: "right" });
    aiY += 14;

    // Summary
    if (aiAnalysis.summary) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
      doc.text("VISÃO GERAL", 14, aiY);
      aiY += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(40, 40, 40);
      doc.setFontSize(8);
      const summaryLines = doc.splitTextToSize(aiAnalysis.summary, pageW - 28);
      doc.text(summaryLines, 14, aiY);
      aiY += summaryLines.length * 4.5 + 4;
    }

    // Patterns
    if (aiAnalysis.patterns && aiAnalysis.patterns.length > 0) {
      if (aiY > pageH - 40) { doc.addPage(); aiY = 16; }
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
      doc.text("PADRÕES CLÍNICOS IDENTIFICADOS", 14, aiY);
      aiY += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      for (const pattern of aiAnalysis.patterns) {
        const lines = doc.splitTextToSize(`• ${pattern}`, pageW - 28);
        doc.text(lines, 14, aiY);
        aiY += lines.length * 4.5;
      }
      aiY += 5;
    }

    // Trends
    if (aiAnalysis.trends && aiAnalysis.trends.length > 0) {
      if (aiY > pageH - 40) { doc.addPage(); aiY = 16; }
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(ACCENT.r, ACCENT.g, ACCENT.b);
      doc.text("TENDÊNCIAS ENTRE SESSÕES", 14, aiY);
      aiY += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      for (const trend of aiAnalysis.trends) {
        const lines = doc.splitTextToSize(`• ${trend}`, pageW - 28);
        doc.text(lines, 14, aiY);
        aiY += lines.length * 4.5;
      }
      aiY += 5;
    }

    // Suggestions
    if (aiAnalysis.suggestions && aiAnalysis.suggestions.length > 0) {
      if (aiY > pageH - 40) { doc.addPage(); aiY = 16; }
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BLUE.r, BLUE.g, BLUE.b);
      doc.text("SUGESTÕES DE INVESTIGAÇÃO", 14, aiY);
      aiY += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      for (const suggestion of aiAnalysis.suggestions) {
        const lines = doc.splitTextToSize(`• ${suggestion}`, pageW - 28);
        doc.text(lines, 14, aiY);
        aiY += lines.length * 4.5;
      }
      aiY += 5;
    }

    // Full narrative text
    if (aiAnalysis.full_text) {
      if (aiY > pageH - 50) { doc.addPage(); aiY = 16; }
      doc.setDrawColor(200, 210, 220);
      doc.setLineWidth(0.3);
      doc.line(14, aiY, pageW - 14, aiY);
      aiY += 6;
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
      doc.text("ANÁLISE NARRATIVA COMPLETA", 14, aiY);
      aiY += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);
      const fullLines = doc.splitTextToSize(aiAnalysis.full_text, pageW - 28);
      // Handle page breaks within full text
      for (const line of fullLines) {
        if (aiY > pageH - 20) {
          doc.addPage();
          aiY = 16;
        }
        doc.text(line, 14, aiY);
        aiY += 4.5;
      }
    }

    // ── Protocol Recommendations ──
    if (aiAnalysis.protocol_recommendations && aiAnalysis.protocol_recommendations.length > 0) {
      doc.addPage();
      aiY = 16;

      // Section header
      const GOLD = { r: 180, g: 140, b: 50 };
      doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
      doc.roundedRect(14, aiY - 4, pageW - 28, 12, 2, 2, "F");
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("PROTOCOLOS ESSENTIA PHARMA SUGERIDOS", 20, aiY + 3);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(180, 200, 220);
      doc.text("Baseado nos marcadores alterados • Avaliação clínica obrigatória antes da prescrição", pageW - 16, aiY + 3, { align: "right" });
      aiY += 18;

      const priorityColors: Record<string, { r: number; g: number; b: number }> = {
        alta: { r: 210, g: 45, b: 45 },
        media: { r: 220, g: 140, b: 30 },
        baixa: { r: 22, g: 160, b: 90 },
      };
      const priorityLabels: Record<string, string> = {
        alta: "PRIORIDADE ALTA",
        media: "PRIORIDADE MÉDIA",
        baixa: "PRIORIDADE BAIXA",
      };

      for (const proto of aiAnalysis.protocol_recommendations) {
        if (aiY > pageH - 50) { doc.addPage(); aiY = 16; }

        // Protocol card background
        doc.setFillColor(248, 250, 252);
        const cardH = 32;
        doc.roundedRect(14, aiY, pageW - 28, cardH, 2, 2, "F");

        // Left accent bar by priority
        const pColor = priorityColors[proto.priority] ?? { r: 100, g: 100, b: 100 };
        doc.setFillColor(pColor.r, pColor.g, pColor.b);
        doc.roundedRect(14, aiY, 3, cardH, 1, 1, "F");

        // Protocol ID badge
        doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
        doc.roundedRect(20, aiY + 3, 18, 6, 1, 1, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(proto.protocol_id, 29, aiY + 7.5, { align: "center" });

        // Protocol name
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
        doc.text(proto.protocol_name, 42, aiY + 7.5);

        // Via badge
        const viaColor = proto.via === "Endovenoso" ? ACCENT : { r: 100, g: 80, b: 160 };
        doc.setFillColor(viaColor.r, viaColor.g, viaColor.b);
        const viaText = proto.via === "Endovenoso" ? "EV" : "IM";
        doc.roundedRect(pageW - 40, aiY + 3, 12, 6, 1, 1, "F");
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(viaText, pageW - 34, aiY + 7.5, { align: "center" });

        // Priority badge
        doc.setFillColor(pColor.r, pColor.g, pColor.b);
        doc.roundedRect(pageW - 26, aiY + 3, 24, 6, 1, 1, "F");
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(priorityLabels[proto.priority] ?? proto.priority.toUpperCase(), pageW - 14, aiY + 7.5, { align: "right" });

        // Justification
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(60, 60, 60);
        const justLines = doc.splitTextToSize(`“${proto.justification}”`, pageW - 60);
        doc.text(justLines, 20, aiY + 15);

        // Composition
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
        const compLines = doc.splitTextToSize(`Composição: ${proto.composition}`, pageW - 36);
        doc.text(compLines, 20, aiY + 15 + justLines.length * 4 + 2);

        aiY += cardH + 5;
      }

      // Essentia contact note
      if (aiY < pageH - 30) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
        doc.text("Protocolos Essentia Pharma • consultoriainjetaveis@essentia.com.br • (48) 9 8859.0356 • essentia.com.br", pageW / 2, aiY, { align: "center" });
      }
    }

    // Disclaimer box at bottom
    const disclaimerY = pageH - 22;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, disclaimerY, pageW - 28, 10, 1.5, 1.5, "F");
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    doc.text(
      "Esta análise foi gerada por inteligência artificial (GPT-4.1) com base nos dados inseridos no sistema LabTrack. Não constitui diagnóstico médico, prescrição ou laudo clínico. "
      + "Deve ser interpretada exclusivamente por profissional de saúde habilitado, em conjunto com a avaliação clínica completa do paciente.",
      pageW / 2,
      disclaimerY + 4,
      { align: "center", maxWidth: pageW - 36 }
    );
  }

  // ── Page numbers & footer ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, pageW, pageH, i, totalPages);
  }
  doc.save(`Relatorio_${patientName.replace(/\s+/g, "_")}_${format(new Date(), "yyyyMMdd")}.pdf`);
}
