/**
 * generateEncounterPdf.ts
 *
 * Gera PDF do resumo clínico da consulta.
 * Diferente do PDF evolutivo (tabela de exames) e do PDF de prescrição (itens).
 * Este é o documento da CONSULTA: reúne nota SOAP, análise IA revisada,
 * prescrição final e próximos passos em um documento clínico limpo.
 */

import jsPDF from "jspdf";
import "jspdf-autotable";
import type { ReviewedReportData, ReviewedItem } from "./buildReviewedReport";
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

// ── Prescription helpers ──

const INCLUDED_ORIGINS: ItemOrigin[] = [
  "accepted_by_physician",
  "edited_by_physician",
  "manually_added",
];

function filterFinalPrescriptionItems(items: PrescriptionItem[]): PrescriptionItem[] {
  return items.filter((item) => INCLUDED_ORIGINS.includes(item.origin));
}

// ── Types ──

export interface EncounterPdfParams {
  patientName: string;
  patientSex: string;
  patientBirthDate: string | null;
  encounterDate: string; // formatted, e.g. "15/03/2026"
  specialtyName: string;
  status: "draft" | "finalized";
  chiefComplaint: string | null;
  /** SOAP note fields */
  soap: {
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    exams_requested: string | null;
    medications: string | null;
    free_notes: string | null;
  };
  /** Reviewed AI analysis (optional) */
  reviewedReport: ReviewedReportData | null;
  /** Prescription items (optional) */
  prescriptionItems: PrescriptionItem[];
  /** Key lab findings to include as evidence (optional, max ~8) */
  relevantMarkers: Array<{
    marker_name: string;
    value: number | null;
    text_value: string | null;
    flag: string | null;
  }>;
}

// ── PDF Generation ──

