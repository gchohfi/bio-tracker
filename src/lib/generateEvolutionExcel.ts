/**
 * generateEvolutionExcel.ts
 *
 * Gera um Excel (.xlsx) evolutivo clínico a partir de EvolutionReportData.
 * Usa ExcelJS para gerar nativamente no browser.
 * Consome EXATAMENTE a mesma estrutura que o PDF — sem recalcular valores ou flags.
 *
 * Estrutura do workbook:
 *   Aba 1 — Resumo: visão geral do paciente e período
 *   Aba 2 — Evolução: layout visual idêntico ao PDF (categorias, datas em colunas, flags em vermelho)
 *   Aba 3 — Dados: formato analítico (1 linha por exame/data) para filtragem e análise
 */

import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getCategoryRgb, type Category } from "@/lib/categoryConfig";
import type {
  EvolutionReportData,
  EvolutionCellValue,
} from "@/lib/evolutionReportBuilder";
import { matchFunctionalRef, batchMatchFunctionalRefs } from "@/lib/functionalMatcher";

/* ── Color helpers ── */
function rgbToArgb(rgb: { r: number; g: number; b: number }): string {
  return `FF${rgb.r.toString(16).padStart(2, "0")}${rgb.g.toString(16).padStart(2, "0")}${rgb.b.toString(16).padStart(2, "0")}`.toUpperCase();
}

const BRAND_ARGB = "FF223C5A";
const RED_ARGB = "FFD22D2D";
const WHITE_ARGB = "FFFFFFFF";
const LIGHT_BG_ARGB = "FFF8FAFC";
const GRAY_TEXT_ARGB = "FF78828C";
const GREEN_BG_ARGB = "FFE8F5E9";
const GREEN_TEXT_ARGB = "FF2E7D32";
const RED_BG_ARGB = "FFFCE4EC";
const RED_TEXT_ARGB = "FFC62828";

function formatDate(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yy");
  } catch {
    return iso;
  }
}

function formatDateLong(iso: string): string {
  try {
    return format(parseISO(iso), "dd/MM/yyyy");
  } catch {
    return iso;
  }
}

function cellDisplay(cell: EvolutionCellValue | undefined): string {
  if (!cell) return "";
  if (cell.text_value) return cell.text_value;
  if (cell.value !== null && cell.value !== undefined) return String(cell.value);
  return "";
}

function cellNumeric(cell: EvolutionCellValue | undefined): number | null {
  if (!cell) return null;
  return cell.value ?? null;
}

/* ── Shared styles ── */
const headerFont: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: WHITE_ARGB },
  size: 10,
};

const headerFill: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: BRAND_ARGB },
};

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFDCDCDC" } },
  bottom: { style: "thin", color: { argb: "FFDCDCDC" } },
  left: { style: "thin", color: { argb: "FFDCDCDC" } },
  right: { style: "thin", color: { argb: "FFDCDCDC" } },
};

interface GenerateOptions {
  data: EvolutionReportData;
  patientName: string;
  patientSex?: "M" | "F";
}

