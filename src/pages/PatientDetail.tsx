import { useState, useEffect, useMemo, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Plus,
  CalendarIcon,
  Save,
  Trash2,
  FlaskConical,
  Edit2,
  BarChart3,
  FileUp,
  Loader2,
  FileDown,
  Pencil,
  Check,
  X,
  Sparkles,
  Settings2,
  UserCircle2,
  Brain,
  Syringe,
  Sliders,
} from "lucide-react";
import EvolutionTable from "@/components/EvolutionTable";
import ImportVerification from "@/components/ImportVerification";
import EditExtractionDialog from "@/components/EditExtractionDialog";
import EditReportDialog from "@/components/EditReportDialog";
import AliasConfigDialog, { loadCustomAliases } from "@/components/AliasConfigDialog";
import { PatientProfileDialog } from "@/components/PatientProfileDialog";
import { generatePatientReport } from "@/lib/generateReport";
import { exportPrescriptionCSV } from "@/lib/exportPrescriptionCSV";
import {
  CATEGORIES,
  CATEGORY_COLORS,
  MARKERS,
  getMarkersByCategory,
  getMarkerStatus,
  type Category,
  type MarkerDef,
} from "@/lib/markers";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;
type LabSession = Tables<"lab_sessions">;
type LabResult = Tables<"lab_results">;

