import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { extractPdfText } from "@/lib/extractPdfText";
import { loadCustomAliases } from "@/components/AliasConfigDialog";
import { MARKERS } from "@/lib/markers";
import type { Patient } from "@/hooks/usePatientData";

interface UsePdfImportParams {
  patient: Patient | null;
  ensureAuthenticated: () => Promise<boolean>;
  markerValues: Record<string, string>;
  setMarkerValues: (v: Record<string, string>) => void;
  labRefRanges: Record<string, { min?: number; max?: number; text?: string }>;
  setLabRefRanges: (v: Record<string, { min?: number; max?: number; text?: string }>) => void;
  setImportedPdfCount: React.Dispatch<React.SetStateAction<number>>;
  setSessionDate: (d: Date) => void;
  setExtractedExamDate: (d: string | null) => void;
  setLastQualityScore: (v: number | null) => void;
  setLastExtractionIssues: (v: any[]) => void;
  setLastHistoricalResults: (v: any[]) => void;
  setEditExtractionOpen: (v: boolean) => void;
}

export function usePdfImport({
  patient,
  ensureAuthenticated,
  markerValues,
  setMarkerValues,
  labRefRanges,
  setLabRefRanges,
  setImportedPdfCount,
  setSessionDate,
  setExtractedExamDate,
  setLastQualityScore,
  setLastExtractionIssues,
  setLastHistoricalResults,
  setEditExtractionOpen,
}: UsePdfImportParams) {
  const { toast } = useToast();
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [extracting, setExtracting] = useState(false);
  const [lastPdfText, setLastPdfText] = useState("");
  const [lastRawPdfText, setLastRawPdfText] = useState("");

  const processPdfFile = async (
    file: File,
    existingValues: Record<string, string>,
    existingLabRefs: Record<string, { min?: number; max?: number; text?: string }>
  ) => {
    const { fullText, cleanedText } = await extractPdfText(file);

    if (!cleanedText.trim()) {
      throw new Error("Não foi possível extrair texto do PDF.");
    }

    const customAliases = loadCustomAliases();
    const aliasHint = customAliases.length > 0
      ? "\n\nCUSTOM ALIASES (user-defined):\n" + customAliases.map(a => `${a.alias} → ${a.markerId}`).join("\n")
      : "";

    let patientAge: number | undefined;
    if (patient?.birth_date) {
      const today = new Date();
      const birth = new Date(patient.birth_date);
      patientAge = today.getFullYear() - birth.getFullYear() -
        (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
    }

    const { data, error } = await supabase.functions.invoke("extract-lab-results", {
      body: { pdfText: cleanedText + aliasHint, patientSex: patient?.sex, patientAge },
    });

    if (error) throw error;

    const results = data?.results as { marker_id: string; value?: number; text_value?: string; lab_ref_text?: string; lab_ref_min?: number; lab_ref_max?: number }[] | undefined;
    if (!results || results.length === 0) {
      throw new Error("A IA não conseguiu identificar resultados no PDF.");
    }

    const newValues = { ...existingValues };
    results.forEach((r) => {
      const marker = MARKERS.find(m => m.id === r.marker_id);
      if (marker?.qualitative) {
        if (r.text_value) newValues[r.marker_id] = r.text_value;
      } else if (r.text_value && /^[<>≤≥]=?\s*\d/.test(r.text_value.trim())) {
        newValues[r.marker_id] = r.text_value.trim();
      } else if (r.value !== undefined && r.value !== null) {
        newValues[r.marker_id] = String(r.value);
      } else if (r.text_value) {
        newValues[r.marker_id] = r.text_value;
      }
    });

    const newLabRefs = { ...existingLabRefs };
    results.forEach((r) => {
      if (r.lab_ref_text || r.lab_ref_min !== undefined || r.lab_ref_max !== undefined) {
        newLabRefs[r.marker_id] = { text: r.lab_ref_text, min: r.lab_ref_min, max: r.lab_ref_max };
      }
    });

    let examDate: string | null = (typeof data?.exam_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.exam_date))
      ? data.exam_date
      : null;

    if (!examDate) {
      const datePatterns = [
        /(?:Data\s+d[aeo]\s+[Cc]olet[ao]|Colet(?:a|ado)|Realizado\s+em|Data\s+d[oe]\s+[Ee]xame|Data\s+da\s+[Ff]icha|RECEBIDO.*?COLETADO)[:\s]*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/i,
        /(\d{2})[\/\-\.](\d{2})[\/\-\.](\d{4})(?=\s+\d{1,2}:\d{2})/,
      ];
      for (const pattern of datePatterns) {
        const match = fullText.match(pattern);
        if (match) {
          const [, dd, mm, yyyy] = match;
          const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
          const candidate = `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
          if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
            const d = new Date(candidate + "T12:00:00");
            if (!isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) {
              examDate = candidate;
              break;
            }
          }
        }
      }
    }

    const qualityScore = data?.quality_score ?? null;
    const extractionIssues = data?.issues ?? [];
    const historicalResults = data?.historicalResults ?? [];

    return { newValues, newLabRefs, fullText, cleanedText, count: results.length, examDate, qualityScore, extractionIssues, historicalResults };
  };

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";

    if (!(await ensureAuthenticated())) return;
    setExtracting(true);
    try {
      let currentValues = { ...markerValues };
      let currentLabRefs = { ...labRefRanges };
      let lastFullText = "";
      let lastCleanedText = "";
      let totalCount = 0;
      let firstExamDate: string | null = null;
      let lastQuality: number | null = null;
      let allIssues: any[] = [];
      let allHistorical: any[] = [];

      for (const file of files) {
        toast({ title: `Processando ${file.name}...`, description: `${files.indexOf(file) + 1} de ${files.length}` });
        const result = await processPdfFile(file, currentValues, currentLabRefs);
        currentValues = result.newValues;
        currentLabRefs = result.newLabRefs;
        lastFullText = result.fullText;
        lastCleanedText = result.cleanedText;
        totalCount += result.count;
        if (!firstExamDate && result.examDate) firstExamDate = result.examDate;
        if (result.qualityScore !== null) lastQuality = result.qualityScore;
        allIssues = allIssues.concat(result.extractionIssues);
        if (result.historicalResults.length > 0) allHistorical = allHistorical.concat(result.historicalResults);
      }

      setMarkerValues(currentValues);
      setLabRefRanges(currentLabRefs);
      setLastPdfText(lastCleanedText);
      setLastRawPdfText(lastFullText);
      setImportedPdfCount((prev) => prev + files.length);
      setLastQualityScore(lastQuality);
      setLastExtractionIssues(allIssues);
      setLastHistoricalResults(allHistorical);

      if (firstExamDate) {
        try {
          const parsed = new Date(firstExamDate + "T12:00:00");
          if (!isNaN(parsed.getTime())) {
            setSessionDate(parsed);
            setExtractedExamDate(firstExamDate);
          }
        } catch {}
      }

      setEditExtractionOpen(true);
      toast({
        title: `${totalCount} marcadores importados de ${files.length} PDF(s)!`,
        description: "Revise os valores antes de salvar.",
      });
    } catch (err: any) {
      console.error("PDF import error:", err);
      toast({ title: "Erro na importação", description: err.message || "Erro ao processar PDF", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  };

  return {
    pdfInputRef,
    extracting,
    lastPdfText,
    lastRawPdfText,
    handlePdfImport,
  };
}
