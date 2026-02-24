import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import EvolutionTable from "@/components/EvolutionTable";
import ImportVerification from "@/components/ImportVerification";
import { generatePatientReport } from "@/lib/generateReport";
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
  const [detailTab, setDetailTab] = useState<"sessions" | "evolution">("sessions");
  const [extracting, setExtracting] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [lastPdfText, setLastPdfText] = useState("");

  useEffect(() => {
    if (!id) return;
    fetchData();
  }, [id]);

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
    setFormOpen(true);
  };

  const openEditSession = async (session: LabSession) => {
    setEditingSessionId(session.id);
    setSessionDate(parseISO(session.session_date));

    // Load existing results
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
        // Update date
        await supabase
          .from("lab_sessions")
          .update({ session_date: format(sessionDate, "yyyy-MM-dd") })
          .eq("id", editingSessionId);

        // Delete old results to replace
        await supabase.from("lab_results").delete().eq("session_id", editingSessionId);
      } else {
        // Create new session
        const { data, error } = await supabase
          .from("lab_sessions")
          .insert({ patient_id: patient.id, session_date: format(sessionDate, "yyyy-MM-dd") })
          .select()
          .single();

        if (error) throw error;
        sessionId = data.id;
      }

      // Insert results for filled markers
      const allResults: { session_id: string; marker_id: string; value: number; text_value?: string }[] = [];
      
      Object.entries(markerValues).forEach(([markerId, v]) => {
        if (v === "") return;
        const marker = MARKERS.find(m => m.id === markerId);
        
        if (marker?.qualitative) {
          // Qualitative markers: store text_value
          allResults.push({
            session_id: sessionId!,
            marker_id: markerId,
            value: 0,
            text_value: v,
          });
        } else {
          // Numeric markers: check for operator prefix (e.g. "< 34", "> 90")
          const operatorMatch = v.match(/^([<>]=?)\s*(\d+[.,]?\d*)$/);
          if (operatorMatch) {
            const numericPart = Number(operatorMatch[2].replace(",", "."));
            if (!isNaN(numericPart)) {
              allResults.push({
                session_id: sessionId!,
                marker_id: markerId,
                value: numericPart,
                text_value: v, // preserve operator string
              });
            }
          } else if (!isNaN(Number(v))) {
            allResults.push({
              session_id: sessionId!,
              marker_id: markerId,
              value: Number(v),
            });
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

  const handleExportPdf = async () => {
    if (!patient) return;
    const sessionIds = sessions.map((s) => s.id);
    const { data } = await supabase
      .from("lab_results")
      .select("*")
      .in("session_id", sessionIds);
    generatePatientReport(
      patient.name,
      sex,
      sessions,
      (data || []).map((r) => ({ marker_id: r.marker_id, session_id: r.session_id, value: r.value ?? 0, text_value: r.text_value ?? undefined }))
    );
    toast({ title: "Relatório exportado!" });
  };

  const handleEditName = () => {
    if (!patient) return;
    setNameValue(patient.name);
    setEditingName(true);
  };

  const handleSaveName = async () => {
    if (!patient || !nameValue.trim()) return;
    const { error } = await supabase
      .from("patients")
      .update({ name: nameValue.trim() })
      .eq("id", patient.id);
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

  const handlePdfImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    setExtracting(true);
    try {
      // Extract text from PDF using PDF.js
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        // Preserve line structure by grouping items by Y position
        const items = content.items as any[];
        if (items.length === 0) continue;
        const lines: { y: number; items: { x: number; str: string }[] }[] = [];
        items.forEach((item) => {
          if (!item.str) return;
          const y = Math.round(item.transform[5]);
          const x = item.transform[4];
          let line = lines.find((l) => Math.abs(l.y - y) < 3);
          if (!line) {
            line = { y, items: [] };
            lines.push(line);
          }
          line.items.push({ x, str: item.str });
        });
        // Sort lines top to bottom (higher Y = higher on page)
        lines.sort((a, b) => b.y - a.y);
        lines.forEach((line) => {
          line.items.sort((a, b) => a.x - b.x);
          fullText += line.items.map((it) => it.str).join("  ") + "\n";
        });
        fullText += "\n--- Página " + i + " ---\n\n";
      }

      // Clean up text: remove repetitive headers, footers, and boilerplate
      const cleanedLines = fullText.split("\n").filter((line) => {
        const normalized = line.trim().replace(/\s+/g, " ");
        if (!normalized) return false;
        if (normalized.length < 3) return false;
        // Skip repeated headers/footers/boilerplate
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
        if (/^0[A-F0-9]{30,}/i.test(normalized)) return false; // digital signatures
        if (/^O valor preditivo/i.test(normalized)) return false;
        // Skip patient/lab identifying info repeated per page
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
        // Skip "Resultados Anteriores" lines and their date-value pairs
        if (/^Resultados? Anteriore?s?:/i.test(normalized)) return false;
        if (/^\d{2}\/\d{2}\/\d{4}\s*-\s*[\d<>,. ]+$/i.test(normalized)) return false;
        // Skip method/collection/release/review metadata (but keep "Material:" for context like "Urina 24h")
        if (/^Método:/i.test(normalized)) return false;
        if (/^Coleta:/i.test(normalized)) return false;
        if (/^Liberação:/i.test(normalized)) return false;
        if (/^Revisão:/i.test(normalized)) return false;
        if (/^Observações gerais:/i.test(normalized)) return false;
        if (/^Exame realizado pelo/i.test(normalized)) return false;
        // Skip reference notes/descriptions
        if (/^NOTA\s*\(?[0-9]*\)?:/i.test(normalized)) return false;
        if (/^Notas?:/i.test(normalized)) return false;
        if (/^Referências?:/i.test(normalized)) return false;
        if (/^Referência:/i.test(normalized)) return false;
        if (/^Atenção para nov/i.test(normalized)) return false;
        if (/^Limite de detecção/i.test(normalized)) return false;
        // Skip verbose clinical descriptions (but keep lines with qualitative results)
        // Allow lines containing known qualitative keywords
        const hasQualitative = /reagente|negativo|positivo|normal|ausente|presente|pastosa|líquida|amarelo|marrom|verde|turva|límpida/i.test(normalized);
        if (normalized.length > 120 && !/\d+[.,]\d+/.test(normalized) && !hasQualitative) return false;
        // Skip any line that is purely text description without numbers (>60 chars) — but keep qualitative results
        if (normalized.length > 60 && !/\d/.test(normalized) && !hasQualitative) return false;
        // Skip age/sex specific reference text
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
        // Skip Tanner stages
        if (/^Estágio de Tanner/i.test(normalized)) return false;
        // Skip newborn reference values
        if (/^Recém-nascido/i.test(normalized)) return false;
        if (/^\d+ dias?:/i.test(normalized)) return false;
        if (/^Sangue de cordão/i.test(normalized)) return false;
        // Skip boilerplate clinical notes
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
        // Skip more boilerplate
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
        if (/^VALOR DE REFERÊNCIA/i.test(normalized)) return false;
        if (/^Valores? de referência/i.test(normalized)) return false;
        if (/^mEq\/L|^mg\/dL|^ng\/mL|^pg\/mL|^µg\/dL|^U\/L|^mcg/i.test(normalized)) return false;
        // Skip lines that are just units or reference ranges
        if (/^\d+,?\d*\s*[-–a]\s*\d+,?\d*\s*(mg|g|microg|ng|pmol|nmol|mU|UI|U\/|fL|pg|%|mm|mcg|mEq)/i.test(normalized)) return false;
        if (/^\d+ a \d+$/i.test(normalized)) return false;
        if (normalized.length < 5 && !/\d/.test(normalized)) return false;
        return true;
      });
      const cleanedText = cleanedLines
        .map((l) => l.trim().replace(/\s+/g, " "))
        .filter((l) => !/^--- Página \d+/.test(l))
        .join("\n");

      if (!cleanedText.trim()) {
        toast({ title: "PDF vazio", description: "Não foi possível extrair texto do PDF.", variant: "destructive" });
        return;
      }

      console.log("PDF text length:", fullText.length, "-> cleaned:", cleanedText.length);

      // Send to AI edge function
      const { data, error } = await supabase.functions.invoke("extract-lab-results", {
        body: { pdfText: cleanedText },
      });

      if (error) throw error;

      const results = data?.results as { marker_id: string; value?: number; text_value?: string }[] | undefined;
      if (!results || results.length === 0) {
        toast({ title: "Nenhum marcador encontrado", description: "A IA não conseguiu identificar resultados no PDF.", variant: "destructive" });
        return;
      }

      // Pre-fill marker values (numeric and qualitative)
      // CRITICAL: For numeric markers, prefer `value` (already parsed by AI) over `text_value`
      // Only use text_value for: qualitative markers OR operator values (< > <= >=)
      const newValues = { ...markerValues };
      results.forEach((r) => {
        const marker = MARKERS.find(m => m.id === r.marker_id);
        if (marker?.qualitative) {
          // Qualitative markers: always use text_value
          if (r.text_value) newValues[r.marker_id] = r.text_value;
        } else if (r.text_value && /^[<>]=?\s*\d/.test(r.text_value.trim())) {
          // Operator value (e.g. "< 34", "> 90"): keep as text for display
          newValues[r.marker_id] = r.text_value.trim();
        } else if (r.value !== undefined && r.value !== null) {
          // Numeric marker: use the parsed numeric value (avoids Brazilian decimal issues)
          newValues[r.marker_id] = String(r.value);
        } else if (r.text_value) {
          // Fallback: use text_value if no numeric value
          newValues[r.marker_id] = r.text_value;
        }
      });
      setMarkerValues(newValues);
      setLastPdfText(cleanedText);
      setVerificationOpen(true);

      toast({ title: `${results.length} marcadores importados!`, description: "Revise os valores antes de salvar." });
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
          <div className="flex items-center justify-between">
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
            <div className="flex items-center gap-2">
              <Badge variant="outline">{filledCount} marcadores</Badge>
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handlePdfImport}
              />
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
                {extracting ? "Extraindo..." : "Importar PDF"}
              </Button>
              <Button onClick={handleSaveSession} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>

          {/* Date picker */}
          <div className="flex items-center gap-3">
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
                  onSelect={(d) => d && setSessionDate(d)}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Category tabs */}
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

        <ImportVerification
          open={verificationOpen}
          onClose={() => setVerificationOpen(false)}
          importedMarkers={markerValues}
          pdfText={lastPdfText}
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
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {sex === "M" ? "Masculino" : "Feminino"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {sessions.length} sessão(ões)
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {sessions.length > 0 && (
              <Button variant="outline" onClick={handleExportPdf}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            )}
            <Button onClick={openNewSession}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Sessão
            </Button>
            <Button variant="destructive" size="icon" onClick={handleDeletePatient} title="Excluir paciente">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tabs for Sessions and Evolution */}
        <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as "sessions" | "evolution")}>
          <TabsList>
            <TabsTrigger value="sessions" className="gap-1.5">
              <FlaskConical className="h-3.5 w-3.5" />
              Sessões
            </TabsTrigger>
            <TabsTrigger value="evolution" className="gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" />
              Evolução
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
                            {format(parseISO(session.session_date), "dd 'de' MMMM 'de' yyyy", {
                              locale: ptBR,
                            })}
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
        </Tabs>
      </div>
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

  const [min, max] = marker.refRange[sex];
  
  // Detect operator values like "< 34", "> 90"
  const operatorMatch = value.match(/^([<>]=?)\s*(\d+[.,]?\d*)$/);
  const isOperatorValue = !!operatorMatch;
  const numVal = isOperatorValue ? parseFloat(operatorMatch![2].replace(",", ".")) : Number(value);
  const hasValue = value !== "" && !isNaN(numVal);
  const operator = isOperatorValue ? operatorMatch![1] : undefined;
  const status = hasValue ? getMarkerStatus(numVal, marker, sex, operator) : null;

  const borderColor =
    status === "normal"
      ? "border-emerald-400 focus-visible:ring-emerald-400"
      : status === "low"
      ? "border-red-400 focus-visible:ring-red-400"
      : status === "high"
      ? "border-red-400 focus-visible:ring-red-400"
      : "";

  const bgColor =
    status === "normal"
      ? "bg-emerald-50"
      : status === "low"
      ? "bg-red-50"
      : status === "high"
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
      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          Ref: {min} – {max}
        </span>
        {status && (
          <Badge
            variant="outline"
            className={cn(
              "h-4 px-1 text-[10px]",
              status === "normal" && "border-emerald-400 text-emerald-700",
              status === "low" && "border-red-400 text-red-700",
              status === "high" && "border-red-400 text-red-700"
            )}
          >
            {status === "normal" ? "✓" : status === "low" ? "↓ Baixo" : "↑ Alto"}
          </Badge>
        )}
      </div>
    </div>
  );
}