// ── PDF text extraction helper ──────────────────────────────────────────
async function extractPdfText(file: File): Promise<{ fullText: string; cleanedText: string }> {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items as any[];
    if (items.length === 0) continue;
    const lines: { y: number; items: { x: number; str: string }[] }[] = [];
    items.forEach((item) => {
      if (!item.str) return;
      const y = Math.round(item.transform[5]);
      const x = item.transform[4];
      let line = lines.find((l) => Math.abs(l.y - y) < 3);
      if (!line) { line = { y, items: [] }; lines.push(line); }
      line.items.push({ x, str: item.str });
    });
    lines.sort((a, b) => b.y - a.y);
    lines.forEach((line) => {
      line.items.sort((a, b) => a.x - b.x);
      fullText += line.items.map((it) => it.str).join("  ") + "\n";
    });
    fullText += "\n--- Página " + i + " ---\n\n";
  }

  const cleanedLines = fullText.split("\n").filter((line) => {
    const normalized = line.trim().replace(/\s+/g, " ");
    if (!normalized || normalized.length < 3) return false;
    if (/^Cliente:/i.test(normalized)) return false;
    if (/^Data de Nascimento:/i.test(normalized)) return false;
    if (/^Médico:.*CRM/i.test(normalized)) return false;
    if (/^Data da Ficha:/i.test(normalized)) return false;
    if (/^Ficha:/i.test(normalized)) return false;
    if (/^RECEBIDO.COLETADO/i.test(normalized)) return false;
    if (/^Exame liberado/i.test(normalized)) return false;
    if (/^Assinatura digital/i.test(normalized)) return false;
    if (/^CRM:.*RESPONSÁVEL/i.test(normalized)) return false;
    if (/^A interpretação do resultado/i.test(normalized)) return false;
    if (/^Avenida|^Rua |^Impresso em:/i.test(normalized)) return false;
    if (/^Página:|^Páginas:/i.test(normalized)) return false;
    if (/^-{3,}/.test(normalized)) return false;
    if (/^={3,}/.test(normalized)) return false;
    if (/^www\./i.test(normalized)) return false;
    if (/confiance/i.test(normalized)) return false;
    if (/^CAMPINAS|^INDAIATUBA/i.test(normalized)) return false;
    if (/^0[A-F0-9]{30,}/i.test(normalized)) return false;
    if (/^O valor preditivo/i.test(normalized)) return false;
    if (/^Nome:/i.test(normalized)) return false;
    if (/^Código:/i.test(normalized)) return false;
    if (/^Posto:/i.test(normalized)) return false;
    if (/^CNES:/i.test(normalized)) return false;
    if (/^Dr\.\(a\):/i.test(normalized)) return false;
    if (/^Recepção:/i.test(normalized)) return false;
    if (/^RG\/Passaporte:/i.test(normalized)) return false;
    if (/^Entrega:/i.test(normalized)) return false;
    if (/^PALC/i.test(normalized)) return false;
    if (/^SBPC/i.test(normalized)) return false;
    if (/^Laboratório\. CRM/i.test(normalized)) return false;
    if (/^Medicina Diagnóstica/i.test(normalized)) return false;
    if (/^Resultados? Anteriore?s?:/i.test(normalized)) return false;
    if (/^\d{2}\/\d{2}\/\d{4}\s*-\s*[\d<>,. ]+$/i.test(normalized)) return false;
    if (/^Método:/i.test(normalized)) return false;
    if (/^Coleta:/i.test(normalized)) return false;
    if (/^Liberação:/i.test(normalized)) return false;
    if (/^Revisão:/i.test(normalized)) return false;
    if (/^Observações gerais:/i.test(normalized)) return false;
    if (/^Exame realizado pelo/i.test(normalized)) return false;
    if (/^NOTA\s*\(?[0-9]*\)?:/i.test(normalized)) return false;
    if (/^Notas?:/i.test(normalized)) return false;
    if (/^Referências?:/i.test(normalized)) return false;
    if (/^Referência:/i.test(normalized)) return false;
    if (/^Atenção para nov/i.test(normalized)) return false;
    if (/^Limite de detecção/i.test(normalized)) return false;
    const hasQualitative = /reagente|negativo|positivo|normal|ausente|presente|pastosa|líquida|amarelo|marrom|verde|turva|límpida/i.test(normalized);
    const looksLikeExamLabel = /\b(?:TSH|T3|T4|TGO|TGP|VHS|VPM|HOMA|HDL|LDL|VLDL|PCR|FAN|EAS|ACTH|FSH|LH|DHEA|SHBG|IGF|IGFBP|HbA1c|Apo|B12)\b/i.test(normalized)
      || /\b(?:hemoglobina|hematocrito|eritrocitos|leucocitos|plaquetas|glicose|insulina|colesterol|triglicerides|ferritina|transferrina|creatinina|ureia|albumina|globulina|bilirrubina|fosfatase|amilase|lipase|estradiol|progesterona|prolactina|testosterona|cortisol|vitamina|zinco|magnesio|selenio|cobre|copro|urina)\b/i.test(normalized);
    if (normalized.length > 120 && !/\d+[.,]\d+/.test(normalized) && !hasQualitative && !looksLikeExamLabel) return false;
    if (normalized.length > 80 && !/\d/.test(normalized) && !hasQualitative && !looksLikeExamLabel) return false;
    if (/^Paciente de (baixo|risco|alto|muito)/i.test(normalized)) return false;
    if (/^(Desejável|Ótimo|Limítrofe|Alto|Muito alto)\s*:/i.test(normalized)) return false;
    if (/^(Com|Sem) (ou sem )?jejum/i.test(normalized)) return false;
    if (/^Maior ou igual a \d+ anos/i.test(normalized)) return false;
    if (/^Fem:|^Masc:/i.test(normalized)) return false;
    if (/^Menor que \d|^Maior que \d|^Maior ou igual a \d/i.test(normalized)) return false;
    if (/^De \d+ a \d+ anos/i.test(normalized)) return false;
    if (/^Acima de \d+ anos/i.test(normalized)) return false;
    if (/^Até \d+ anos/i.test(normalized)) return false;
    if (/^Crianças/i.test(normalized)) return false;
    if (/^Gestantes/i.test(normalized)) return false;
    if (/^1\.o trimestre|^2\.o trimestre|^3\.o trimestre/i.test(normalized)) return false;
    if (/^Adultos:/i.test(normalized)) return false;
    if (/^Homens:|^Mulheres:/i.test(normalized)) return false;
    if (/^Fase Folicular|^Pico Ovulatório|^Fase Lútea|^Menopausa/i.test(normalized)) return false;
    if (/^Estágio de Tanner/i.test(normalized)) return false;
    if (/^Recém-nascido/i.test(normalized)) return false;
    if (/^\d+ dias?:/i.test(normalized)) return false;
    if (/^Sangue de cordão/i.test(normalized)) return false;
    if (/^pode interferir/i.test(normalized)) return false;
    if (/^suspensão da biotina/i.test(normalized)) return false;
    if (/^Pacientes em tratamento/i.test(normalized)) return false;
    if (/^incompatibilidade do resultado/i.test(normalized)) return false;
    if (/^Na ausência de hiperglicemia/i.test(normalized)) return false;
    if (/^Standards of Medical/i.test(normalized)) return false;
    if (/^Diabetes Care/i.test(normalized)) return false;
    if (/^Cálculo baseado nos/i.test(normalized)) return false;
    if (/^Vermeulen/i.test(normalized)) return false;
    if (/^A estimativa da taxa/i.test(normalized)) return false;
    if (/^O uso da estimativa/i.test(normalized)) return false;
    if (/^Fonte da Fórmula/i.test(normalized)) return false;
    if (/^Miller WG/i.test(normalized)) return false;
    if (/^Imunoensaio para/i.test(normalized)) return false;
    if (/^Um resultado normal/i.test(normalized)) return false;
    if (/^No caso de obter/i.test(normalized)) return false;
    if (/^Quando se determina/i.test(normalized)) return false;
    if (/^Diferenças nos resultados/i.test(normalized)) return false;
    if (/^A concentração de ferro/i.test(normalized)) return false;
    if (/^LDL, VLDL e Colesterol não-HDL são calculados/i.test(normalized)) return false;
    if (/^Valores de Colesterol/i.test(normalized)) return false;
    if (/^A interpretação clínica/i.test(normalized)) return false;
    if (/^Para valores de triglicérides/i.test(normalized)) return false;
    if (/^Consenso Brasileiro/i.test(normalized)) return false;
    if (/^AC-##/i.test(normalized)) return false;
    if (/^Diluição de triagem/i.test(normalized)) return false;
    if (/^Para informações sobre/i.test(normalized)) return false;
    if (/^Frequência de FAN/i.test(normalized)) return false;
    if (/^Resultados reagentes/i.test(normalized)) return false;
    if (/^A definição do Padrão/i.test(normalized)) return false;
    if (/^Os padrões complexos/i.test(normalized)) return false;
    if (/^Mulheres em idade fértil/i.test(normalized)) return false;
    if (/^A NR-7/i.test(normalized)) return false;
    if (/^O resultado obtido/i.test(normalized)) return false;
    if (/^IBE\/SC/i.test(normalized)) return false;
    if (/^CARACTERES MORFOLÓGICOS/i.test(normalized)) return false;
    if (/^Valores obtidos/i.test(normalized)) return false;
    if (/^Este exame foi/i.test(normalized)) return false;
    if (/^Equipamento:/i.test(normalized)) return false;
    if (/^Ensaio:/i.test(normalized)) return false;
    if (/^Amostra:/i.test(normalized)) return false;
    if (/^Prazo de entrega/i.test(normalized)) return false;
    if (/^Orientação de preparo/i.test(normalized)) return false;
    if (/^Interferentes:/i.test(normalized)) return false;
    if (/^Valores em/i.test(normalized)) return false;
    if (/^IBMP\b/i.test(normalized)) return false;
    if (/^(?:mEq\/L|mg\/dL|ng\/mL|pg\/mL|µg\/dL|U\/L|mcg)\s*$/i.test(normalized)) return false;
    if (normalized.length < 3 && !/\d/.test(normalized)) return false;
    return true;
  });

  const cleanedText = cleanedLines
    .map((l) => l.trim().replace(/\s+/g, " "))
    .filter((l) => !/^--- Página \d+/.test(l))
    .join("\n");

  return { fullText, cleanedText };
}

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [patient, setPatient] = useState<Patient | null>(null);
  const [sessions, setSessions] = useState<LabSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Session form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<Date>(new Date());
  const [activeCategory, setActiveCategory] = useState<Category>("Hemograma");
  const [markerValues, setMarkerValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [detailTab, setDetailTab] = useState<"sessions" | "evolution" | "analysis">("sessions");
  const [savedAnalyses, setSavedAnalyses] = useState<any[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<any>(null);
  const [extracting, setExtracting] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [editExtractionOpen, setEditExtractionOpen] = useState(false);
  const [aliasConfigOpen, setAliasConfigOpen] = useState(false);
  const [lastPdfText, setLastPdfText] = useState("");
  const [lastRawPdfText, setLastRawPdfText] = useState("");
  const [labRefRanges, setLabRefRanges] = useState<Record<string, { min?: number; max?: number; text?: string }>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingProtocols, setIsGeneratingProtocols] = useState(false);
  const [cachedAiAnalysis, setCachedAiAnalysis] = useState<any>(null);
  const [cachedProtocols, setCachedProtocols] = useState<any[]>([]);
  const [profileOpen, setProfileOpen] = useState(false);
  // Track how many PDFs were imported in the current session
  const [importedPdfCount, setImportedPdfCount] = useState(0);
  // Date extracted automatically from the PDF
  const [extractedExamDate, setExtractedExamDate] = useState<string | null>(null);
  const [reportEditOpen, setReportEditOpen] = useState(false);
  const [reportResults, setReportResults] = useState<any[]>([]);
  const [reportWithAI, setReportWithAI] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState("medicina_funcional");
  const [availableSpecialties, setAvailableSpecialties] = useState<Array<{ specialty_id: string; specialty_name: string; specialty_icon: string; has_protocols: boolean }>>([]);

  // ── Carregar análises salvas ─────────────────────────────────────────
  const loadSavedAnalyses = async () => {
    if (!id) return;
    const { data } = await (supabase as any)
      .from("patient_analyses")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false });
    if (data) {
      setSavedAnalyses(data);
      if (data.length > 0) setSelectedAnalysis(data[0]);
    }
  };

  useEffect(() => {
    if (!id) return;
    fetchData();
    loadSpecialties();
    loadSavedAnalyses();
  }, [id]);

  const loadSpecialties = async () => {
    try {
      const { data } = await (supabase as any)
        .from("analysis_prompts")
        .select("specialty_id, specialty_name, specialty_icon, has_protocols")
        .eq("is_active", true)
        .order("specialty_name");
      if (data && data.length > 0) {
        setAvailableSpecialties(data);
      }
    } catch {
      // Silently fail — table may not exist yet
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const [patientRes, sessionsRes] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id!).single(),
      supabase
        .from("lab_sessions")
        .select("*")
        .eq("patient_id", id!)
        .order("session_date", { ascending: false }),
    ]);

    if (patientRes.error) {
      toast({ title: "Erro", description: patientRes.error.message, variant: "destructive" });
      navigate("/");
      return;
    }
    setPatient(patientRes.data);
    setSessions(sessionsRes.data || []);
    setLoading(false);
  };

  const openNewSession = () => {
    setEditingSessionId(null);
    setSessionDate(new Date());
    setMarkerValues({});
    setImportedPdfCount(0);
    setFormOpen(true);
  };

  const openEditSession = async (session: LabSession) => {
    setEditingSessionId(session.id);
    setSessionDate(parseISO(session.session_date));
    setImportedPdfCount(0);
    const { data } = await supabase
      .from("lab_results")
      .select("*")
      .eq("session_id", session.id);

    const vals: Record<string, string> = {};
    data?.forEach((r) => {
      const marker = MARKERS.find(m => m.id === r.marker_id);
      if (marker?.qualitative) {
        vals[r.marker_id] = r.text_value || "";
      } else if (r.text_value && /^[<>]=?\s*\d/.test(r.text_value.trim())) {
        vals[r.marker_id] = r.text_value.trim();
      } else {
        vals[r.marker_id] = String(r.value ?? "");
      }
    });
    setMarkerValues(vals);
    setFormOpen(true);
  };

  const handleSaveSession = async () => {
    if (!patient) return;
    setSaving(true);

    try {
      let sessionId = editingSessionId;

      if (editingSessionId) {
        await supabase
          .from("lab_sessions")
          .update({ session_date: format(sessionDate, "yyyy-MM-dd") })
          .eq("id", editingSessionId);
        await supabase.from("lab_results").delete().eq("session_id", editingSessionId);
      } else {
        const { data, error } = await supabase
          .from("lab_sessions")
          .insert({ patient_id: patient.id, session_date: format(sessionDate, "yyyy-MM-dd") })
          .select()
          .single();
        if (error) throw error;
        sessionId = data.id;
      }

      const allResults: { session_id: string; marker_id: string; value: number; text_value?: string; lab_ref_text?: string; lab_ref_min?: number; lab_ref_max?: number }[] = [];

      Object.entries(markerValues).forEach(([markerId, v]) => {
        if (v === "") return;
        const marker = MARKERS.find(m => m.id === markerId);
        const labRef = labRefRanges[markerId];
        const labRefFields = labRef ? {
          lab_ref_text: labRef.text,
          lab_ref_min: labRef.min,
          lab_ref_max: labRef.max,
        } : {};

        if (marker?.qualitative) {
          allResults.push({ session_id: sessionId!, marker_id: markerId, value: 0, text_value: v, ...labRefFields });
        } else {
          const operatorMatch = v.match(/^([<>]=?)\s*(\d+[.,]?\d*)$/);
          if (operatorMatch) {
            const numericPart = Number(operatorMatch[2].replace(",", "."));
            if (!isNaN(numericPart)) {
              allResults.push({ session_id: sessionId!, marker_id: markerId, value: numericPart, text_value: v, ...labRefFields });
            }
          } else if (!isNaN(Number(v))) {
            allResults.push({ session_id: sessionId!, marker_id: markerId, value: Number(v), ...labRefFields });
          }
        }
      });

      if (allResults.length > 0) {
        const { error } = await supabase.from("lab_results").insert(allResults as any);
        if (error) throw error;
      }

      toast({ title: editingSessionId ? "Sessão atualizada!" : "Sessão criada!" });
      setFormOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Excluir esta sessão e todos os resultados?")) return;
    const { error } = await supabase.from("lab_sessions").delete().eq("id", sessionId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sessão excluída!" });
      fetchData();
    }
  };

  const openReportEdit = async (withAI: boolean) => {
    if (!patient) return;
    const sessionIds = sessions.map((s) => s.id);
    const { data } = await supabase.from("lab_results").select("*").in("session_id", sessionIds);
    const mapped = (data || []).map((r) => ({
      marker_id: r.marker_id,
      session_id: r.session_id,
      value: r.value ?? 0,
      text_value: r.text_value ?? undefined,
      lab_ref_min: r.lab_ref_min ?? undefined,
      lab_ref_max: r.lab_ref_max ?? undefined,
      lab_ref_text: r.lab_ref_text ?? undefined,
    }));
    setReportResults(mapped);
    setReportWithAI(withAI);
    setReportEditOpen(true);
  };

  // ── Helper: build enriched results for AI ─────────────────────────────
  const buildEnrichedResults = (results: any[]) =>
    results.map((r) => {
      const marker = MARKERS.find((m) => m.id === r.marker_id);
      const session = sessions.find((s) => s.id === r.session_id);
      const status = marker ? getMarkerStatus(r.value ?? 0, marker, sex, r.text_value ?? undefined) : "normal";
      return {
        marker_id: r.marker_id,
        marker_name: marker?.name ?? r.marker_id,
        value: r.value,
        text_value: r.text_value,
        unit: marker?.unit ?? "",
        // Referência laboratorial convencional (usada para status)
        lab_min: marker?.labRange?.[sex]?.[0] ?? marker?.labRange?.M?.[0],
        lab_max: marker?.labRange?.[sex]?.[1] ?? marker?.labRange?.M?.[1],
        // Referência funcional/ótima (apenas informativa para a IA)
        functional_min: marker?.refRange?.[sex]?.[0] ?? marker?.refRange?.M?.[0],
        functional_max: marker?.refRange?.[sex]?.[1] ?? marker?.refRange?.M?.[1],
        status,
        session_date: session?.session_date ?? "",
      };
    });

  // ── Helper: build patient profile context for AI ───────────────────────
  const buildPatientProfile = () => {
    if (!patient) return null;
    const OBJECTIVE_LABELS: Record<string, string> = {
      performance_esportiva: "Performance esportiva",
      ganho_massa: "Ganho de massa muscular",
      emagrecimento: "Emagrecimento",
      desinflamacao: "Desinflamação / dor crônica",
      energia_disposicao: "Energia e disposição",
      longevidade: "Longevidade / anti-aging",
      saude_hormonal: "Saúde hormonal",
      imunidade: "Imunidade",
      cognicao_foco: "Cognição / foco",
      saude_pele: "Saúde da pele / estética",
      sono: "Sono",
      libido: "Libido",
      recuperacao_muscular: "Recuperação muscular",
      saude_intestinal: "Saúde intestinal",
    };
    const ACTIVITY_LABELS: Record<string, string> = {
      sedentario: "Sedentário",
      ativo_leve: "Ativo (1–2x/semana)",
      ativo: "Ativo (3–4x/semana)",
      muito_ativo: "Muito ativo (5+x/semana)",
      atleta_amador: "Atleta amador",
      atleta_alto_rendimento: "Atleta de alto rendimento",
    };
    return {
      objectives: (patient.objectives ?? []).map((id) => OBJECTIVE_LABELS[id] ?? id),
      activity_level: patient.activity_level ? ACTIVITY_LABELS[patient.activity_level] ?? patient.activity_level : null,
      sport_modality: patient.sport_modality ?? null,
      main_complaints: patient.main_complaints ?? null,
      restrictions: patient.restrictions ?? null,
    };
  };

  // ── Helper: map AI errors to user-friendly toasts ──────────────────────
  const handleAiError = (err: any, title: string) => {
    const status = err?.context?.status ?? err?.status;
    if (status === 429) {
      toast({ title, description: "Limite de requisições atingido. Aguarde alguns instantes e tente novamente.", variant: "destructive" });
    } else if (status === 402) {
      toast({ title, description: "Créditos insuficientes. Verifique seu plano.", variant: "destructive" });
    } else {
      toast({ title, description: err.message || "Erro desconhecido", variant: "destructive" });
    }
  };

  // ── Gerar Análise de Exames (somente análise clínica, sem protocolos) ──
  const handleGenerateAnalysis = async () => {
    if (!patient) return;
    const sessionIds = sessions.map((s) => s.id);
    const { data } = await supabase.from("lab_results").select("*").in("session_id", sessionIds);
    const results = (data || []).map((r) => ({
      marker_id: r.marker_id, session_id: r.session_id,
      value: r.value ?? 0, text_value: r.text_value ?? undefined,
      lab_ref_min: r.lab_ref_min ?? undefined, lab_ref_max: r.lab_ref_max ?? undefined, lab_ref_text: r.lab_ref_text ?? undefined,
    }));
    setIsAnalyzing(true);
    toast({ title: "Gerando análise de exames...", description: "Aguarde alguns segundos." });
    try {
      const enriched = buildEnrichedResults(results);
      if (enriched.length === 0) {
        toast({ title: "Sem dados", description: "Nenhum resultado laboratorial encontrado para analisar.", variant: "destructive" });
        setIsAnalyzing(false);
        return;
      }
      const { data: analysisData, error } = await supabase.functions.invoke("analyze-lab-results", {
        body: {
          patient_id: patient.id, patient_name: patient.name, sex: patient.sex, birth_date: patient.birth_date,
          sessions: sessions.map((s) => ({ id: s.id, session_date: s.session_date })),
          results: enriched,
          mode: "full",
          patient_profile: buildPatientProfile(),
          specialty_id: selectedSpecialty,
        },
      });
      if (error) throw error;
      const analysis = analysisData?.analysis;
      // Log diagnostics
      if (analysisData?._diagnostics) {
        console.log("[AI Diagnostics]", analysisData._diagnostics);
      }
      // Warn if truncated
      if (analysisData?._truncated) {
        toast({ title: "⚠ Análise possivelmente incompleta", description: "A resposta da IA foi truncada. Considere usar o modo 'Somente Análise' para respostas menores.", variant: "destructive" });
      }
      // Merge with existing cached protocols if any
      const merged = cachedProtocols.length > 0
        ? { ...analysis, protocol_recommendations: cachedProtocols }
        : analysis;
      setCachedAiAnalysis(merged);
      // Salvar análise no banco
      const sp = availableSpecialties.find(s => s.specialty_id === selectedSpecialty);
      const { data: savedData, error: saveError } = await (supabase as any)
        .from("patient_analyses")
        .insert({
          patient_id: patient.id,
          specialty_id: selectedSpecialty,
          specialty_name: sp?.specialty_name ?? selectedSpecialty,
          mode: "full",
          summary: analysis?.summary ?? null,
          patterns: analysis?.patterns ?? [],
          trends: analysis?.trends ?? [],
          suggestions: analysis?.suggestions ?? [],
          full_text: analysis?.full_text ?? null,
          technical_analysis: analysis?.technical_analysis ?? null,
          patient_plan: analysis?.patient_plan ?? null,
          prescription_table: analysis?.prescription_table ?? [],
          protocol_recommendations: merged?.protocol_recommendations ?? [],
        })
        .select()
        .single();
      if (savedData) {
        setSavedAnalyses(prev => [savedData, ...prev]);
        setSelectedAnalysis(savedData);
        setDetailTab("analysis");
      }
      toast({ title: "✅ Análise gerada e salva!", description: "Visualize na aba Análise IA." });
    } catch (err: any) {
      handleAiError(err, "Erro na análise");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Gerar Protocolos Sugeridos (somente protocolos) ────────────────────
  const handleGenerateProtocols = async () => {
    if (!patient) return;
    const sessionIds = sessions.map((s) => s.id);
    const { data } = await supabase.from("lab_results").select("*").in("session_id", sessionIds);
    const results = (data || []).map((r) => ({
      marker_id: r.marker_id, session_id: r.session_id,
      value: r.value ?? 0, text_value: r.text_value ?? undefined,
      lab_ref_min: r.lab_ref_min ?? undefined, lab_ref_max: r.lab_ref_max ?? undefined, lab_ref_text: r.lab_ref_text ?? undefined,
    }));
    setIsGeneratingProtocols(true);
    toast({ title: "Gerando recomendações de protocolos...", description: "Aguarde alguns segundos." });
    try {
      const enriched = buildEnrichedResults(results);
      const { data: analysisData, error } = await supabase.functions.invoke("analyze-lab-results", {
        body: {
          patient_id: patient.id, patient_name: patient.name, sex: patient.sex, birth_date: patient.birth_date,
          sessions: sessions.map((s) => ({ id: s.id, session_date: s.session_date })),
          results: enriched,
          mode: "protocols_only",
          patient_profile: buildPatientProfile(),
        },
      });
      if (error) throw error;
      if (analysisData?._diagnostics) console.log("[AI Diagnostics]", analysisData._diagnostics);
      if (analysisData?._truncated) {
        toast({ title: "⚠ Protocolos possivelmente incompletos", description: "A resposta da IA foi truncada.", variant: "destructive" });
      }
      const protocols = analysisData?.analysis?.protocol_recommendations ?? [];
      setCachedProtocols(protocols);
      const merged = cachedAiAnalysis
        ? { ...cachedAiAnalysis, protocol_recommendations: protocols }
        : { protocol_recommendations: protocols };
      generatePatientReport(patient.name, sex, sessions, results, merged);
      toast({ title: `${protocols.length} protocolo(s) sugerido(s) exportado(s)!` });
    } catch (err: any) {
      handleAiError(err, "Erro nos protocolos");
    } finally {
      setIsGeneratingProtocols(false);
    }
  };

  const handleReportConfirm = async (updatedResults: any[]) => {
    if (!patient) return;
    if (!reportWithAI) {
      generatePatientReport(patient.name, sex, sessions, updatedResults);
      toast({ title: "Relatório exportado!" });
      return;
    }
    // With AI (full: analysis + protocols)
    setIsAnalyzing(true);
    toast({ title: "Gerando análise completa com IA...", description: "Isso pode levar alguns segundos." });
    try {
      const enrichedResults = buildEnrichedResults(updatedResults);
      if (enrichedResults.length === 0) {
        toast({ title: "Sem dados", description: "Nenhum resultado laboratorial encontrado para analisar.", variant: "destructive" });
        setIsAnalyzing(false);
        return;
      }
      const { data: analysisData, error: analysisError } = await supabase.functions.invoke("analyze-lab-results", {
        body: {
          patient_id: patient.id,
          patient_name: patient.name,
          sex: patient.sex,
          birth_date: patient.birth_date,
          sessions: sessions.map((s) => ({ id: s.id, session_date: s.session_date })),
          results: enrichedResults,
          mode: "full",
          patient_profile: buildPatientProfile(),
        },
      });
      if (analysisError) throw analysisError;
      if (analysisData?._diagnostics) console.log("[AI Diagnostics]", analysisData._diagnostics);
      if (analysisData?._truncated) {
        toast({ title: "⚠ Análise possivelmente incompleta", description: "A resposta da IA foi truncada. Considere gerar a análise e os protocolos separadamente.", variant: "destructive" });
      }
      setCachedAiAnalysis(analysisData?.analysis);
      setCachedProtocols(analysisData?.analysis?.protocol_recommendations ?? []);
      generatePatientReport(patient.name, sex, sessions, updatedResults, analysisData?.analysis);
      toast({ title: "Relatório completo com IA exportado!" });
    } catch (err: any) {
      handleAiError(err, "Erro na análise de IA");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Salvar perfil do paciente ──────────────────────────────────────────
  const handleSaveProfile = async (profile: {
    objectives: string[] | null;
    activity_level: string | null;
    sport_modality: string | null;
    main_complaints: string | null;
    restrictions: string | null;
  }) => {
    if (!patient) return;
    const { error } = await supabase.from("patients").update(profile).eq("id", patient.id);
    if (error) {
      toast({ title: "Erro ao salvar perfil", description: error.message, variant: "destructive" });
    } else {
      setPatient({ ...patient, ...profile });
      toast({ title: "Perfil salvo!", description: "As recomendações de protocolos usarão este perfil." });
    }
  };

  const handleEditName = () => {
    if (!patient) return;
    setNameValue(patient.name);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!patient || !nameValue.trim()) return;
    const { error } = await supabase.from("patients").update({ name: nameValue.trim() }).eq("id", patient.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setPatient({ ...patient, name: nameValue.trim() });
      toast({ title: "Nome atualizado!" });
    }
    setEditingName(false);
  };

  const handleDeletePatient = async () => {
    if (!patient) return;
    if (!confirm("Excluir este paciente e todos os seus dados? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("patients").delete().eq("id", patient.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Paciente excluído!" });
      navigate("/");
    }
  };

  const filledCount = useMemo(
    () => Object.values(markerValues).filter((v) => v !== "").length,
    [markerValues]
  );

  // ── Core PDF import logic (shared between single and multi-PDF) ──────
  const processPdfFile = async (
    file: File,
    existingValues: Record<string, string>,
    existingLabRefs: Record<string, { min?: number; max?: number; text?: string }>
  ): Promise<{
    newValues: Record<string, string>;
    newLabRefs: Record<string, { min?: number; max?: number; text?: string }>;
    fullText: string;
    cleanedText: string;
    count: number;
    examDate: string | null;
  }> => {
    const { fullText, cleanedText } = await extractPdfText(file);

    if (!cleanedText.trim()) {
      throw new Error("Não foi possível extrair texto do PDF.");
    }

    // Build custom aliases hint for the prompt
    const customAliases = loadCustomAliases();
    const aliasHint = customAliases.length > 0
      ? "\n\nCUSTOM ALIASES (user-defined):\n" + customAliases.map(a => `${a.alias} → ${a.markerId}`).join("\n")
      : "";

    const { data, error } = await supabase.functions.invoke("extract-lab-results", {
      body: { pdfText: cleanedText + aliasHint },
    });

    if (error) throw error;

    const results = data?.results as { marker_id: string; value?: number; text_value?: string; lab_ref_text?: string; lab_ref_min?: number; lab_ref_max?: number }[] | undefined;
    if (!results || results.length === 0) {
      throw new Error("A IA não conseguiu identificar resultados no PDF.");
    }

    // Merge with existing values (new PDF values take precedence for same marker)
    const newValues = { ...existingValues };
    results.forEach((r) => {
      const marker = MARKERS.find(m => m.id === r.marker_id);
      if (marker?.qualitative) {
        if (r.text_value) newValues[r.marker_id] = r.text_value;
      } else if (r.text_value && /^[<>]=?\s*\d/.test(r.text_value.trim())) {
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

    // Capture exam_date if returned by the edge function
    let examDate: string | null = (typeof data?.exam_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(data.exam_date))
      ? data.exam_date
      : null;

    // Regex fallback: extract date from the FULL (unfiltered) PDF text
    if (!examDate) {
      // Try patterns: "Data de Coleta: DD/MM/YYYY", "Coleta: DD/MM/YYYY", "Data da coleta: DD/MM/YYYY",
      // "Realizado em: DD/MM/YYYY", "Data do exame: DD/MM/YYYY", "COLETADO: DD/MM/YYYY HH:MM"
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

    return { newValues, newLabRefs, fullText, cleanedText, count: results.length, examDate };
  };

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = "";

    setExtracting(true);
    try {
      let currentValues = { ...markerValues };
      let currentLabRefs = { ...labRefRanges };
      let lastFullText = "";
      let lastCleanedText = "";
      let totalCount = 0;
      let firstExamDate: string | null = null;

      for (const file of files) {
        toast({ title: `Processando ${file.name}...`, description: `${files.indexOf(file) + 1} de ${files.length}` });
        const result = await processPdfFile(file, currentValues, currentLabRefs);
        currentValues = result.newValues;
        currentLabRefs = result.newLabRefs;
        lastFullText = result.fullText;
        lastCleanedText = result.cleanedText;
        totalCount += result.count;
        // Use the date from the first PDF that returns one
        if (!firstExamDate && result.examDate) firstExamDate = result.examDate;
      }

      setMarkerValues(currentValues);
      setLabRefRanges(currentLabRefs);
      setLastPdfText(lastCleanedText);
      setLastRawPdfText(lastFullText);
      setImportedPdfCount((prev) => prev + files.length);

      // Auto-fill session date if extracted from PDF
      if (firstExamDate) {
        try {
          const parsed = new Date(firstExamDate + "T12:00:00");
          if (!isNaN(parsed.getTime())) {
            setSessionDate(parsed);
            setExtractedExamDate(firstExamDate);
          }
        } catch {}
      }

      // Open edit dialog first, then verification
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

  if (loading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </AppLayout>
    );
  }

  if (!patient) return null;

  const sex = patient.sex as "M" | "F";

  // Session form view
  if (formOpen) {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setFormOpen(false)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">
                  {editingSessionId ? "Editar Sessão" : "Nova Sessão"}
                </h1>
                <p className="text-sm text-muted-foreground">{patient.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{filledCount} marcadores</Badge>
              {importedPdfCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {importedPdfCount} PDF(s) importado(s)
                </Badge>
              )}
              {/* Hidden file input — accepts multiple files */}
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={handlePdfImport}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAliasConfigOpen(true)}
                title="Configurar aliases"
              >
                <Settings2 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => pdfInputRef.current?.click()}
                disabled={extracting}
              >
                {extracting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="mr-2 h-4 w-4" />
                )}
                {extracting ? "Extraindo..." : importedPdfCount > 0 ? "Adicionar PDF" : "Importar PDF"}
              </Button>
              {filledCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditExtractionOpen(true)}
                  title="Revisar exames extraídos"
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Revisar
                </Button>
              )}
              <Button onClick={handleSaveSession} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>

          {/* Date picker */}
          <div className="flex items-center gap-3 flex-wrap">
            <Label>Data:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(sessionDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={sessionDate}
                  onSelect={(d) => { d && setSessionDate(d); setExtractedExamDate(null); }}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            {extractedExamDate && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                <Check className="h-3 w-3" />
                Data extraída do laudo
              </span>
            )}
          </div>

          {/* Category tabs — simplified: only show categories with filled markers OR all */}
          <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as Category)}>
            <div className="overflow-x-auto">
              <TabsList className="inline-flex h-auto flex-wrap gap-1 bg-transparent p-0">
                {CATEGORIES.map((cat) => {
                  const catMarkers = getMarkersByCategory(cat);
                  const catFilled = catMarkers.filter(
                    (m) => markerValues[m.id] && markerValues[m.id] !== ""
                  ).length;
                  return (
                    <TabsTrigger
                      key={cat}
                      value={cat}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                        "data-[state=active]:border-transparent data-[state=active]:text-primary-foreground",
                      )}
                      style={
                        activeCategory === cat
                          ? { backgroundColor: `hsl(${CATEGORY_COLORS[cat]})` }
                          : undefined
                      }
                    >
                      {cat}
                      {catFilled > 0 && (
                        <span className="ml-1 opacity-70">({catFilled})</span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {CATEGORIES.map((cat) => (
              <TabsContent key={cat} value={cat} className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: `hsl(${CATEGORY_COLORS[cat]})` }}
                      />
                      {cat}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {getMarkersByCategory(cat).map((marker) => (
                        <MarkerInput
                          key={marker.id}
                          marker={marker}
                          sex={sex}
                          value={markerValues[marker.id] || ""}
                          onChange={(v) =>
                            setMarkerValues((prev) => ({ ...prev, [marker.id]: v }))
                          }
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Edit extraction dialog */}
          <EditExtractionDialog
            open={editExtractionOpen}
            onClose={() => setEditExtractionOpen(false)}
            markerValues={markerValues}
            onConfirm={(updated) => {
              setMarkerValues(updated);
              setVerificationOpen(true);
            }}
          />

          {/* Verification dialog */}
          <ImportVerification
            open={verificationOpen}
            onClose={() => setVerificationOpen(false)}
            importedMarkers={markerValues}
            pdfText={lastPdfText}
            rawPdfText={lastRawPdfText}
          />

          {/* Alias config dialog */}
          <AliasConfigDialog
            open={aliasConfigOpen}
            onClose={() => setAliasConfigOpen(false)}
          />

        </div>
      </AppLayout>
    );
  }

  // Patient detail view
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {patient.name.charAt(0).toUpperCase()}
              </div>
              <div>
                {editingName ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      className="h-8 w-48 text-base font-bold"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveName();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleSaveName}>
                      <Check className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingName(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <h1 className="text-xl font-bold">{patient.name}</h1>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEditName}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">
                    {sex === "M" ? "Masculino" : "Feminino"}
                  </Badge>
                  {patient.birth_date && (() => {
                    const today = new Date();
                    const birth = new Date(patient.birth_date);
                    const age = today.getFullYear() - birth.getFullYear() -
                      (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
                    return (
                      <Badge variant="outline" className="text-xs">
                        {age} anos
                      </Badge>
                    );
                  })()}
                  <span className="text-xs text-muted-foreground">
                    {sessions.length} sessão(ões)
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {/* Perfil do paciente */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setProfileOpen(true)}
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
              title="Editar perfil e objetivos do paciente"
            >
              <UserCircle2 className="mr-1.5 h-4 w-4" />
              {(patient?.objectives?.length ?? 0) > 0 ? `Perfil (${patient!.objectives!.length})` : "Perfil"}
            </Button>

            {sessions.length > 0 && (
              <>
                {/* Exportar PDF simples */}
                <Button variant="outline" size="sm" onClick={() => openReportEdit(false)}>
                  <FileDown className="mr-1.5 h-4 w-4" />
                  Exportar PDF
                </Button>

                {/* Seletor de especialidade + Análise IA */}
                <div className="flex items-center gap-1">
                  {availableSpecialties.length > 0 && (
                    <Select value={selectedSpecialty} onValueChange={setSelectedSpecialty}>
                      <SelectTrigger className="h-8 w-auto text-xs border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-50 gap-1 px-2">
                        <SelectValue>
                          {(() => {
                            const sp = availableSpecialties.find(s => s.specialty_id === selectedSpecialty);
                            return sp ? `${sp.specialty_icon} ${sp.specialty_name}` : selectedSpecialty;
                          })()}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {availableSpecialties.map((sp) => (
                          <SelectItem key={sp.specialty_id} value={sp.specialty_id}>
                            <span className="flex items-center gap-2">
                              <span>{sp.specialty_icon}</span>
                              <span>{sp.specialty_name}</span>
                              {sp.has_protocols && (
                                <span className="text-xs text-emerald-600">(+ Protocolos)</span>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateAnalysis}
                    disabled={isAnalyzing || isGeneratingProtocols}
                    className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                    title="Gera análise clínica dos exames com IA"
                  >
                    {isAnalyzing ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Brain className="mr-1.5 h-4 w-4" />
                    )}
                    {isAnalyzing ? "Analisando..." : "Análise IA"}
                  </Button>
                </div>

                {/* Protocolos Sugeridos com IA */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerateProtocols}
                  disabled={isAnalyzing || isGeneratingProtocols}
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  title="Gera recomendações de protocolos Essential com IA"
                >
                  {isGeneratingProtocols ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : (
                    <Syringe className="mr-1.5 h-4 w-4" />
                  )}
                  {isGeneratingProtocols ? "Gerando..." : "Protocolos IA"}
                </Button>
              </>
            )}

            <Button size="sm" onClick={openNewSession}>
              <Plus className="mr-1.5 h-4 w-4" />
              Nova Sessão
            </Button>
            <Button variant="destructive" size="icon" onClick={handleDeletePatient} title="Excluir paciente">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs for Sessions, Evolution and AI Analysis */}
        <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as "sessions" | "evolution" | "analysis")}>
          <TabsList>
            <TabsTrigger value="sessions" className="gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              Sessões
            </TabsTrigger>
            <TabsTrigger value="evolution" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Evolução
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-1.5">
              <Brain className="h-3.5 w-3.5" />
              Análise IA
              {savedAnalyses.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{savedAnalyses.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sessions" className="mt-4">
            {sessions.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <FlaskConical className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-lg font-medium">Nenhuma sessão registrada</p>
                  <p className="text-sm text-muted-foreground">
                    Clique em "Nova Sessão" para adicionar exames
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <Card key={session.id} className="transition-colors hover:bg-muted/30">
                    <CardContent className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <CalendarIcon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">
                            {format(parseISO(session.session_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Criado em {format(parseISO(session.created_at), "dd/MM/yyyy HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditSession(session)}
                          title="Editar"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteSession(session.id)}
                          title="Excluir"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="evolution" className="mt-4">
            <EvolutionTable patientId={patient.id} sessions={sessions} sex={sex} />
          </TabsContent>

          <TabsContent value="analysis" className="mt-4">
            {savedAnalyses.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Brain className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-lg font-medium">Nenhuma análise gerada ainda</p>
                  <p className="text-sm text-muted-foreground">
                    Clique em "✨ Análise IA" para gerar a primeira análise com IA
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* Selector de análises anteriores */}
                {savedAnalyses.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-medium">Histórico:</span>
                    {savedAnalyses.map((a, i) => (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAnalysis(a)}
                        className={cn(
                          "text-xs px-2 py-1 rounded-full border transition-colors",
                          selectedAnalysis?.id === a.id
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background hover:bg-muted border-border"
                        )}
                      >
                        {a.specialty_name ?? a.specialty_id} • {format(parseISO(a.created_at), "dd/MM/yy HH:mm")}
                      </button>
                    ))}
                  </div>
                )}

                {/* Conteúdo da análise selecionada */}
                {selectedAnalysis && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Brain className="h-4 w-4 text-primary" />
                            {selectedAnalysis.specialty_name ?? selectedAnalysis.specialty_id}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Gerado em {format(parseISO(selectedAnalysis.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const sessionIds = sessions.map(s => s.id);
                            supabase.from("lab_results").select("*").in("session_id", sessionIds).then(({ data }) => {
                              const results = (data || []).map(r => ({
                                marker_id: r.marker_id, session_id: r.session_id,
                                value: r.value ?? 0, text_value: r.text_value ?? undefined,
                                lab_ref_min: r.lab_ref_min ?? undefined, lab_ref_max: r.lab_ref_max ?? undefined, lab_ref_text: r.lab_ref_text ?? undefined,
                              }));
                              generatePatientReport(patient.name, sex, sessions, results, selectedAnalysis);
                            });
                          }}
                          className="gap-1.5"
                        >
                          <FileDown className="h-3.5 w-3.5" />
                          Exportar PDF
                        </Button>
                        {selectedAnalysis.prescription_table && (selectedAnalysis.prescription_table as any[]).length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              exportPrescriptionCSV(selectedAnalysis.prescription_table as any[], patient.name);
                              toast({ title: "Prescrição exportada como planilha!" });
                            }}
                            className="gap-1.5"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                            Prescrição (Planilha)
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* ── VISÃO GERAL ── */}
                      {selectedAnalysis.summary && (
                        <div className="rounded-lg bg-muted/50 p-4 border-l-4 border-primary">
                          <h3 className="font-bold text-sm text-primary mb-2 uppercase tracking-wide">Visão Geral</h3>
                          <p className="text-sm leading-relaxed">{selectedAnalysis.summary}</p>
                        </div>
                      )}

                      {/* ── PADRÕES CLÍNICOS ── */}
                      {selectedAnalysis.patterns && (selectedAnalysis.patterns as any[]).length > 0 && (
                        <div>
                          <h3 className="font-bold text-sm text-primary mb-2 uppercase tracking-wide">Padrões Clínicos Identificados</h3>
                          <ul className="space-y-1.5 ml-1">
                            {(selectedAnalysis.patterns as any[]).map((p: any, i: number) => {
                              const text = typeof p === "string" ? p : (p.name ? `${p.name}${p.description ? ` — ${p.description}` : ""}` : JSON.stringify(p));
                              return (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>{text}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {/* ── SUGESTÕES DE INVESTIGAÇÃO ── */}
                      {selectedAnalysis.suggestions && (selectedAnalysis.suggestions as any[]).length > 0 && (
                        <div>
                          <h3 className="font-bold text-sm text-primary mb-2 uppercase tracking-wide">Sugestões de Investigação Complementar</h3>
                          <ul className="space-y-1.5 ml-1">
                            {(selectedAnalysis.suggestions as any[]).map((s: any, i: number) => {
                              const text = typeof s === "string" ? s : (s.exam ?? s.name ?? JSON.stringify(s));
                              const reason = typeof s === "object" && s.reason ? ` — ${s.reason}` : "";
                              return (
                                <li key={i} className="flex items-start gap-2 text-sm">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>{text}{reason}</span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}

                      {/* ── DOC 1 — ANÁLISE TÉCNICA ── */}
                      {selectedAnalysis.technical_analysis && (
                        <div className="rounded-lg border bg-background p-4">
                          <h3 className="font-bold text-sm text-primary mb-3 uppercase tracking-wide">Documento 1 — Análise Técnica para o Médico</h3>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">
                            {selectedAnalysis.technical_analysis}
                          </div>
                        </div>
                      )}

                      {/* ── DOC 2 — PLANO DE CONDUTAS ── */}
                      {selectedAnalysis.patient_plan && (
                        <div className="rounded-lg border bg-background p-4">
                          <h3 className="font-bold text-sm text-primary mb-3 uppercase tracking-wide">Documento 2 — Plano de Condutas</h3>
                          <div className="text-sm leading-relaxed whitespace-pre-wrap">
                            {selectedAnalysis.patient_plan}
                          </div>
                        </div>
                      )}

                      {/* ── DOC 3 — PRESCRIÇÃO ── */}
                      {selectedAnalysis.prescription_table && (selectedAnalysis.prescription_table as any[]).length > 0 && (
                        <div>
                          <h3 className="font-bold text-sm text-primary mb-3 uppercase tracking-wide">Documento 3 — Prescrição Detalhada</h3>
                          <div className="overflow-x-auto rounded-lg border">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-primary text-primary-foreground">
                                  <th className="px-3 py-2 text-left font-semibold">Substância</th>
                                  <th className="px-3 py-2 text-left font-semibold">Dose</th>
                                  <th className="px-3 py-2 text-left font-semibold">Via</th>
                                  <th className="px-3 py-2 text-left font-semibold">Frequência</th>
                                  <th className="px-3 py-2 text-left font-semibold">Duração</th>
                                  <th className="px-3 py-2 text-left font-semibold">Condições/CI</th>
                                  <th className="px-3 py-2 text-left font-semibold">Monitorização</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(selectedAnalysis.prescription_table as any[]).map((row: any, i: number) => (
                                  <tr key={i} className={cn("border-t", i % 2 === 0 ? "bg-background" : "bg-muted/30")}>
                                    <td className="px-3 py-2 font-medium">{row.substancia ?? row.substance ?? ""}</td>
                                    <td className="px-3 py-2">{row.dose ?? ""}</td>
                                    <td className="px-3 py-2">{row.via ?? row.route ?? ""}</td>
                                    <td className="px-3 py-2">{row.frequencia ?? row.frequency ?? ""}</td>
                                    <td className="px-3 py-2">{row.duracao ?? row.duration ?? ""}</td>
                                    <td className="px-3 py-2">{row.condicoes_ci ?? row.conditions ?? ""}</td>
                                    <td className="px-3 py-2">{row.monitorizacao ?? row.monitoring ?? ""}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* ── PROTOCOLOS ESSENTIA ── */}
                      {selectedAnalysis.protocol_recommendations && (selectedAnalysis.protocol_recommendations as any[]).length > 0 && (
                        <div>
                          <h3 className="font-bold text-sm text-primary mb-3 uppercase tracking-wide">Protocolos Essentia Recomendados</h3>
                          <div className="space-y-3">
                            {(selectedAnalysis.protocol_recommendations as any[]).map((p: any, i: number) => (
                              <div key={i} className="rounded-lg border p-4 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-sm">
                                    {p.protocol_id && <span className="text-muted-foreground mr-1">{p.protocol_id} —</span>}
                                    {p.protocol_name ?? p.name}
                                  </span>
                                  {p.priority && (
                                    <Badge variant="outline" className={cn(
                                      "text-[10px] uppercase",
                                      p.priority?.toLowerCase() === "alta" && "border-red-500 text-red-600",
                                      p.priority?.toLowerCase() === "média" && "border-yellow-500 text-yellow-600",
                                      p.priority?.toLowerCase() === "baixa" && "border-blue-500 text-blue-600",
                                    )}>
                                      {p.priority}
                                    </Badge>
                                  )}
                                </div>
                                {(p.via || p.route) && (
                                  <p className="text-xs"><span className="font-medium text-muted-foreground">Via:</span> {p.via ?? p.route}</p>
                                )}
                                {(p.composicao || p.composition) && (
                                  <p className="text-xs"><span className="font-medium text-muted-foreground">Composição:</span> {p.composicao ?? p.composition}</p>
                                )}
                                {p.justification && (
                                  <p className="text-xs text-muted-foreground italic">{p.justification}</p>
                                )}
                                {p.key_actives && (p.key_actives as string[]).length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {(p.key_actives as string[]).map((a: string, j: number) => (
                                      <Badge key={j} variant="secondary" className="text-[10px]">{a}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ── DISCLAIMER ── */}
                      <div className="border-t pt-4 mt-4">
                        <p className="text-[10px] text-muted-foreground text-center italic leading-relaxed">
                          Esta análise foi gerada por inteligência artificial e tem caráter exclusivamente informativo e educacional.
                          Não substitui avaliação, diagnóstico ou prescrição médica. O profissional de saúde é o único responsável
                          pelas decisões clínicas. Modelo: {selectedAnalysis.model_used ?? "N/A"}.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
      {/* Edit report dialog (before PDF export) */}
      <EditReportDialog
        open={reportEditOpen}
        onClose={() => setReportEditOpen(false)}
        results={reportResults}
        sex={sex}
        onConfirm={handleReportConfirm}
      />

      {/* Patient profile / objectives dialog */}
      {patient && (
        <PatientProfileDialog
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          profile={{
            objectives: patient.objectives ?? [],
            activity_level: patient.activity_level ?? null,
            sport_modality: patient.sport_modality ?? null,
            main_complaints: patient.main_complaints ?? null,
            restrictions: patient.restrictions ?? null,
          }}
          onSave={handleSaveProfile}
        />
      )}
    </AppLayout>
  );
}

// ── Marker Input Component ──────────────────────────────────────────

function MarkerInput({
  marker,
  sex,
  value,
  onChange,
}: {
  marker: MarkerDef;
  sex: "M" | "F";
  value: string;
  onChange: (v: string) => void;
}) {
  if (marker.qualitative) {
    return (
      <div className="rounded-lg border p-3 transition-colors">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium">{marker.name}</label>
          <Badge variant="outline" className="text-[9px] h-4 px-1">Qualitativo</Badge>
        </div>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex: Negativo, Ausente, Normal..."
          className="h-8 text-sm"
        />
      </div>
    );
  }

  const [min, max] = marker.labRange[sex];  // referência laboratorial convencional
  const [fMin, fMax] = marker.refRange[sex]; // referência funcional (descritiva)
  const operatorMatch = value.match(/^([<>]=?)\s*(\d+[.,]?\d*)$/);
  const isOperatorValue = !!operatorMatch;
  const numVal = isOperatorValue ? parseFloat(operatorMatch![2].replace(",", ".")) : Number(value);
  const hasValue = value !== "" && !isNaN(numVal);
  const operator = isOperatorValue ? operatorMatch![1] : undefined;
  const status = hasValue ? getMarkerStatus(numVal, marker, sex, operator) : null;

  const borderColor =
    status === "normal"
      ? "border-emerald-400 focus-visible:ring-emerald-400"
      : status === "low" || status === "high"
      ? "border-red-400 focus-visible:ring-red-400"
      : "";

  const bgColor =
    status === "normal"
      ? "bg-emerald-50"
      : status === "low" || status === "high"
      ? "bg-red-50"
      : "";

  return (
    <div className={cn("rounded-lg border p-3 transition-colors", bgColor)}>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium">{marker.name}</label>
        <span className="text-[10px] text-muted-foreground">{marker.unit}</span>
      </div>
      <Input
        type={isOperatorValue ? "text" : "number"}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${min} – ${max}`}
        className={cn("h-8 text-sm", borderColor)}
      />
      <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground/80">Lab: {min} – {max}</span>
          {status && (
            <Badge
              variant="outline"
              className={cn(
                "h-4 px-1 text-[10px]",
                status === "normal" && "border-emerald-400 text-emerald-700",
                (status === "low" || status === "high") && "border-red-400 text-red-700"
              )}
            >
              {status === "normal" ? "✓" : status === "low" ? "↓ Baixo" : "↑ Alto"}
            </Badge>
          )}
        </div>
        {fMin !== fMax && (
          <span className="text-[9px] text-violet-500" title="Faixa funcional/ótima (medicina integrativa)">
            Funcional: {fMin} – {fMax}
          </span>
        )}
      </div>
    </div>
  );
}
