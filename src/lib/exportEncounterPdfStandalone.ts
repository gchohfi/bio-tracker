/**
 * exportEncounterPdfStandalone.ts
 *
 * Standalone helper to export a clinical encounter PDF from any context.
 * Fetches all necessary data (patient, encounter, SOAP, analysis, prescription)
 * and calls generateEncounterPdf.
 */

import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { generateEncounterPdf } from "./generateEncounterPdf";
import { buildReviewedReport } from "./buildReviewedReport";
import type { PrescriptionItem } from "@/components/EncounterPrescriptionEditor";
import type { AnalysisV2Data } from "@/components/ClinicalReportV2";

interface ExportEncounterPdfOptions {
  encounterId: string;
  patientId: string;
  specialtyName: string;
}

export async function exportEncounterPdfStandalone({
  encounterId,
  patientId,
  specialtyName,
}: ExportEncounterPdfOptions): Promise<void> {
  // Fetch all data in parallel
  const [patientRes, encounterRes, noteRes, analysisRes, rxRes] = await Promise.all([
    (supabase as any).from("patients").select("name, sex, birth_date").eq("id", patientId).single(),
    (supabase as any).from("clinical_encounters").select("encounter_date, status, chief_complaint").eq("id", encounterId).single(),
    (supabase as any).from("clinical_evolution_notes").select("subjective, objective, assessment, plan, exams_requested, medications, free_notes").eq("encounter_id", encounterId).single(),
    (supabase as any).from("patient_analyses").select("id, analysis_v2_data").eq("encounter_id", encounterId).order("created_at", { ascending: false }).limit(1).single(),
    (supabase as any).from("clinical_prescriptions").select("prescription_json").eq("encounter_id", encounterId).limit(1).single(),
  ]);

  const patient = patientRes.data;
  const encounter = encounterRes.data;
  if (!patient || !encounter) throw new Error("Dados não encontrados");

  const note = noteRes.data;
  const prescriptionItems: PrescriptionItem[] = rxRes.data?.prescription_json ?? [];

  // Build reviewed report
  let reviewedReport = null;
  const v2Data = analysisRes.data?.analysis_v2_data as AnalysisV2Data | null;
  const analysisId = analysisRes.data?.id;
  if (v2Data && analysisId) {
    const { data: reviewData } = await (supabase as any)
      .from("analysis_reviews")
      .select("review_state_json")
      .eq("analysis_id", analysisId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    const reviewState = reviewData?.review_state_json ?? {};
    reviewedReport = buildReviewedReport(v2Data, reviewState);
  }

  generateEncounterPdf({
    patientName: patient.name,
    patientSex: patient.sex,
    patientBirthDate: patient.birth_date
      ? format(parseISO(patient.birth_date), "dd/MM/yyyy")
      : null,
    encounterDate: format(parseISO(encounter.encounter_date), "dd/MM/yyyy"),
    specialtyName,
    status: encounter.status,
    chiefComplaint: encounter.chief_complaint,
    soap: {
      subjective: note?.subjective || null,
      objective: note?.objective || null,
      assessment: note?.assessment || null,
      plan: note?.plan || null,
      exams_requested: note?.exams_requested || null,
      medications: note?.medications || null,
      free_notes: note?.free_notes || null,
    },
    reviewedReport,
    prescriptionItems,
    relevantMarkers: [],
  });
}
