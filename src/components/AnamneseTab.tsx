import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Save, ClipboardList, Heart, Leaf, Activity, Microscope, Loader2, CheckCircle2, Upload, FileText, ChevronDown, ChevronUp } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Anamnese = Tables<"patient_anamneses">;
type Patient = Tables<"patients">;

interface AnamneseTabProps {
  patient: Patient;
}

const SPECIALTIES = [
  { id: "medicina_funcional", label: "Medicina Funcional", icon: <Microscope className="h-4 w-4" /> },
  { id: "nutrologia", label: "Nutrologia", icon: <Leaf className="h-4 w-4" /> },
  { id: "endocrinologia", label: "Endocrinologia", icon: <Activity className="h-4 w-4" /> },
  { id: "cardiologia", label: "Cardiologia", icon: <Heart className="h-4 w-4" /> },
];

const SINTOMAS_CHECKLIST = [
  "Compulsão por doces", "Compulsão por pães e massas", "Enxaqueca", "Dores musculares",
  "Queda de cabelo", "Acne", "Inchaço", "Dor articular", "Ansiedade", "Depressão",
  "Fadiga", "Intestino preso", "Diarréia", "Libido baixa", "Alteração de memória",
  "Sede excessiva", "Fome constante", "Alterações de humor", "Sono excessivo",
  "Falta de bem estar", "Dores no corpo", "Gastrite", "Candidíase",
  "Rinites/otites/sinusites", "Urticária", "Pedra na vesícula", "Pigarro", "Halitose",
  "Dores abdominais", "Psoríase", "Rosácea", "Hemorróida", "Restos de comidas nas fezes",
  "Osteoporose ou osteopenia", "Respiração curta", "Erupção cutânea",
  "Gengivite ou sensibilidade dentária", "Rachadura no canto dos lábios",
  "Circulação prejudicada", "Ardência ao urinar", "Refluxo",
];

const HABITOS_OPTIONS = ["Etilismo", "Tabagismo", "Adicção"];

const TIPO_FEZES_OPTIONS = [
  { value: "1", label: "Tipo 1 — Caroços duros (obstipação grave)" },
  { value: "2", label: "Tipo 2 — Formato de salsicha com grumos" },
  { value: "3", label: "Tipo 3 — Formato de salsicha com fissuras" },
  { value: "4", label: "Tipo 4 — Formato de salsicha liso (normal)" },
  { value: "5", label: "Tipo 5 — Pedaços macios (normal)" },
  { value: "6", label: "Tipo 6 — Pedaços fofos com bordas irregulares" },
  { value: "7", label: "Tipo 7 — Líquido/diarreia" },
];

type AnamneseForm = Omit<Anamnese, "id" | "created_at" | "updated_at">;

const emptyForm = (patientId: string, specialtyId: string): AnamneseForm => ({
  patient_id: patientId,
  specialty_id: specialtyId,
  expectativa_consulta: null,
  queixas_principais: null,
  objetivos: null,
  nota_saude: null,
  o_que_melhoraria: null,
  fase_melhor: null,
  evento_marcante: null,
  comorbidades: null,
  peso_altura: null,
  suplementacao: null,
  medicamentos_continuos: null,
  tipo_sanguineo: null,
  estado_pele: null,
  estado_cabelos: null,
  estado_unhas: null,
  memoria_concentracao: null,
  imunidade: null,
  consumo_cafe: null,
  habitos: null,
  sintomas_atuais: null,
  evacuacoes_por_dia: null,
  tipo_fezes: null,
  uso_antibiotico_2anos: null,
  estufamento_gases: null,
  litros_agua_dia: null,
  dorme_bem: null,
  horario_sono: null,
  acorda_cansado: null,
  dificuldade_dormir: null,
  nivel_estresse: null,
  faz_terapia: null,
  atividade_relaxamento: null,
  hobbies: null,
  atividade_fisica: null,
  recordatorio_alimentar: null,
  intolerancias_alimentares: null,
  episodios_compulsao: null,
  culpa_apos_comer: null,
  preferencias_alimentares: null,
  aversoes_alimentares: null,
  ciclo_regular: null,
  metodo_contraceptivo: null,
  deseja_engravidar: null,
  tem_tpm: null,
  specialty_data: null,
});

