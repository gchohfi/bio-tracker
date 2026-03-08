/**
 * generateReportV2Pdf.ts
 *
 * Gera PDF do relatório V2 revisado usando jsPDF.
 * Inclui apenas itens aceitos/editados/pendentes (rejeitados excluídos).
 */

import jsPDF from "jspdf";
import "jspdf-autotable";
import type { ReviewedReportData, ReviewedItem } from "./buildReviewedReport";
import { Trace } from "./traceability";

// Sanitize for Latin-1 (jsPDF limitation)
function sanitize(text: string): string {
  return text
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/–/g, "-")
    .replace(/—/g, "-")
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/'/g, "'")
    .replace(/•/g, "-")
    .replace(/[^\x00-\xFF]/g, "");
}

function decisionLabel(d: ReviewedItem["decision"]): string {
  switch (d) {
    case "accepted": return "[Aceito]";
    case "edited": return "[Editado]";
    case "pending": return "[Pendente]";
  }
}

export function generateReportV2Pdf(
  report: ReviewedReportData,
  patientName: string
): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Header ──
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(sanitize("Relatorio Clinico Estruturado (V2)"), margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(sanitize(`Paciente: ${patientName}`), margin, y);
  y += 5;
  doc.text(sanitize(`Especialidade: ${report.meta.specialty_name}`), margin, y);
  y += 5;
  doc.text(sanitize(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`), margin, y);
  y += 5;

  // Review summary
  const rs = report.review_summary;
  doc.text(
    sanitize(`Revisao: ${rs.accepted} aceitos | ${rs.edited} editados | ${rs.rejected} rejeitados | ${rs.pending} pendentes (de ${rs.total})`),
    margin, y
  );
  y += 8;

  // ── Executive Summary ──
  if (report.executive_summary) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Sumario Executivo", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(sanitize(report.executive_summary), contentW);
    checkPage(lines.length * 4 + 4);
    doc.text(lines, margin, y);
    y += lines.length * 4 + 6;
  }

  // ── Section renderer ──
  const renderSection = (title: string, items: ReviewedItem[], icon: string) => {
    if (items.length === 0) return;
    checkPage(15);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(sanitize(`${icon} ${title}`), margin, y);
    y += 6;

    for (const item of items) {
      const label = decisionLabel(item.decision);
      const text = item.final_text;
      const note = item.physician_note;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      const headerLine = sanitize(`${label} ${text.substring(0, 80)}${text.length > 80 ? "..." : ""}`);
      checkPage(12);
      doc.text(headerLine, margin + 2, y);
      y += 4;

      if (text.length > 80) {
        doc.setFont("helvetica", "normal");
        const fullLines = doc.splitTextToSize(sanitize(text), contentW - 4);
        checkPage(fullLines.length * 3.5 + 2);
        doc.text(fullLines, margin + 4, y);
        y += fullLines.length * 3.5 + 2;
      }

      if (item.decision === "edited" && item.original_text !== item.final_text) {
        doc.setFont("helvetica", "italic");
        doc.setTextColor(120);
        const origLines = doc.splitTextToSize(sanitize(`Original IA: ${item.original_text}`), contentW - 8);
        checkPage(origLines.length * 3.5 + 2);
        doc.text(origLines, margin + 6, y);
        y += origLines.length * 3.5 + 2;
        doc.setTextColor(0);
      }

      if (note) {
        doc.setFont("helvetica", "italic");
        doc.setTextColor(60, 60, 140);
        const noteLines = doc.splitTextToSize(sanitize(`Nota medica: ${note}`), contentW - 8);
        checkPage(noteLines.length * 3.5 + 2);
        doc.text(noteLines, margin + 6, y);
        y += noteLines.length * 3.5 + 2;
        doc.setTextColor(0);
      }

      // Extra context (priority, system, etc.)
      const extras: string[] = [];
      if (item.extra.severity) extras.push(`Severidade: ${item.extra.severity}`);
      if (item.extra.priority) extras.push(`Prioridade: ${item.extra.priority}`);
      if (item.extra.system) extras.push(`Sistema: ${item.extra.system}`);
      if (item.extra.likelihood) extras.push(`Probabilidade: ${item.extra.likelihood}`);
      if (item.extra.action_type) extras.push(`Tipo: ${item.extra.action_type}`);

      if (extras.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100);
        checkPage(5);
        doc.text(sanitize(extras.join(" | ")), margin + 4, y);
        y += 4;
        doc.setTextColor(0);
      }

      y += 3;
    }
    y += 4;
  };

  renderSection("Red Flags", report.red_flags, "!!");
  renderSection("Achados Clinicos", report.clinical_findings, ">>");
  renderSection("Hipoteses Diagnosticas", report.diagnostic_hypotheses, "??");
  renderSection("Acoes Sugeridas", report.suggested_actions, "=>"); 

  // ── Follow-up ──
  if (report.follow_up) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Follow-up", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    if (report.follow_up.suggested_exams?.length > 0) {
      doc.text(sanitize(`Exames sugeridos: ${report.follow_up.suggested_exams.join(", ")}`), margin + 2, y);
      y += 5;
    }
    if (report.follow_up.suggested_return_days) {
      doc.text(sanitize(`Retorno sugerido: ${report.follow_up.suggested_return_days} dias`), margin + 2, y);
      y += 5;
    }
    if (report.follow_up.notes) {
      const noteLines = doc.splitTextToSize(sanitize(report.follow_up.notes), contentW - 4);
      doc.text(noteLines, margin + 2, y);
      y += noteLines.length * 4;
    }
  }

  // ── Footer ──
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150);
    doc.text(
      sanitize(`Relatorio V2 Revisado - ${patientName} - Pag ${i}/${pageCount}`),
      margin,
      doc.internal.pageSize.getHeight() - 8
    );
    doc.setTextColor(0);
  }

  // ── TRACE: Rastreabilidade da exportação ──
  Trace.export("", "", "pdf", "relatorio_v2_revisado");

  doc.save(sanitize(`relatorio-v2-${patientName.replace(/\s+/g, "_")}-${new Date().toISOString().slice(0, 10)}.pdf`));
}
