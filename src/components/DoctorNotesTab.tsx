import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Save, Loader2, CheckCircle2, Heart, Leaf, Activity, Microscope,
  Stethoscope, AlertTriangle, ClipboardCheck, FileText, TrendingUp, Target
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type DoctorNotes = Tables<"doctor_specialty_notes">;
type Patient = Tables<"patients">;

interface DoctorNotesTabProps {
  patient: Patient;
}

const SPECIALTIES = [
  { id: "medicina_funcional", label: "Medicina Funcional", icon: <Microscope className="h-4 w-4" /> },
  { id: "nutrologia", label: "Nutrologia", icon: <Leaf className="h-4 w-4" /> },
  { id: "endocrinologia", label: "Endocrinologia", icon: <Activity className="h-4 w-4" /> },
  { id: "cardiologia", label: "Cardiologia", icon: <Heart className="h-4 w-4" /> },
];

type NotesForm = Omit<DoctorNotes, "id" | "created_at" | "updated_at">;

const emptyForm = (patientId: string, specialtyId: string): NotesForm => ({
  patient_id: patientId,
  specialty_id: specialtyId,
  impressao_clinica: null,
  hipoteses_diagnosticas: null,
  foco_consulta: null,
  observacoes_exames: null,
  conduta_planejada: null,
  pontos_atencao: null,
  medicamentos_prescritos: null,
  resposta_tratamento: null,
  proximos_passos: null,
  notas_livres: null,
  exames_em_dia: false,
  adesao_tratamento: null,
  motivacao_paciente: null,
});

