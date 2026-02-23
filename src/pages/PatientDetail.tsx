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
      vals[r.marker_id] = String(r.value);
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
      const results = Object.entries(markerValues)
        .filter(([, v]) => v !== "" && !isNaN(Number(v)))
        .map(([markerId, value]) => ({
          session_id: sessionId!,
          marker_id: markerId,
          value: Number(value),
        }));

      if (results.length > 0) {
        const { error } = await supabase.from("lab_results").insert(results);
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
      (data || []).map((r) => ({ marker_id: r.marker_id, session_id: r.session_id, value: r.value }))
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
    () => Object.values(markerValues).filter((v) => v !== "" && !isNaN(Number(v))).length,
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
        // Normalize multiple spaces into single for matching
        const normalized = line.trim().replace(/\s+/g, " ");
        if (!normalized) return false;
        if (normalized.length < 3) return false;
        // Skip repeated headers/footers/boilerplate from lab reports
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
        if (/^Página:/i.test(normalized)) return false;
        if (/^-{3,}/.test(normalized)) return false;
        if (/^={3,}/.test(normalized)) return false;
        // Skip verbose reference notes/descriptions
        if (/^NOTA\s*\(?[0-9]*\)?:/i.test(normalized)) return false;
        if (/^Referências?:/i.test(normalized)) return false;
        if (/^Atualização da Diretriz/i.test(normalized)) return false;
        if (/^Paciente de (baixo|risco|alto|muito)/i.test(normalized)) return false;
        if (/^(Desejável|Ótimo|Limítrofe|Alto|Muito alto)\s*:/i.test(normalized)) return false;
        if (/^(Com|Sem) (ou sem )?jejum/i.test(normalized)) return false;
        if (/^Maior ou igual a \d+ anos/i.test(normalized)) return false;
        if (/^Fem:|^Masc:/i.test(normalized)) return false;
        // Skip long descriptive lines (usually reference explanations)
        if (normalized.length > 150 && !/\d+[.,]\d+/.test(normalized)) return false;
        // Skip method descriptions
        if (/^Método:/i.test(normalized)) return false;
        // Skip "CARACTERES MORFOLÓGICOS" and related
        if (/^CARACTERES MORFOLÓGICOS/i.test(normalized)) return false;
        if (/^não foram observad/i.test(normalized)) return false;
        if (/^normais$/i.test(normalized)) return false;
        // Skip common boilerplate patterns from Brazilian labs
        if (/^pode interferir no resultado/i.test(normalized)) return false;
        if (/^suspensão da biotina/i.test(normalized)) return false;
        if (/^incompatibilidade do resultado/i.test(normalized)) return false;
        if (/^contatar o Laboratório/i.test(normalized)) return false;
        if (/^interferir neste exame/i.test(normalized)) return false;
        if (/^no resultado deste exame/i.test(normalized)) return false;
        if (/^caso de incompatibilidade/i.test(normalized)) return false;
        if (/^suspensão do uso/i.test(normalized)) return false;
        if (/^concentrações séricas/i.test(normalized)) return false;
        if (/^avaliado em conjunto/i.test(normalized)) return false;
        if (/^deve ser preferencialmente/i.test(normalized)) return false;
        if (/^Standards of Medical/i.test(normalized)) return false;
        if (/^Diabetes Care/i.test(normalized)) return false;
        if (/^Na ausência de hiperglicemia/i.test(normalized)) return false;
        if (/^resistência à insulina/i.test(normalized)) return false;
        if (/^Cálculo baseado nos/i.test(normalized)) return false;
        if (/^Vermeulen/i.test(normalized)) return false;
        if (/^estudo com \d+ mil amostras/i.test(normalized)) return false;
        if (/^impedância, com confirmação/i.test(normalized)) return false;
        if (/^morfológica realizad/i.test(normalized)) return false;
        if (/^laudo foram estabelecidos/i.test(normalized)) return false;
        if (/^definidos valores de metas/i.test(normalized)) return false;
        if (/^da Aterosclerose/i.test(normalized)) return false;
        if (/^Sociedade Brasileira/i.test(normalized)) return false;
        if (/^Brasileira de Cardiologia/i.test(normalized)) return false;
        if (/^condições de coleta/i.test(normalized)) return false;
        if (/^critério médico/i.test(normalized)) return false;
        if (/^abstinência de bebidas/i.test(normalized)) return false;
        if (/^repetição após/i.test(normalized)) return false;
        if (/^eventualidade de/i.test(normalized)) return false;
        if (/^neste laudo/i.test(normalized)) return false;
        if (/^para doença autoimune/i.test(normalized)) return false;
        if (/^anticorpos anti/i.test(normalized)) return false;
        if (/^variações entre valores/i.test(normalized)) return false;
        if (/^resultado conflitante/i.test(normalized)) return false;
        if (/^favor contatar/i.test(normalized)) return false;
        if (/^assessoria médica/i.test(normalized)) return false;
        if (/^massas em tandem/i.test(normalized)) return false;
        if (/^de valores elevados/i.test(normalized)) return false;
        if (/^como hormônios ester/i.test(normalized)) return false;
        if (/^tais medicações/i.test(normalized)) return false;
        if (/^Esse valor de hemoglobina/i.test(normalized)) return false;
        if (/^Indivíduos (sem|com) diabetes/i.test(normalized)) return false;
        if (/^A meta de A1C/i.test(normalized)) return false;
        if (/^Menor que \d|^Maior que \d|^Maior ou igual a \d/i.test(normalized)) return false;
        if (/^\d+,?\d* a \d+,?\d* (mg|g|microg|ng|pmol|nmol|mU|UI|U\/|fL|pg|%|mm)/i.test(normalized)) return false;
        // Skip lines that are purely age/sex reference ranges
        if (/^De \d+ a \d+ anos/i.test(normalized)) return false;
        if (/^Acima de \d+ anos/i.test(normalized)) return false;
        if (/^Até \d+ anos/i.test(normalized)) return false;
        if (/^Crianças/i.test(normalized)) return false;
        if (/^Gestantes/i.test(normalized)) return false;
        if (/^1\.o trimestre|^2\.o trimestre|^3\.o trimestre/i.test(normalized)) return false;
        if (/^Adultos:/i.test(normalized)) return false;
        if (/^Homens:|^Mulheres:/i.test(normalized)) return false;
        if (/^Fase Folicular|^Pico Ovulatório|^Fase Lútea|^Menopausa/i.test(normalized)) return false;
        if (/^Colhido as \d/i.test(normalized)) return false;
        if (/^Condições basais/i.test(normalized)) return false;
        if (/^Para condições basais/i.test(normalized)) return false;
        if (/^por \d+[.,]\d+/i.test(normalized)) return false;
        if (/^de \d+ anos de idade/i.test(normalized)) return false;
        // Skip lines with only reference range numbers
        if (/^\d+ a \d+$/i.test(normalized)) return false;
        // Skip lines that are just units or short noise
        if (normalized.length < 5 && !/\d/.test(normalized)) return false;
        return true;
      });
      // Also collapse "--- Página X ---" markers into minimal separators
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

      const results = data?.results as { marker_id: string; value: number }[] | undefined;
      if (!results || results.length === 0) {
        toast({ title: "Nenhum marcador encontrado", description: "A IA não conseguiu identificar resultados no PDF.", variant: "destructive" });
        return;
      }

      // Pre-fill marker values
      const newValues = { ...markerValues };
      results.forEach((r) => {
        newValues[r.marker_id] = String(r.value);
      });
      setMarkerValues(newValues);

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
  const [min, max] = marker.refRange[sex];
  const numVal = Number(value);
  const hasValue = value !== "" && !isNaN(numVal);
  const status = hasValue ? getMarkerStatus(numVal, marker, sex) : null;

  const borderColor =
    status === "normal"
      ? "border-emerald-400 focus-visible:ring-emerald-400"
      : status === "low"
      ? "border-blue-400 focus-visible:ring-blue-400"
      : status === "high"
      ? "border-red-400 focus-visible:ring-red-400"
      : "";

  const bgColor =
    status === "normal"
      ? "bg-emerald-50"
      : status === "low"
      ? "bg-blue-50"
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
        type="number"
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
              status === "low" && "border-blue-400 text-blue-700",
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