export async function generateEvolutionExcel({ data, patientName, patientSex }: GenerateOptions) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "BioTracker";
  wb.created = new Date();

  const numDates = data.dates.length;
  const totalMarkers = data.sections.reduce((acc, s) => acc + s.markers.length, 0);
  const sex = patientSex ?? "M";

  // ── Batch functional matching with logs ──
  const allMarkers: Array<{ markerId: string; markerName: string; value: number | null; unit: string }> = [];
  for (const section of data.sections) {
    for (const marker of section.markers) {
      let lastValue: number | null = null;
      for (let di = data.dates.length - 1; di >= 0; di--) {
        const c = marker.values_by_date[data.dates[di]];
        if (c?.value !== null && c?.value !== undefined) {
          lastValue = c.value;
          break;
        }
      }
      allMarkers.push({ markerId: marker.marker_id, markerName: marker.marker_name, value: lastValue, unit: marker.unit });
    }
  }
  // Log matching results to console for debugging
  batchMatchFunctionalRefs(allMarkers, sex, true);

  // ════════════════════════════════════════════════════════════════════════
  // ABA 1 — Resumo
  // ════════════════════════════════════════════════════════════════════════
  const wsResumo = wb.addWorksheet("Resumo", {
    properties: { tabColor: { argb: BRAND_ARGB } },
  });

  wsResumo.columns = [
    { width: 28 },
    { width: 50 },
  ];

  // Title
  const titleRow = wsResumo.addRow(["Relatório Evolutivo de Exames"]);
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: BRAND_ARGB } };
  wsResumo.mergeCells(1, 1, 1, 2);
  wsResumo.addRow([]);

  // Patient info
  const infoRows: [string, string][] = [
    ["Paciente", patientName],
    ["Período", `${formatDateLong(data.dates[0])} — ${formatDateLong(data.dates[numDates - 1])}`],
    ["Total de datas", String(numDates)],
    ["Total de analitos", String(totalMarkers)],
    ["Categorias", String(data.sections.length)],
    ["Emitido em", format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })],
  ];

  for (const [label, val] of infoRows) {
    const row = wsResumo.addRow([label, val]);
    row.getCell(1).font = { bold: true, size: 11, color: { argb: BRAND_ARGB } };
    row.getCell(2).font = { size: 11 };
  }

  wsResumo.addRow([]);
  wsResumo.addRow([]);

  // Category summary table
  const catHeaderRow = wsResumo.addRow(["Categoria", "Nº de Analitos"]);
  catHeaderRow.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  for (const section of data.sections) {
    const catRgb = getCategoryRgb(section.category as Category);
    const row = wsResumo.addRow([section.category, section.markers.length]);
    row.getCell(1).font = { bold: true, color: { argb: rgbToArgb(catRgb) } };
    row.getCell(2).alignment = { horizontal: "center" };
    row.eachCell((cell) => { cell.border = thinBorder; });
  }

  // ════════════════════════════════════════════════════════════════════════
  // ABA 2 — Evolução (visual, idêntica ao PDF)
  // ════════════════════════════════════════════════════════════════════════
  const wsEvo = wb.addWorksheet("Evolução", {
    properties: { tabColor: { argb: "FF00967F" } },
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9, // A4
    },
  });

  // Column widths
  const evoColumns: Partial<ExcelJS.Column>[] = [
    { width: 32, key: "analito" }, // Analyte name
  ];
  for (let i = 0; i < numDates; i++) {
    evoColumns.push({ width: 14, key: `d${i}` });
  }
  evoColumns.push({ width: 18, key: "ref" }); // Reference
  evoColumns.push({ width: 22, key: "ref_func" }); // Ref. Funcional
  evoColumns.push({ width: 14, key: "status_func" }); // Status Funcional
  wsEvo.columns = evoColumns;
  const totalEvoCols = numDates + 4; // analito + dates + ref + ref_func + status_func

  // Title row
  const evoTitle = wsEvo.addRow([
    `Evolução — ${patientName}`,
    ...Array(numDates).fill(""),
    "",
  ]);
  evoTitle.getCell(1).font = { bold: true, size: 14, color: { argb: BRAND_ARGB } };
  wsEvo.mergeCells(1, 1, 1, totalEvoCols);

  // Period row
  const evoPeriod = wsEvo.addRow([
    `Período: ${formatDateLong(data.dates[0])} — ${formatDateLong(data.dates[numDates - 1])}`,
  ]);
  evoPeriod.getCell(1).font = { italic: true, size: 9, color: { argb: GRAY_TEXT_ARGB } };
  wsEvo.mergeCells(2, 1, 2, totalEvoCols);

  // Header row (Analito | dates... | Ref.)
  const headerValues = ["Analito", ...data.dates.map(formatDate), "Ref.", "Ref. Funcional", "Status Funcional"];
  const evoHeaderRow = wsEvo.addRow(headerValues);
  evoHeaderRow.height = 22;
  evoHeaderRow.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });
  evoHeaderRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  // Freeze header
  wsEvo.views = [{ state: "frozen", ySplit: 3, xSplit: 1 }];

  // Auto-filter
  wsEvo.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: 3, column: totalEvoCols },
  };

  // Data rows
  let rowIndex = 4;
  for (const section of data.sections) {
    const catRgb = getCategoryRgb(section.category as Category);
    const catArgb = rgbToArgb(catRgb);

    // Category header row
    const catRow = wsEvo.addRow([section.category]);
    wsEvo.mergeCells(rowIndex, 1, rowIndex, totalEvoCols);
    catRow.getCell(1).font = { bold: true, size: 10, color: { argb: WHITE_ARGB } };
    catRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: catArgb } };
    catRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
    catRow.height = 20;
    rowIndex++;

    for (const marker of section.markers) {
      // Build display name with unit
      const nameHasUnit = marker.unit && marker.marker_name.includes(`(${marker.unit})`);
      const displayName = marker.unit && !nameHasUnit
        ? `${marker.marker_name} (${marker.unit})`
        : marker.marker_name;

      const rowValues: (string | number | null)[] = [displayName];

      for (const d of data.dates) {
        const cell = marker.values_by_date[d];
        const numVal = cellNumeric(cell);
        // Prefer numeric value for Excel (enables formulas/sorting)
        // Fall back to text_value for qualitative markers
        if (numVal !== null && !cell?.text_value) {
          rowValues.push(numVal);
        } else {
          rowValues.push(cellDisplay(cell) || null);
        }
      }
      rowValues.push(marker.reference_text || "—");

      // ── Functional reference (parallel layer via matcher) ──
      // Use last available numeric value for status evaluation
      let lastValue: number | null = null;
      for (let di = data.dates.length - 1; di >= 0; di--) {
        const c = marker.values_by_date[data.dates[di]];
        if (c?.value !== null && c?.value !== undefined) {
          lastValue = c.value;
          break;
        }
      }

      const funcMatch = matchFunctionalRef(marker.marker_id, marker.marker_name, lastValue, sex, marker.unit);
      const funcResult = funcMatch.result;
      rowValues.push(funcResult?.refText ?? "");
      rowValues.push(
        funcResult === null ? ""
        : funcResult.status === "normal" ? "Normal"
        : funcResult.status === "fora" ? "Fora"
        : "—"
      );

      const dataRow = wsEvo.addRow(rowValues);
      dataRow.height = 18;

      // Style analyte name
      dataRow.getCell(1).font = { bold: true, size: 9 };
      dataRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

      // Style date cells
      for (let di = 0; di < numDates; di++) {
        const cell = marker.values_by_date[data.dates[di]];
        const excelCell = dataRow.getCell(di + 2);
        excelCell.alignment = { horizontal: "center", vertical: "middle" };
        excelCell.font = { size: 9 };
        excelCell.border = thinBorder;

        if (cell?.flag === "high" || cell?.flag === "low") {
          excelCell.font = { bold: true, size: 9, color: { argb: RED_TEXT_ARGB } };
          excelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG_ARGB } };
        } else if (cell && cell.value !== null) {
          excelCell.font = { size: 9, color: { argb: GREEN_TEXT_ARGB } };
          excelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG_ARGB } };
        }

        // Add source indicator for historical values
        if (cell?.source === "historical") {
          excelCell.note = `Fonte: ${cell.source_lab || "histórico"}`;
        }
      }

      // Style reference cell
      const refCell = dataRow.getCell(numDates + 2);
      refCell.font = { size: 8, color: { argb: GRAY_TEXT_ARGB } };
      refCell.alignment = { horizontal: "center", vertical: "middle" };
      refCell.border = thinBorder;

      // Style functional reference cell
      const funcRefCell = dataRow.getCell(numDates + 3);
      funcRefCell.font = { size: 8, color: { argb: GRAY_TEXT_ARGB } };
      funcRefCell.alignment = { horizontal: "center", vertical: "middle" };
      funcRefCell.border = thinBorder;

      // Style functional status cell
      const funcStatusCell = dataRow.getCell(numDates + 4);
      funcStatusCell.alignment = { horizontal: "center", vertical: "middle" };
      funcStatusCell.border = thinBorder;
      if (funcResult?.status === "normal") {
        funcStatusCell.font = { bold: true, size: 9, color: { argb: GREEN_TEXT_ARGB } };
        funcStatusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG_ARGB } };
      } else if (funcResult?.status === "fora") {
        funcStatusCell.font = { bold: true, size: 9, color: { argb: RED_TEXT_ARGB } };
        funcStatusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG_ARGB } };
      } else {
        funcStatusCell.font = { size: 8, color: { argb: GRAY_TEXT_ARGB } };
      }

      // Alternate row shading
      if ((rowIndex - 4) % 2 === 0) {
        dataRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT_BG_ARGB } };
      }

      rowIndex++;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // ABA 3 — Dados (formato analítico)
  // ════════════════════════════════════════════════════════════════════════
  const wsDados = wb.addWorksheet("Dados", {
    properties: { tabColor: { argb: "FF1976D2" } },
  });

  wsDados.columns = [
    { header: "Categoria", key: "category", width: 18 },
    { header: "Analito", key: "analyte", width: 28 },
    { header: "Data", key: "date", width: 12 },
    { header: "Valor", key: "value", width: 14 },
    { header: "Texto", key: "text", width: 18 },
    { header: "Unidade", key: "unit", width: 12 },
    { header: "Referência", key: "ref", width: 20 },
    { header: "Status", key: "status", width: 10 },
    { header: "Ref. Funcional", key: "ref_func", width: 22 },
    { header: "Status Funcional", key: "status_func", width: 16 },
    { header: "Fonte", key: "source", width: 12 },
  ];

  // Header style
  const dadosHeader = wsDados.getRow(1);
  dadosHeader.height = 22;
  dadosHeader.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = thinBorder;
  });

  // Freeze + filter
  wsDados.views = [{ state: "frozen", ySplit: 1 }];
  wsDados.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: 11 },
  };

  // Populate data rows
  for (const section of data.sections) {
    for (const marker of section.markers) {
      for (const d of data.dates) {
        const cell = marker.values_by_date[d];
        if (!cell) continue;

        const status = cell.flag === "high" ? "Alto" : cell.flag === "low" ? "Baixo" : "Normal";
        const funcMatch = matchFunctionalRef(marker.marker_id, marker.marker_name, cell.value, sex, marker.unit);
        const funcResult = funcMatch.result;

        const row = wsDados.addRow({
          category: section.category,
          analyte: marker.marker_name,
          date: formatDate(d),
          value: cell.value,
          text: cell.text_value || "",
          unit: marker.unit,
          ref: marker.reference_text || "",
          status,
          ref_func: funcResult?.refText ?? "",
          status_func: funcResult === null ? ""
            : funcResult.status === "normal" ? "Normal"
            : funcResult.status === "fora" ? "Fora"
            : "—",
          source: cell.source === "historical"
            ? (cell.source_lab || "histórico")
            : "atual",
        });

        row.eachCell((c) => {
          c.border = thinBorder;
          c.alignment = { vertical: "middle" };
          c.font = { size: 9 };
        });

        // Color lab status cell
        const statusCell = row.getCell(8);
        if (cell.flag === "high" || cell.flag === "low") {
          statusCell.font = { bold: true, size: 9, color: { argb: RED_TEXT_ARGB } };
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG_ARGB } };
        } else if (cell.value !== null) {
          statusCell.font = { size: 9, color: { argb: GREEN_TEXT_ARGB } };
          statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG_ARGB } };
        }
        statusCell.alignment = { horizontal: "center", vertical: "middle" };

        // Color functional status cell
        const funcStatusCellDados = row.getCell(10);
        if (funcResult?.status === "normal") {
          funcStatusCellDados.font = { bold: true, size: 9, color: { argb: GREEN_TEXT_ARGB } };
          funcStatusCellDados.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG_ARGB } };
        } else if (funcResult?.status === "fora") {
          funcStatusCellDados.font = { bold: true, size: 9, color: { argb: RED_TEXT_ARGB } };
          funcStatusCellDados.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG_ARGB } };
        }
        funcStatusCellDados.alignment = { horizontal: "center", vertical: "middle" };
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // Download
  // ════════════════════════════════════════════════════════════════════════
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const safeName = patientName.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
  saveAs(blob, `Evolutivo_${safeName}_${format(new Date(), "yyyyMMdd")}.xlsx`);
}