export function DoctorNotesTab({ patient }: DoctorNotesTabProps) {
  const { toast } = useToast();
  const [activeSpecialty, setActiveSpecialty] = useState("medicina_funcional");
  const [forms, setForms] = useState<Record<string, NotesForm>>({});
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNotes = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("doctor_specialty_notes")
        .select("*")
        .eq("patient_id", patient.id);

      if (!error && data) {
        const formsMap: Record<string, NotesForm> = {};
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
    loadNotes();
  }, [patient.id]);

  const getForm = (specialtyId: string): NotesForm =>
    forms[specialtyId] ?? emptyForm(patient.id, specialtyId);

  const updateField = (specialtyId: string, field: keyof NotesForm, value: unknown) => {
    setForms(prev => ({
      ...prev,
      [specialtyId]: {
        ...(prev[specialtyId] ?? emptyForm(patient.id, specialtyId)),
        [field]: value,
      },
    }));
  };

  const handleSave = async (specialtyId: string) => {
    setSaving(true);
    const form = getForm(specialtyId);
    const existingId = savedIds[specialtyId];

    try {
      if (existingId) {
        const { error } = await (supabase as any)
          .from("doctor_specialty_notes")
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("doctor_specialty_notes")
          .insert(form)
          .select("id")
          .single();
        if (error) throw error;
        setSavedIds(prev => ({ ...prev, [specialtyId]: data.id }));
      }
      toast({
        title: "✅ Notas salvas!",
        description: `Notas de ${SPECIALTIES.find(s => s.id === specialtyId)?.label} salvas com sucesso.`,
      });
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
      {/* Banner informativo */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
        <Stethoscope className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-amber-800">Notas Clínicas do Médico</p>
          <p className="text-xs text-amber-700 mt-0.5">
            Estas anotações são <strong>exclusivas do médico</strong> e serão automaticamente incluídas
            no contexto da análise IA, enriquecendo o relatório com sua visão clínica.
          </p>
        </div>
      </div>

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
              {/* Cabeçalho */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-lg">Notas Clínicas — {sp.label}</h3>
                  {savedIds[sp.id] && (
                    <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50">
                      Salvas
                    </Badge>
                  )}
                </div>
                <Button onClick={() => handleSave(sp.id)} disabled={saving} size="sm" className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Notas
                </Button>
              </div>

              {/* ── AVALIAÇÃO RÁPIDA ── */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Avaliação Rápida
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Adesão ao tratamento</Label>
                    <Select
                      value={form.adesao_tratamento ?? ""}
                      onValueChange={v => updateField(sp.id, "adesao_tratamento", v || null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="boa">✅ Boa</SelectItem>
                        <SelectItem value="regular">⚠️ Regular</SelectItem>
                        <SelectItem value="ruim">❌ Ruim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Motivação do paciente</Label>
                    <Select
                      value={form.motivacao_paciente ?? ""}
                      onValueChange={v => updateField(sp.id, "motivacao_paciente", v || null)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="alta">🔥 Alta</SelectItem>
                        <SelectItem value="media">😐 Média</SelectItem>
                        <SelectItem value="baixa">😔 Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Checkbox
                      id={`exames-${sp.id}`}
                      checked={form.exames_em_dia ?? false}
                      onCheckedChange={v => updateField(sp.id, "exames_em_dia", !!v)}
                    />
                    <Label htmlFor={`exames-${sp.id}`} className="cursor-pointer">
                      Exames em dia
                    </Label>
                  </div>
                </CardContent>
              </Card>

              {/* ── IMPRESSÃO CLÍNICA ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Impressão Clínica
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Impressão clínica geral</Label>
                    <Textarea
                      placeholder="Sua impressão geral sobre o estado de saúde do paciente nesta consulta..."
                      value={form.impressao_clinica ?? ""}
                      onChange={e => updateField(sp.id, "impressao_clinica", e.target.value || null)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hipóteses diagnósticas</Label>
                    <Textarea
                      placeholder="Ex: Síndrome metabólica, hipotireoidismo subclínico, disbiose intestinal..."
                      value={form.hipoteses_diagnosticas ?? ""}
                      onChange={e => updateField(sp.id, "hipoteses_diagnosticas", e.target.value || null)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Foco principal desta consulta</Label>
                    <Textarea
                      placeholder="Ex: Revisão dos exames de tireoide, ajuste da suplementação de vitamina D..."
                      value={form.foco_consulta ?? ""}
                      onChange={e => updateField(sp.id, "foco_consulta", e.target.value || null)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── EXAMES E CONDUTA ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Exames e Conduta
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>Observações sobre os exames laboratoriais</Label>
                    <Textarea
                      placeholder="Destaque os achados mais relevantes dos exames, correlações clínicas, valores que merecem atenção especial..."
                      value={form.observacoes_exames ?? ""}
                      onChange={e => updateField(sp.id, "observacoes_exames", e.target.value || null)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Conduta planejada</Label>
                    <Textarea
                      placeholder="Suplementação, mudanças de estilo de vida, encaminhamentos, solicitação de novos exames..."
                      value={form.conduta_planejada ?? ""}
                      onChange={e => updateField(sp.id, "conduta_planejada", e.target.value || null)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Medicamentos/suplementos já prescritos</Label>
                    <Textarea
                      placeholder="Lista de medicamentos e suplementos que o paciente já usa por prescrição sua..."
                      value={form.medicamentos_prescritos ?? ""}
                      onChange={e => updateField(sp.id, "medicamentos_prescritos", e.target.value || null)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── EVOLUÇÃO E PRÓXIMOS PASSOS ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Evolução e Próximos Passos
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Resposta ao tratamento anterior</Label>
                    <Textarea
                      placeholder="Como o paciente respondeu às condutas anteriores? Houve melhora, piora, efeitos adversos?"
                      value={form.resposta_tratamento ?? ""}
                      onChange={e => updateField(sp.id, "resposta_tratamento", e.target.value || null)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Próximos passos / retorno</Label>
                    <Textarea
                      placeholder="Ex: Retorno em 3 meses com novos exames de tireoide e hemograma completo..."
                      value={form.proximos_passos ?? ""}
                      onChange={e => updateField(sp.id, "proximos_passos", e.target.value || null)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* ── ALERTAS E NOTAS LIVRES ── */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Alertas e Anotações
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Pontos de atenção / alertas</Label>
                    <Textarea
                      placeholder="Contraindicações, interações medicamentosas, sinais de alerta que merecem monitoramento..."
                      value={form.pontos_atencao ?? ""}
                      onChange={e => updateField(sp.id, "pontos_atencao", e.target.value || null)}
                      rows={3}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Notas livres</Label>
                    <Textarea
                      placeholder="Qualquer outra observação relevante sobre este paciente nesta especialidade..."
                      value={form.notas_livres ?? ""}
                      onChange={e => updateField(sp.id, "notas_livres", e.target.value || null)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Botão salvar no final */}
              <div className="flex justify-end pt-2 pb-6">
                <Button onClick={() => handleSave(sp.id)} disabled={saving} size="lg" className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar Notas de {sp.label}
                </Button>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
