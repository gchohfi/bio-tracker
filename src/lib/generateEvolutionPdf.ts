/**
 * generateEvolutionPdf.ts
 *
 * Gera um PDF evolutivo clínico a partir de EvolutionReportData.
 * Usa jsPDF + jspdf-autotable. Landscape quando > 5 datas.
 * Não faz query — consome a estrutura pronta.
 */

import jsPDF from "jspdf";
import { Trace } from "@/lib/traceability";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCategoryRgb, type Category } from "@/lib/categoryConfig";
import type {
  EvolutionReportData,
  EvolutionCellValue,
} from "@/lib/evolutionReportBuilder";

/* ─── Color palette (matches generateReport.ts) ─── */
const BRAND = { r: 34, g: 60, b: 90 };
const ACCENT = { r: 0, g: 150, b: 136 };
const RED = { r: 210, g: 45, b: 45 };
const GRAY = { r: 120, g: 130, b: 140 };
const LIGHT_BG = { r: 248, g: 250, b: 252 };

/** Sanitize Unicode chars that jsPDF can't render in Latin-1 */
function sanitize(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/[^\x00-\xFF]/g, "");
}

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yy");
  } catch {
    return iso;
  }
}

function cellDisplay(cell: EvolutionCellValue | undefined): string {
  if (!cell) return "-";
  if (cell.text_value) return sanitize(cell.text_value);
  if (cell.value !== null && cell.value !== undefined) return String(cell.value);
  return "-";
}

interface GenerateOptions {
  data: EvolutionReportData;
  patientName: string;
}

export function generateEvolutionPdf({ data, patientName }: GenerateOptions) {
  const numDates = data.dates.length;
  const useLandscape = numDates > 5;
  const orientation = useLandscape ? "landscape" : "portrait";

  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  // ── Header ──
  const drawHeader = () => {
    doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
    doc.rect(0, 0, pageW, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Relatorio Evolutivo de Exames", margin, 12);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(sanitize(patientName), margin, 19);

    const periodStart = formatDate(data.dates[0]);
    const periodEnd = formatDate(data.dates[numDates - 1]);
    const emitted = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
    doc.text(
      `Periodo: ${periodStart} - ${periodEnd}  |  Emitido: ${emitted}`,
      margin,
      25
    );
  };

  drawHeader();
  let cursorY = 34;

  // ── Footer on each page ──
  const drawFooter = (pageNum: number, totalPages: number) => {
    doc.setFontSize(7);
    doc.setTextColor(GRAY.r, GRAY.g, GRAY.b);
    doc.text(
      `Pagina ${pageNum} de ${totalPages}`,
      pageW - margin,
      pageH - 6,
      { align: "right" }
    );
    doc.text("Gerado por BioTracker", margin, pageH - 6);
  };

  // ── Build columns ──
  const columns: string[] = ["Analito"];
  data.dates.forEach((d) => columns.push(formatDate(d)));
  columns.push("Ref.");

  // ── Render sections ──
  for (const section of data.sections) {
    const catRgb = getCategoryRgb(section.category as Category);

    // Category header row
    const catRow = [
      {
        content: sanitize(section.category),
        colSpan: columns.length,
        styles: {
          fillColor: [catRgb.r, catRgb.g, catRgb.b] as [number, number, number],
          textColor: [255, 255, 255] as [number, number, number],
          fontStyle: "bold" as const,
          fontSize: 8,
          halign: "left" as const,
        },
      },
    ];

    // Marker rows
    const bodyRows: any[][] = [catRow];

    for (const marker of section.markers) {
      const sanitizedName = sanitize(marker.marker_name);
      const sanitizedUnit = sanitize(marker.unit);
      // Avoid duplicate unit: if name already contains "(unit)", don't append again
      const nameAlreadyHasUnit = sanitizedUnit && sanitizedName.includes(`(${sanitizedUnit})`);
      const nameWithUnit = sanitizedUnit && !nameAlreadyHasUnit
        ? `${sanitizedName} (${sanitizedUnit})`
        : sanitizedName;

      const row: any[] = [nameWithUnit];

      for (const d of data.dates) {
        const cell = marker.values_by_date[d];
        const display = cellDisplay(cell);

        // Flag-based coloring
        const hasFlag = cell?.flag === "high" || cell?.flag === "low";
        row.push({
          content: display,
          styles: hasFlag
            ? { textColor: [RED.r, RED.g, RED.b] as [number, number, number], fontStyle: "bold" as const }
            : {},
        });
      }

      row.push(sanitize(marker.reference_text) || "-");
      bodyRows.push(row);
    }

    // Compute dynamic column widths
    const analyteW = useLandscape ? 45 : 40;
    const refW = useLandscape ? 30 : 25;
    const dateColW = (pageW - 2 * margin - analyteW - refW) / Math.max(numDates, 1);

    const columnStyles: Record<number, any> = {
      0: { cellWidth: analyteW, fontSize: 7, fontStyle: "bold" },
    };
    for (let i = 1; i <= numDates; i++) {
      columnStyles[i] = { cellWidth: dateColW, halign: "center", fontSize: 7 };
    }
    columnStyles[numDates + 1] = {
      cellWidth: refW,
      halign: "center",
      fontSize: 6,
      textColor: [GRAY.r, GRAY.g, GRAY.b],
    };

    autoTable(doc, {
      startY: cursorY,
      head: [columns],
      body: bodyRows,
      theme: "grid",
      margin: { left: margin, right: margin },
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [BRAND.r, BRAND.g, BRAND.b],
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: "bold",
        halign: "center",
      },
      columnStyles,
      showHead: "everyPage",
      didDrawPage: (hookData: any) => {
        // Re-draw header on new pages
        if (hookData.pageNumber > 1) {
          drawHeader();
        }
      },
    });

    cursorY = (doc as any).lastAutoTable.finalY + 4;

    // If close to bottom, add page
    if (cursorY > pageH - 30) {
      doc.addPage();
      drawHeader();
      cursorY = 34;
    }
  }

  // ── Draw footers on all pages ──
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(i, totalPages);
  }

  // ── Download ──
  const safeName = patientName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
  doc.save(`Evolutivo_${safeName}_${format(new Date(), "yyyyMMdd")}.pdf`);
}
