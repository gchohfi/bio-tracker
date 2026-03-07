/**
 * generatePrescriptionPdf.ts
 *
 * Gera PDF profissional da prescrição final de uma consulta.
 * Fonte de verdade: clinical_prescriptions.prescription_json
 * Inclui: accepted_by_physician, edited_by_physician, manually_added
 * Exclui: removed_by_physician, suggested_by_ai (não revisado)
 */

import jsPDF from "jspdf";
import "jspdf-autotable";
import type { PrescriptionItem, ItemOrigin } from "@/components/EncounterPrescriptionEditor";

// ── Sanitize for Latin-1 (jsPDF limitation) ──

function sanitize(text: string): string {
  if (!text) return "";
  return text
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u2022/g, "-")
    .replace(/[^\x00-\xFF]/g, "");
}

// ── Origin filter: only final items ──

const INCLUDED_ORIGINS: ItemOrigin[] = [
  "accepted_by_physician",
  "edited_by_physician",
  "manually_added",
];

function filterFinalItems(items: PrescriptionItem[]): PrescriptionItem[] {
  return items.filter((item) => INCLUDED_ORIGINS.includes(item.origin));
}

// ── Origin label for traceability ──

function originLabel(origin: ItemOrigin): string {
  switch (origin) {
    case "accepted_by_physician": return "IA (aceito)";
    case "edited_by_physician": return "IA (editado)";
    case "manually_added": return "Manual";
    default: return "";
  }
}

// ── Public API ──

export interface PrescriptionPdfParams {
  items: PrescriptionItem[];
  patientName: string;
  encounterDate: string; // formatted string e.g. "15/03/2026"
  specialtyName: string;
  practitionerName: string;
}

export function generatePrescriptionPdf(params: PrescriptionPdfParams): void {
  const { items, patientName, encounterDate, specialtyName, practitionerName } = params;

  const finalItems = filterFinalItems(items);

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Header ──
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(sanitize("Prescricao Medica"), margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(sanitize(`Paciente: ${patientName}`), margin, y);
  y += 5;
  doc.text(sanitize(`Data da consulta: ${encounterDate}`), margin, y);
  y += 5;
  doc.text(sanitize(`Especialidade: ${specialtyName}`), margin, y);
  y += 5;
  doc.text(sanitize(`Profissional: ${practitionerName}`), margin, y);
  y += 8;

  // Divider
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ── Empty state ──
  if (finalItems.length === 0) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "italic");
    doc.text(sanitize("Nenhum item na prescricao final."), margin, y);
    const date = new Date().toISOString().slice(0, 10);
    const safeName = patientName.replace(/[^a-zA-Z0-9\u00C0-\u00FF]/g, "_");
    doc.save(`Prescricao_${safeName}_${date}.pdf`);
    return;
  }

  // ── Table ──
  const headers = [
    ["#", "Substancia", "Dose", "Via", "Frequencia", "Duracao", "Obs / Monitorizacao", "Origem"],
  ];

  const body = finalItems.map((item, idx) => [
    String(idx + 1),
    sanitize(item.substance),
    sanitize(item.dose),
    sanitize(item.route),
    sanitize(item.frequency),
    sanitize(item.duration),
    sanitize([item.conditions, item.monitoring].filter(Boolean).join(" | ")),
    sanitize(originLabel(item.origin)),
  ]);

  (doc as any).autoTable({
    startY: y,
    head: headers,
    body,
    margin: { left: margin, right: margin },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [45, 55, 72],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 30 },
      2: { cellWidth: 20 },
      3: { cellWidth: 14 },
      4: { cellWidth: 22 },
      5: { cellWidth: 18 },
      6: { cellWidth: 45 },
      7: { cellWidth: 20 },
    },
    didDrawPage: () => {
      // Footer
      const pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(140);
      doc.text(
        sanitize(`Gerado em ${new Date().toLocaleDateString("pt-BR")} - Documento para uso clinico`),
        margin,
        pageH - 8
      );
      doc.setTextColor(0);
    },
  });

  // ── Summary after table ──
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + 20;
  y = finalY + 8;
  checkPage(15);

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(sanitize(`Total de itens: ${finalItems.length}`), margin, y);
  y += 4;

  const aiCount = finalItems.filter((i) => i.origin === "accepted_by_physician" || i.origin === "edited_by_physician").length;
  const manualCount = finalItems.filter((i) => i.origin === "manually_added").length;
  doc.text(sanitize(`Origem IA: ${aiCount} | Manual: ${manualCount}`), margin, y);
  doc.setTextColor(0);

  // ── Save ──
  const date = new Date().toISOString().slice(0, 10);
  const safeName = patientName.replace(/[^a-zA-Z0-9\u00C0-\u00FF]/g, "_");
  doc.save(`Prescricao_${safeName}_${date}.pdf`);
}