export function generateEncounterPdf(params: EncounterPdfParams): void {
  const {
    patientName, patientSex, patientBirthDate,
    encounterDate, specialtyName, status,
    chiefComplaint, soap, reviewedReport,
    prescriptionItems, relevantMarkers,
  } = params;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = margin;

  const checkPage = (needed: number) => {
    if (y + needed > pageH - 15) {
      doc.addPage();
      y = margin;
    }
  };

  // ── Helpers ──

  const sectionTitle = (title: string) => {
    checkPage(14);
    y += 3;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(sanitize(title), margin, y);
    y += 1;
    doc.setDrawColor(60, 60, 60);
    doc.setLineWidth(0.4);
    doc.line(margin, y, margin + contentW * 0.4, y);
    y += 5;
  };

  const paragraph = (text: string | null, label?: string) => {
    if (!text?.trim()) return;
    const lines = doc.splitTextToSize(sanitize(text), contentW);
    checkPage(lines.length * 4 + 6);
    if (label) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(sanitize(label), margin, y);
      y += 4;
    }
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(lines, margin, y);
    y += lines.length * 4 + 2;
  };

  // ══════════════════════════════════════════════
  // HEADER
  // ══════════════════════════════════════════════

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(sanitize("Resumo Clinico da Consulta"), margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(sanitize(`Paciente: ${patientName}`), margin, y);
  y += 5;

  const sexLabel = patientSex === "F" ? "Feminino" : patientSex === "M" ? "Masculino" : patientSex;
  let demographics = `Sexo: ${sexLabel}`;
  if (patientBirthDate) {
    demographics += `  |  Data de nascimento: ${patientBirthDate}`;
  }
  doc.text(sanitize(demographics), margin, y);
  y += 5;

  doc.text(sanitize(`Data da consulta: ${encounterDate}`), margin, y);
  y += 5;
  doc.text(sanitize(`Especialidade: ${specialtyName}`), margin, y);
  y += 5;
  doc.text(sanitize(`Status: ${status === "finalized" ? "Finalizada" : "Rascunho"}`), margin, y);
  y += 2;

  // Divider
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 5;

  // ══════════════════════════════════════════════
  // 1. MOTIVO DA CONSULTA
  // ══════════════════════════════════════════════

  if (chiefComplaint?.trim()) {
    sectionTitle("Motivo da Consulta");
    paragraph(chiefComplaint);
  }

  // ══════════════════════════════════════════════
  // 2. NOTA CLÍNICA (SOAP)
  // ══════════════════════════════════════════════

  const soapFields: Array<{ label: string; value: string | null }> = [
    { label: "O que mudou desde a ultima consulta (Subjetivo)", value: soap.subjective },
    { label: "Achados objetivos relevantes", value: soap.objective },
    { label: "Avaliacao clinica", value: soap.assessment },
    { label: "Conduta / Plano", value: soap.plan },
    { label: "Exames pedidos / Proximos passos", value: soap.exams_requested },
    { label: "Medicamentos em uso", value: soap.medications },
    { label: "Notas livres", value: soap.free_notes },
  ];

  const hasSoap = soapFields.some((f) => f.value?.trim());
  if (hasSoap) {
    sectionTitle("Nota Clinica");
    for (const field of soapFields) {
      paragraph(field.value, field.label);
    }
  }

  // ══════════════════════════════════════════════
  // 3. ANÁLISE IA REVISADA (resumo, não tabela)
  // ══════════════════════════════════════════════

  if (reviewedReport) {
    sectionTitle("Analise Clinica (IA Revisada)");

    // Executive summary
    if (reviewedReport.executive_summary) {
      paragraph(reviewedReport.executive_summary, "Sumario Executivo");
    }

    // Red flags
    const rfItems = reviewedReport.red_flags;
    if (rfItems.length > 0) {
      checkPage(rfItems.length * 5 + 8);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(180, 30, 30);
      doc.text("Alertas Criticos (Red Flags)", margin, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(0, 0, 0);
      for (const rf of rfItems) {
        const line = `- ${rf.final_text}`;
        const lines = doc.splitTextToSize(sanitize(line), contentW);
        checkPage(lines.length * 4);
        doc.text(lines, margin, y);
        y += lines.length * 4;
      }
      y += 2;
    }

    // Key findings (compact)
    const keyFindings = reviewedReport.clinical_findings.filter((f) => f.decision !== "pending" || reviewedReport.clinical_findings.length <= 5);
    if (keyFindings.length > 0) {
      renderReviewedList("Principais Achados", keyFindings);
    }

    // Diagnostic hypotheses
    if (reviewedReport.diagnostic_hypotheses.length > 0) {
      renderReviewedList("Hipoteses Diagnosticas", reviewedReport.diagnostic_hypotheses);
    }

    // Suggested actions
    if (reviewedReport.suggested_actions.length > 0) {
      renderReviewedList("Acoes Sugeridas", reviewedReport.suggested_actions);
    }

    // Follow-up
    if (reviewedReport.follow_up) {
      const fu = reviewedReport.follow_up;
      const fuParts: string[] = [];
      if (fu.suggested_return_days) fuParts.push(`Retorno em ${fu.suggested_return_days} dias`);
      if (fu.suggested_exams?.length) fuParts.push(`Exames: ${fu.suggested_exams.join(", ")}`);
      if (fu.notes) fuParts.push(fu.notes);
      if (fuParts.length > 0) {
        paragraph(fuParts.join("\n"), "Follow-up");
      }
    }
  }

  // ══════════════════════════════════════════════
  // 4. EVIDÊNCIAS LABORATORIAIS ESSENCIAIS
  // ══════════════════════════════════════════════

  if (relevantMarkers.length > 0) {
    sectionTitle("Evidencias Laboratoriais Relevantes");
    checkPage(relevantMarkers.length * 5 + 6);

    const tableBody = relevantMarkers.map((m) => {
      const displayValue = m.text_value || (m.value != null ? String(m.value) : "-");
      const flagLabel = m.flag === "high" ? "Alto" : m.flag === "low" ? "Baixo" : m.flag === "critical_high" ? "Critico Alto" : m.flag === "critical_low" ? "Critico Baixo" : "-";
      return [sanitize(m.marker_name), sanitize(displayValue), sanitize(flagLabel)];
    });

    (doc as any).autoTable({
      startY: y,
      head: [["Marcador", "Valor", "Status"]],
      body: tableBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60], textColor: 255 },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // ══════════════════════════════════════════════
  // 5. PRESCRIÇÃO FINAL
  // ══════════════════════════════════════════════

  const finalRx = filterFinalPrescriptionItems(prescriptionItems);
  if (finalRx.length > 0) {
    sectionTitle("Prescricao Final");

    const rxBody = finalRx.map((item, i) => [
      String(i + 1),
      sanitize(item.substance),
      sanitize(item.dose),
      sanitize(`${item.route} | ${item.frequency}`),
      sanitize(item.duration),
      sanitize(item.conditions || "-"),
    ]);

    (doc as any).autoTable({
      startY: y,
      head: [["#", "Substancia", "Dose", "Via / Frequencia", "Duracao", "Condicoes"]],
      body: rxBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [60, 60, 60], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 8 },
        1: { cellWidth: 35 },
      },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 4;
  }

  // ══════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════

  checkPage(12);
  y += 4;
  doc.setDrawColor(180);
  doc.line(margin, y, pageW - margin, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(120);
  doc.text(sanitize(`Documento gerado em ${new Date().toLocaleString("pt-BR")}`), margin, y);
  doc.setTextColor(0);

  // ── Save ──
  const dateSlug = encounterDate.replace(/\//g, "-");
  const fileName = `consulta_${sanitize(patientName).replace(/\s+/g, "_")}_${dateSlug}.pdf`;
  doc.save(fileName);

  // ── Helper function (defined here to access doc/y via closure) ──
  function renderReviewedList(title: string, items: ReviewedItem[]) {
    checkPage(items.length * 5 + 8);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(sanitize(title), margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    for (const item of items) {
      const decLabel = item.decision === "edited" ? " [Editado]" : item.decision === "accepted" ? " [Aceito]" : "";
      const line = `- ${item.final_text}${decLabel}`;
      const lines = doc.splitTextToSize(sanitize(line), contentW);
      checkPage(lines.length * 4);
      doc.text(lines, margin, y);
      y += lines.length * 4;
      if (item.physician_note) {
        doc.setFont("helvetica", "italic");
        const noteLines = doc.splitTextToSize(sanitize(`  Nota: ${item.physician_note}`), contentW - 4);
        checkPage(noteLines.length * 3.5);
        doc.text(noteLines, margin + 4, y);
        y += noteLines.length * 3.5;
        doc.setFont("helvetica", "normal");
      }
    }
    y += 2;
  }
}