export function AnamneseTab({ patient }: AnamneseTabProps) {
  const { toast } = useToast();
  const [activeSpecialty, setActiveSpecialty] = useState("medicina_funcional");
  const [forms, setForms] = useState<Record<string, AnamneseForm>>({});
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  // Importação de anamnese do paciente
  const [importTexts, setImportTexts] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState<Record<string, boolean>>({});
  const [showImport, setShowImport] = useState<Record<string, boolean>>({});

  // Carrega anamneses existentes do banco
  useEffect(() => {
    const loadAnamneses = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("patient_anamneses")
        .select("*")
        .eq("patient_id", patient.id);

      if (!error && data) {
        const formsMap: Record<string, AnamneseForm> = {};
        const idsMap: Record<string, string> = {};
        for (const row of data) {
          const { id, created_at, updated_at, ...rest } = row;
          formsMap[row.specialty_id] = rest;
          idsMap[row.specialty_id] = id;
        }
        setForms(formsMap);
        setSavedIds(idsMap);
      }
      setLoading(false);
    };
    loadAnamneses();
  }, [patient.id]);

  const getForm = (specialtyId: string): AnamneseForm =>
    forms[specialtyId] ?? emptyForm(patient.id, specialtyId);

  const updateField = (specialtyId: string, field: keyof AnamneseForm, value: unknown) => {
    setForms(prev => ({
      ...prev,
      [specialtyId]: {
        ...(prev[specialtyId] ?? emptyForm(patient.id, specialtyId)),
        [field]: value,
      },
    }));
  };

  const toggleSintoma = (specialtyId: string, sintoma: string) => {
    const current = getForm(specialtyId).sintomas_atuais ?? [];
    const updated = current.includes(sintoma)
      ? current.filter(s => s !== sintoma)
      : [...current, sintoma];
    updateField(specialtyId, "sintomas_atuais", updated);
  };

  const toggleHabito = (specialtyId: string, habito: string) => {
    const current = getForm(specialtyId).habitos ?? [];
    const updated = current.includes(habito)
      ? current.filter(h => h !== habito)
      : [...current, habito];
    updateField(specialtyId, "habitos", updated);
  };

  const handleImportAnamnese = async (specialtyId: string) => {
    const text = importTexts[specialtyId]?.trim();
    if (!text) {
      toast({ title: "Campo vazio", description: "Cole o texto da anamnese do paciente antes de importar.", variant: "destructive" });
      return;
    }
    setImporting(prev => ({ ...prev, [specialtyId]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("parse-patient-anamnese", {
        body: { text, specialty_id: specialtyId },
      });
      if (error) throw error;
      if (data?.fields) {
        const parsed = data.fields as Partial<AnamneseForm>;
        setForms(prev => ({
          ...prev,
          [specialtyId]: {
            ...(prev[specialtyId] ?? emptyForm(patient.id, specialtyId)),
            ...parsed,
            patient_id: patient.id,
            specialty_id: specialtyId,
          },
        }));
        toast({
          title: "✅ Anamnese importada!",
          description: `${Object.keys(parsed).length} campos preenchidos automaticamente. Revise e salve.`,
        });
        setShowImport(prev => ({ ...prev, [specialtyId]: false }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao processar";
      toast({ title: "Erro na importação", description: message, variant: "destructive" });
    } finally {
      setImporting(prev => ({ ...prev, [specialtyId]: false }));
    }
  };

  const handleSave = async (specialtyId: string) => {
    setSaving(true);
    const form = getForm(specialtyId);
    const existingId = savedIds[specialtyId];

    try {
      if (existingId) {
        const { error } = await (supabase as any)
          .from("patient_anamneses")
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("patient_anamneses")
          .insert(form)
          .select("id")
          .single();
        if (error) throw error;
        setSavedIds(prev => ({ ...prev, [specialtyId]: data.id }));
      }
      toast({ title: "✅ Anamnese salva!", description: `Anamnese de ${SPECIALTIES.find(s => s.id === specialtyId)?.label} salva com sucesso.` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao salvar", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeSpecialty} onValueChange={setActiveSpecialty}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent p-0">
          {SPECIALTIES.map(sp => (
            <TabsTrigger
              key={sp.id}
              value={sp.id}
              className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              {sp.icon}
              {sp.label}
              {savedIds[sp.id] && (
                <CheckCircle2 className="h-3 w-3 text-green-500 data-[state=active]:text-green-300" />
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {SPECIALTIES.map(sp => {
          const form = getForm(sp.id);
          return (
            <TabsContent key={sp.id} value={sp.id} className="mt-4 space-y-4">
              {/* Cabeçalho da especialidade */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">Anamnese — {sp.label}</h3>
                  {savedIds[sp.id] && (
                    <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                      Salva
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowImport(prev => ({ ...prev, [sp.id]: !prev[sp.id] }))}
                  >
                    <FileText className="h-4 w-4" />
                    Importar do Paciente
                    {showImport[sp.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                  <Button
                    onClick={() => handleSave(sp.id)}
                    disabled={saving}
                    size="sm"
                    className="gap-1.5"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar Anamnese
                  </Button>
                </div>
              </div>

              {/* ── IMPORTAÇÃO DE ANAMNESE DO PACIENTE ── */}
              {showImport[sp.id] && (
                <Card className="border-blue-200 bg-blue-50/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Importar Anamnese Preenchida pelo Paciente
                    </CardTitle>
                    <p className="text-xs text-blue-600 mt-1">
                      Cole abaixo o texto das respostas do paciente (Google Forms, e-mail, WhatsApp, etc.).
                      A IA irá extrair e preencher os campos automaticamente. Você poderá revisar antes de salvar.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      placeholder="Cole aqui as respostas do paciente...\n\nExemplo:\nNome: Maria Silva\nQueixas: cansaço, queda de cabelo, dificuldade para emagrecer\nNota de saúde: 6\nDorme bem: não, acordo às 3h da manhã\n..."
                      value={importTexts[sp.id] ?? ""}
                      onChange={e => setImportTexts(prev => ({ ...prev, [sp.id]: e.target.value }))}
                      rows={8}
                      className="bg-white font-mono text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowImport(prev => ({ ...prev, [sp.id]: false }))}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 bg-blue-600 hover:bg-blue-700"
                        onClick={() => handleImportAnamnese(sp.id)}
                        disabled={importing[sp.id] || !importTexts[sp.id]?.trim()}
                      >
                        {importing[sp.id] ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
                        ) : (
                          <><Upload className="h-4 w-4" /> Extrair e Preencher com IA</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── SEÇÃO 1: Objetivos e Queixas ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Objetivos e Queixas
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Expectativa da consulta</Label>
                    <Textarea
                      placeholder="O quê você espera da Dra. Bárbara como médica para essa consulta?"
                      value={form.expectativa_consulta ?? ""}
                      onChange={e => updateField(sp.id, "expectativa_consulta", e.target.value || null)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Queixas principais</Label>
                    <Textarea
                      placeholder="Quais são as suas queixas principais?"
                      value={form.queixas_principais ?? ""}
                      onChange={e => updateField(sp.id, "queixas_principais", e.target.value || null)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Objetivos do paciente</Label>
                    <Textarea
                      placeholder="Quais são os seus objetivos? (emagrecimento, energia, saúde hormonal, etc.)"
                      value={form.objetivos ?? ""}
                      onChange={e => updateField(sp.id, "objetivos", e.target.value || null)}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── SEÇÃO 2: Histórico de Saúde ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Histórico de Saúde
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Nota de saúde (0–10): <span className="font-bold text-primary">{form.nota_saude ?? "—"}</span></Label>
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[form.nota_saude ?? 5]}
                      onValueChange={([v]) => updateField(sp.id, "nota_saude", v)}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0 — Péssima</span><span>10 — Excelente</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>O que precisaria acontecer para aumentar 1 ponto?</Label>
                    <Textarea
                      value={form.o_que_melhoraria ?? ""}
                      onChange={e => updateField(sp.id, "o_que_melhoraria", e.target.value || null)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Já houve uma fase em que se sentia muito melhor? Quando?</Label>
                    <Textarea
                      value={form.fase_melhor ?? ""}
                      onChange={e => updateField(sp.id, "fase_melhor", e.target.value || null)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Evento marcante nessa época (luto, gravidez, infecção, estresse)?</Label>
                    <Textarea
                      value={form.evento_marcante ?? ""}
                      onChange={e => updateField(sp.id, "evento_marcante", e.target.value || null)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Comorbidades, cirurgias, histórico familiar</Label>
                    <Textarea
                      value={form.comorbidades ?? ""}
                      onChange={e => updateField(sp.id, "comorbidades", e.target.value || null)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Peso e Altura</Label>
                    <Input
                      placeholder="Ex: 70kg / 1,70m"
                      value={form.peso_altura ?? ""}
                      onChange={e => updateField(sp.id, "peso_altura", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo Sanguíneo</Label>
                    <Input
                      placeholder="Ex: A+, O-, B+"
                      value={form.tipo_sanguineo ?? ""}
                      onChange={e => updateField(sp.id, "tipo_sanguineo", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Suplementação atual (com dosagens)</Label>
                    <Textarea
                      placeholder="Ex: Vitamina D 5000UI, Ômega 3 2g..."
                      value={form.suplementacao ?? ""}
                      onChange={e => updateField(sp.id, "suplementacao", e.target.value || null)}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Medicamentos contínuos (com dosagens)</Label>
                    <Textarea
                      placeholder="Ex: Levotiroxina 50mcg, Metformina 500mg..."
                      value={form.medicamentos_continuos ?? ""}
                      onChange={e => updateField(sp.id, "medicamentos_continuos", e.target.value || null)}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── SEÇÃO 3: Avaliação Tegumentar e Cognitiva ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Avaliação Tegumentar e Cognitiva
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Como está a pele?</Label>
                    <Input
                      placeholder="Ex: ressecada, oleosa, com manchas..."
                      value={form.estado_pele ?? ""}
                      onChange={e => updateField(sp.id, "estado_pele", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Como estão os cabelos?</Label>
                    <Input
                      placeholder="Ex: queda, ressecados, oleosos..."
                      value={form.estado_cabelos ?? ""}
                      onChange={e => updateField(sp.id, "estado_cabelos", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Como estão as unhas?</Label>
                    <Input
                      placeholder="Ex: frágeis, com manchas, descamando..."
                      value={form.estado_unhas ?? ""}
                      onChange={e => updateField(sp.id, "estado_unhas", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Memória e concentração</Label>
                    <Input
                      placeholder="Ex: dificuldade de foco, esquecimento frequente..."
                      value={form.memoria_concentracao ?? ""}
                      onChange={e => updateField(sp.id, "memoria_concentracao", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Imunidade</Label>
                    <Input
                      placeholder="Ex: adoece com frequência, infecções recorrentes..."
                      value={form.imunidade ?? ""}
                      onChange={e => updateField(sp.id, "imunidade", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Consumo de café por dia</Label>
                    <Input
                      placeholder="Ex: 2 cafés, nenhum, 4 ou mais..."
                      value={form.consumo_cafe ?? ""}
                      onChange={e => updateField(sp.id, "consumo_cafe", e.target.value || null)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── SEÇÃO 4: Hábitos ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Hábitos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Hábitos a mencionar</Label>
                    <div className="flex flex-wrap gap-3">
                      {HABITOS_OPTIONS.map(h => (
                        <div key={h} className="flex items-center gap-2">
                          <Checkbox
                            id={`habito-${sp.id}-${h}`}
                            checked={(form.habitos ?? []).includes(h)}
                            onCheckedChange={() => toggleHabito(sp.id, h)}
                          />
                          <label htmlFor={`habito-${sp.id}-${h}`} className="text-sm cursor-pointer">{h}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Sintomas atuais <span className="text-muted-foreground text-xs">(selecione todos que se aplicam)</span></Label>
                    <div className="flex flex-wrap gap-2">
                      {SINTOMAS_CHECKLIST.map(s => {
                        const checked = (form.sintomas_atuais ?? []).includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleSintoma(sp.id, s)}
                            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                              checked
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-foreground border-border hover:bg-muted"
                            }`}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                    {(form.sintomas_atuais ?? []).length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {(form.sintomas_atuais ?? []).length} sintoma(s) selecionado(s)
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* ── SEÇÃO 5: Hábito Intestinal ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Hábito Intestinal
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Evacuações por dia</Label>
                    <Input
                      placeholder="Ex: 1x, 2x, menos de 1x por dia..."
                      value={form.evacuacoes_por_dia ?? ""}
                      onChange={e => updateField(sp.id, "evacuacoes_por_dia", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de fezes (Escala de Bristol)</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.tipo_fezes ?? ""}
                      onChange={e => updateField(sp.id, "tipo_fezes", e.target.value || null)}
                    >
                      <option value="">Selecione...</option>
                      {TIPO_FEZES_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Uso de antibiótico nos últimos 2 anos?</Label>
                    <Input
                      placeholder="Sim / Não / Quantas vezes..."
                      value={form.uso_antibiotico_2anos ?? ""}
                      onChange={e => updateField(sp.id, "uso_antibiotico_2anos", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Estufamento após refeições / gases?</Label>
                    <Input
                      placeholder="Sim, após almoço / Não / Sempre à noite..."
                      value={form.estufamento_gases ?? ""}
                      onChange={e => updateField(sp.id, "estufamento_gases", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Litros de água por dia</Label>
                    <Input
                      placeholder="Ex: 1L, 2L, menos de 1L..."
                      value={form.litros_agua_dia ?? ""}
                      onChange={e => updateField(sp.id, "litros_agua_dia", e.target.value || null)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── SEÇÃO 6: Sono e Estresse ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Sono e Estresse
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Dorme bem?</Label>
                    <Input
                      placeholder="Sim / Não / Às vezes..."
                      value={form.dorme_bem ?? ""}
                      onChange={e => updateField(sp.id, "dorme_bem", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Horário de sono (dorme/acorda)</Label>
                    <Input
                      placeholder="Ex: 23h às 7h, 00h às 6h..."
                      value={form.horario_sono ?? ""}
                      onChange={e => updateField(sp.id, "horario_sono", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Acorda cansado ou disposto?</Label>
                    <Input
                      placeholder="Cansado / Disposto / Depende do dia..."
                      value={form.acorda_cansado ?? ""}
                      onChange={e => updateField(sp.id, "acorda_cansado", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Dificuldade para dormir ou acordar?</Label>
                    <Input
                      placeholder="Sim, dificuldade para pegar no sono / acorda de madrugada..."
                      value={form.dificuldade_dormir ?? ""}
                      onChange={e => updateField(sp.id, "dificuldade_dormir", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Nível de estresse (0–10): <span className="font-bold text-primary">{form.nivel_estresse ?? "—"}</span></Label>
                    <Slider
                      min={0}
                      max={10}
                      step={1}
                      value={[form.nivel_estresse ?? 5]}
                      onValueChange={([v]) => updateField(sp.id, "nivel_estresse", v)}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0 — Sem estresse</span><span>10 — Estresse máximo</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Faz terapia?</Label>
                    <Input
                      placeholder="Sim / Não / Já fiz..."
                      value={form.faz_terapia ?? ""}
                      onChange={e => updateField(sp.id, "faz_terapia", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Atividade de relaxamento</Label>
                    <Input
                      placeholder="Meditação, yoga, respiração, nenhuma..."
                      value={form.atividade_relaxamento ?? ""}
                      onChange={e => updateField(sp.id, "atividade_relaxamento", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hobbies</Label>
                    <Input
                      placeholder="Leitura, música, culinária..."
                      value={form.hobbies ?? ""}
                      onChange={e => updateField(sp.id, "hobbies", e.target.value || null)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── SEÇÃO 7: Atividade Física ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Atividade Física
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    <Label>Atividade física praticada e frequência semanal</Label>
                    <Textarea
                      placeholder="Ex: Musculação 3x/semana, caminhada 30min/dia, sedentário..."
                      value={form.atividade_fisica ?? ""}
                      onChange={e => updateField(sp.id, "atividade_fisica", e.target.value || null)}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── SEÇÃO 8: Alimentação ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Alimentação
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Recordatório alimentar (do acordar ao dormir)</Label>
                    <Textarea
                      placeholder="Ex: Café da manhã: ovo mexido + café com leite. Almoço: arroz, feijão, frango..."
                      value={form.recordatorio_alimentar ?? ""}
                      onChange={e => updateField(sp.id, "recordatorio_alimentar", e.target.value || null)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Intolerâncias alimentares</Label>
                    <Input
                      placeholder="Lactose, glúten, frutos do mar, nenhuma..."
                      value={form.intolerancias_alimentares ?? ""}
                      onChange={e => updateField(sp.id, "intolerancias_alimentares", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Episódios de compulsão alimentar</Label>
                    <Input
                      placeholder="Sim, frequente / Às vezes / Não..."
                      value={form.episodios_compulsao ?? ""}
                      onChange={e => updateField(sp.id, "episodios_compulsao", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Sente culpa após comer?</Label>
                    <Input
                      placeholder="Sim / Não / Às vezes..."
                      value={form.culpa_apos_comer ?? ""}
                      onChange={e => updateField(sp.id, "culpa_apos_comer", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>O que mais gosta de comer?</Label>
                    <Input
                      placeholder="Doces, massas, carnes, frutas..."
                      value={form.preferencias_alimentares ?? ""}
                      onChange={e => updateField(sp.id, "preferencias_alimentares", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>O que não gosta de comer?</Label>
                    <Input
                      placeholder="Verduras, peixe, legumes..."
                      value={form.aversoes_alimentares ?? ""}
                      onChange={e => updateField(sp.id, "aversoes_alimentares", e.target.value || null)}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── SEÇÃO 9: Ciclo Menstrual (apenas para pacientes do sexo F) ── */}
              {patient.sex === "F" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Ciclo Menstrual
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Como é o ciclo? Regular?</Label>
                      <Input
                        placeholder="Regular 28 dias / Irregular / Amenorreia..."
                        value={form.ciclo_regular ?? ""}
                        onChange={e => updateField(sp.id, "ciclo_regular", e.target.value || null)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Método contraceptivo</Label>
                      <Input
                        placeholder="Pílula, DIU, nenhum, preservativo..."
                        value={form.metodo_contraceptivo ?? ""}
                        onChange={e => updateField(sp.id, "metodo_contraceptivo", e.target.value || null)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Deseja engravidar?</Label>
                      <Input
                        placeholder="Sim, em 2 anos / Não / Já tem filhos..."
                        value={form.deseja_engravidar ?? ""}
                        onChange={e => updateField(sp.id, "deseja_engravidar", e.target.value || null)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tem TPM?</Label>
                      <Input
                        placeholder="Sim, intensa / Leve / Não..."
                        value={form.tem_tpm ?? ""}
                        onChange={e => updateField(sp.id, "tem_tpm", e.target.value || null)}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ── SEÇÃO 10: Campos específicos por especialidade ── */}
              {sp.id === "cardiologia" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Cardiologia — Dados Específicos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Pressão arterial habitual</Label>
                      <Input
                        placeholder="Ex: 120/80, hipertenso, não sabe..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).pressao_arterial ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), pressao_arterial: e.target.value || undefined })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Histórico familiar cardiovascular</Label>
                      <Input
                        placeholder="Pai com infarto, mãe com AVC..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).historico_familiar_cv ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), historico_familiar_cv: e.target.value || undefined })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Sintomas cardiovasculares</Label>
                      <Textarea
                        placeholder="Palpitações, dor no peito, falta de ar, tontura..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).sintomas_cardiacos ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), sintomas_cardiacos: e.target.value || undefined })}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Exames cardiológicos anteriores</Label>
                      <Textarea
                        placeholder="ECG, ecocardiograma, teste ergométrico..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).exames_cardio_anteriores ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), exames_cardio_anteriores: e.target.value || undefined })}
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {sp.id === "nutrologia" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Nutrologia — Dados Específicos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Circunferência abdominal</Label>
                      <Input
                        placeholder="Ex: 85cm, não mediu..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).circunferencia_abdominal ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), circunferencia_abdominal: e.target.value || undefined })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Dietas anteriores tentadas</Label>
                      <Input
                        placeholder="Low carb, jejum intermitente, cetogênica..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).dietas_anteriores ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), dietas_anteriores: e.target.value || undefined })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Relação emocional com a comida</Label>
                      <Textarea
                        placeholder="Come por ansiedade, recompensa emocional, sem relação..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).relacao_emocional_comida ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), relacao_emocional_comida: e.target.value || undefined })}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Histórico de variação de peso</Label>
                      <Textarea
                        placeholder="Engordou 10kg após gravidez, perde e ganha facilmente..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).historico_peso ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), historico_peso: e.target.value || undefined })}
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {sp.id === "endocrinologia" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Endocrinologia — Dados Específicos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Sintomas de tireoide</Label>
                      <Textarea
                        placeholder="Intolerância ao frio/calor, ganho de peso, queda de cabelo, palpitações..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).sintomas_tireoide ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), sintomas_tireoide: e.target.value || undefined })}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Sintomas de eixo adrenal</Label>
                      <Textarea
                        placeholder="Fadiga ao acordar, hipoglicemia, dificuldade de lidar com estresse..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).sintomas_adrenal ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), sintomas_adrenal: e.target.value || undefined })}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Histórico hormonal</Label>
                      <Textarea
                        placeholder="Uso de hormônios, reposição, anticoncepcional hormonal, histórico de diabetes..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).historico_hormonal ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), historico_hormonal: e.target.value || undefined })}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Sintomas de resistência insulínica</Label>
                      <Textarea
                        placeholder="Fome constante, compulsão por doces, acantose nigricans, SOP..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).sintomas_insulina ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), sintomas_insulina: e.target.value || undefined })}
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {sp.id === "medicina_funcional" && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                      Medicina Funcional — Dados Específicos
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label>Timeline de eventos de saúde (cronologia)</Label>
                      <Textarea
                        placeholder="Ex: 2015 — início da fadiga após infecção viral. 2018 — diagnóstico de hipotireoidismo. 2022 — piora após estresse no trabalho..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).timeline_eventos ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), timeline_eventos: e.target.value || undefined })}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Exposições ambientais</Label>
                      <Textarea
                        placeholder="Mofo em casa, agrotóxicos, amálgamas dentárias, plásticos, qualidade da água..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).exposicoes_ambientais ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), exposicoes_ambientais: e.target.value || undefined })}
                        rows={2}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Antecedentes de trauma/estresse significativo</Label>
                      <Textarea
                        placeholder="Traumas emocionais, perdas, eventos estressantes prolongados..."
                        value={((form.specialty_data as Record<string, string>) ?? {}).antecedentes_trauma ?? ""}
                        onChange={e => updateField(sp.id, "specialty_data", { ...((form.specialty_data as Record<string, string>) ?? {}), antecedentes_trauma: e.target.value || undefined })}
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Botão de salvar no final */}
              <div className="flex justify-end pt-2 pb-6">
                <Button
                  onClick={() => handleSave(sp.id)}
                  disabled={saving}
                  size="lg"
                  className="gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Anamnese de {sp.label}
                </Button>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
