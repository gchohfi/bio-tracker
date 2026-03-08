import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Save, Loader2, CheckCircle2, Heart, Leaf, Activity, Microscope,
  ClipboardList, Plus, X, AlertTriangle, FileText, Wand2, Eye, Check, XCircle,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Patient = Tables<"patients">;

// ── Structured anamnese shape ──────────────────────────────────────────

export interface StructuredAnamnese {
  queixa_principal?: string;
  objetivos?: string[];
  sintomas?: string[];
  // Hábitos
  sono_horas?: number | null;
  qualidade_sono?: "boa" | "regular" | "ruim" | "";
  nivel_estresse?: "baixo" | "moderado" | "alto" | "";
  atividade_fisica?: string;
  tabagismo?: boolean;
  etilismo?: string;
  dieta_resumo?: string;
  // Antecedentes
  comorbidades?: string[];
  cirurgias?: string[];
  historico_familiar?: string;
  // Medicações
  medicacoes?: string[];
  suplementos?: string[];
  // Restrições
  alergias?: string[];
  restricoes_alimentares?: string;
  // Livre
  observacoes?: string;
}

const EMPTY_STRUCTURED: StructuredAnamnese = {
  queixa_principal: "",
  objetivos: [],
  sintomas: [],
  sono_horas: null,
  qualidade_sono: "",
  nivel_estresse: "",
  atividade_fisica: "",
  tabagismo: false,
  etilismo: "",
  dieta_resumo: "",
  comorbidades: [],
  cirurgias: [],
  historico_familiar: "",
  medicacoes: [],
  suplementos: [],
  alergias: [],
  restricoes_alimentares: "",
  observacoes: "",
};

// ── Specialty config ───────────────────────────────────────────────────

interface AnamneseTabProps {
  patient: Patient;
}

const SPECIALTIES = [
  { id: "medicina_funcional", label: "Medicina Funcional", icon: <Microscope className="h-4 w-4" /> },
  { id: "nutrologia", label: "Nutrologia", icon: <Leaf className="h-4 w-4" /> },
  { id: "endocrinologia", label: "Endocrinologia", icon: <Activity className="h-4 w-4" /> },
  { id: "cardiologia", label: "Cardiologia", icon: <Heart className="h-4 w-4" /> },
];

// ── Reusable tag list editor ───────────────────────────────────────────

function TagListEditor({
  label,
  placeholder,
  items,
  onChange,
}: {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const trimmed = draft.trim();
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed]);
    }
    setDraft("");
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="h-8 text-sm flex-1"
        />
        <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={add} disabled={!draft.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {items.map((item, i) => (
            <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
              {item}
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────

export function AnamneseTab({ patient }: AnamneseTabProps) {
  const { toast } = useToast();
  const [activeSpecialty, setActiveSpecialty] = useState("medicina_funcional");

  // Per-specialty state
  const [structuredMap, setStructuredMap] = useState<Record<string, StructuredAnamnese>>({});
  const [legacyTexts, setLegacyTexts] = useState<Record<string, string>>({});
  const [savedIds, setSavedIds] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLegacy, setShowLegacy] = useState<Record<string, boolean>>({});

  // Conversion state
  const [converting, setConverting] = useState(false);
  const [conversionSuggestion, setConversionSuggestion] = useState<StructuredAnamnese | null>(null);
  const [conversionSpecialty, setConversionSpecialty] = useState<string | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  // ── Load ──
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("patient_anamneses")
        .select("id, specialty_id, anamnese_text, structured_data")
        .eq("patient_id", patient.id);

      if (!error && data) {
        const sMap: Record<string, StructuredAnamnese> = {};
        const tMap: Record<string, string> = {};
        const iMap: Record<string, string> = {};

        for (const row of data as any[]) {
          iMap[row.specialty_id] = row.id;
          tMap[row.specialty_id] = row.anamnese_text ?? "";

          if (row.structured_data && typeof row.structured_data === "object") {
            sMap[row.specialty_id] = { ...EMPTY_STRUCTURED, ...row.structured_data };
          } else {
            // No structured data yet — initialize empty, keep legacy text as observacoes
            sMap[row.specialty_id] = {
              ...EMPTY_STRUCTURED,
              observacoes: row.anamnese_text ?? "",
            };
          }
        }

        setStructuredMap(sMap);
        setLegacyTexts(tMap);
        setSavedIds(iMap);
      }
      setLoading(false);
    };
    load();
  }, [patient.id]);

  // ── Helpers ──
  const getStructured = (specId: string): StructuredAnamnese =>
    structuredMap[specId] ?? { ...EMPTY_STRUCTURED };

  const updateStructured = (specId: string, patch: Partial<StructuredAnamnese>) => {
    setStructuredMap((prev) => ({
      ...prev,
      [specId]: { ...(prev[specId] ?? EMPTY_STRUCTURED), ...patch },
    }));
  };

  // Build anamnese_text from structured data for backward compat
  const buildTextFromStructured = (s: StructuredAnamnese): string => {
    const lines: string[] = [];
    if (s.queixa_principal) lines.push(`Queixa principal: ${s.queixa_principal}`);
    if (s.objetivos?.length) lines.push(`Objetivos: ${s.objetivos.join(", ")}`);
    if (s.sintomas?.length) lines.push(`Sintomas: ${s.sintomas.join(", ")}`);
    if (s.comorbidades?.length) lines.push(`Comorbidades: ${s.comorbidades.join(", ")}`);
    if (s.medicacoes?.length) lines.push(`Medicações: ${s.medicacoes.join(", ")}`);
    if (s.suplementos?.length) lines.push(`Suplementos: ${s.suplementos.join(", ")}`);
    if (s.alergias?.length) lines.push(`Alergias: ${s.alergias.join(", ")}`);
    if (s.restricoes_alimentares) lines.push(`Restrições alimentares: ${s.restricoes_alimentares}`);
    if (s.atividade_fisica) lines.push(`Atividade física: ${s.atividade_fisica}`);
    if (s.qualidade_sono) lines.push(`Sono: ${s.sono_horas ? `${s.sono_horas}h` : ""} (${s.qualidade_sono})`);
    if (s.nivel_estresse) lines.push(`Estresse: ${s.nivel_estresse}`);
    if (s.etilismo) lines.push(`Etilismo: ${s.etilismo}`);
    if (s.tabagismo) lines.push(`Tabagismo: sim`);
    if (s.dieta_resumo) lines.push(`Dieta: ${s.dieta_resumo}`);
    if (s.cirurgias?.length) lines.push(`Cirurgias: ${s.cirurgias.join(", ")}`);
    if (s.historico_familiar) lines.push(`Histórico familiar: ${s.historico_familiar}`);
    if (s.observacoes) lines.push(`\nObservações:\n${s.observacoes}`);
    return lines.join("\n");
  };

  // ── Save ──
  const handleSave = async (specId: string) => {
    setSaving(true);
    const structured = getStructured(specId);
    const textVersion = buildTextFromStructured(structured);
    const existingId = savedIds[specId];

    try {
      if (existingId) {
        const { error } = await (supabase as any)
          .from("patient_anamneses")
          .update({
            structured_data: structured,
            anamnese_text: textVersion,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("patient_anamneses")
          .insert({
            patient_id: patient.id,
            specialty_id: specId,
            structured_data: structured,
            anamnese_text: textVersion,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) setSavedIds((prev) => ({ ...prev, [specId]: data.id }));
      }
      setLegacyTexts((prev) => ({ ...prev, [specId]: textVersion }));
      toast({ title: "Anamnese salva!", description: "Dados estruturados salvos com sucesso." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Carregando anamnese...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <ClipboardList className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Anamnese do Paciente</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Preencha os campos estruturados para melhor aproveitamento pela IA. Dados antigos em texto livre continuam preservados.
      </p>

      <Tabs value={activeSpecialty} onValueChange={setActiveSpecialty}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-max mb-4">
            {SPECIALTIES.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="flex items-center gap-1 text-xs">
                {s.icon}
                <span className="hidden sm:inline">{s.label}</span>
                {savedIds[s.id] && <CheckCircle2 className="h-3 w-3 text-emerald-500 ml-0.5" />}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {SPECIALTIES.map((specialty) => {
          const s = getStructured(specialty.id);
          const hasLegacy = !!(legacyTexts[specialty.id]?.trim());
          const hasStructuredData = !!(structuredMap[specialty.id]?.queixa_principal ||
            (structuredMap[specialty.id]?.objetivos?.length ?? 0) > 0 ||
            (structuredMap[specialty.id]?.sintomas?.length ?? 0) > 0 ||
            (structuredMap[specialty.id]?.medicacoes?.length ?? 0) > 0);

          return (
            <TabsContent key={specialty.id} value={specialty.id}>
              <div className="space-y-4">
                {/* Legacy text banner */}
                {hasLegacy && !hasStructuredData && (
                  <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
                    <CardContent className="p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-200">Anamnese em texto livre detectada</p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                          O texto antigo foi movido para "Observações". Preencha os campos estruturados para melhorar a análise da IA.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* ── Queixa & Objetivos ── */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Queixa e Objetivos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Queixa principal</Label>
                      <Input
                        value={s.queixa_principal ?? ""}
                        onChange={(e) => updateStructured(specialty.id, { queixa_principal: e.target.value })}
                        placeholder="Ex: Fadiga crônica, dificuldade para emagrecer..."
                        className="h-8 text-sm"
                      />
                    </div>
                    <TagListEditor
                      label="Objetivos"
                      placeholder="Ex: Emagrecimento, ganho muscular, regulação hormonal..."
                      items={s.objetivos ?? []}
                      onChange={(v) => updateStructured(specialty.id, { objetivos: v })}
                    />
                    <TagListEditor
                      label="Sintomas relevantes"
                      placeholder="Ex: Insônia, fadiga, queda de cabelo..."
                      items={s.sintomas ?? []}
                      onChange={(v) => updateStructured(specialty.id, { sintomas: v })}
                    />
                  </CardContent>
                </Card>

                {/* ── Antecedentes & Medicações ── */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Antecedentes e Medicações</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <TagListEditor
                      label="Comorbidades"
                      placeholder="Ex: Hipotireoidismo, SOP, diabetes tipo 2..."
                      items={s.comorbidades ?? []}
                      onChange={(v) => updateStructured(specialty.id, { comorbidades: v })}
                    />
                    <TagListEditor
                      label="Medicações em uso"
                      placeholder="Ex: Levotiroxina 75mcg, Metformina 500mg..."
                      items={s.medicacoes ?? []}
                      onChange={(v) => updateStructured(specialty.id, { medicacoes: v })}
                    />
                    <TagListEditor
                      label="Suplementos"
                      placeholder="Ex: Vitamina D 5000UI, Magnésio 400mg..."
                      items={s.suplementos ?? []}
                      onChange={(v) => updateStructured(specialty.id, { suplementos: v })}
                    />
                    <TagListEditor
                      label="Cirurgias prévias"
                      placeholder="Ex: Tireoidectomia, colecistectomia..."
                      items={s.cirurgias ?? []}
                      onChange={(v) => updateStructured(specialty.id, { cirurgias: v })}
                    />
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Histórico familiar</Label>
                      <Textarea
                        value={s.historico_familiar ?? ""}
                        onChange={(e) => updateStructured(specialty.id, { historico_familiar: e.target.value })}
                        placeholder="Ex: Mãe com DM2, pai com IAM aos 55 anos..."
                        rows={2}
                        className="text-sm resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* ── Alergias & Restrições ── */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Alergias e Restrições</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <TagListEditor
                      label="Alergias"
                      placeholder="Ex: Dipirona, frutos do mar, látex..."
                      items={s.alergias ?? []}
                      onChange={(v) => updateStructured(specialty.id, { alergias: v })}
                    />
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Restrições alimentares</Label>
                      <Input
                        value={s.restricoes_alimentares ?? ""}
                        onChange={(e) => updateStructured(specialty.id, { restricoes_alimentares: e.target.value })}
                        placeholder="Ex: Intolerância à lactose, vegetariano..."
                        className="h-8 text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* ── Hábitos / Estilo de vida ── */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Hábitos e Estilo de Vida</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Horas de sono</Label>
                        <Input
                          type="number"
                          min={0}
                          max={24}
                          step={0.5}
                          value={s.sono_horas ?? ""}
                          onChange={(e) => updateStructured(specialty.id, { sono_horas: e.target.value ? Number(e.target.value) : null })}
                          placeholder="7"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Qualidade do sono</Label>
                        <Select
                          value={s.qualidade_sono ?? ""}
                          onValueChange={(v) => updateStructured(specialty.id, { qualidade_sono: v as any })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="boa">Boa</SelectItem>
                            <SelectItem value="regular">Regular</SelectItem>
                            <SelectItem value="ruim">Ruim</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Nível de estresse</Label>
                        <Select
                          value={s.nivel_estresse ?? ""}
                          onValueChange={(v) => updateStructured(specialty.id, { nivel_estresse: v as any })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="baixo">Baixo</SelectItem>
                            <SelectItem value="moderado">Moderado</SelectItem>
                            <SelectItem value="alto">Alto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Atividade física</Label>
                      <Input
                        value={s.atividade_fisica ?? ""}
                        onChange={(e) => updateStructured(specialty.id, { atividade_fisica: e.target.value })}
                        placeholder="Ex: Musculação 5x/sem + corrida 2x/sem"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Etilismo</Label>
                        <Select
                          value={s.etilismo ?? ""}
                          onValueChange={(v) => updateStructured(specialty.id, { etilismo: v })}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Selecionar" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="não">Não</SelectItem>
                            <SelectItem value="social">Social</SelectItem>
                            <SelectItem value="moderado">Moderado</SelectItem>
                            <SelectItem value="diário">Diário</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end gap-2 pb-0.5">
                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={s.tabagismo ?? false}
                            onChange={(e) => updateStructured(specialty.id, { tabagismo: e.target.checked })}
                            className="rounded border-input"
                          />
                          Tabagismo
                        </label>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Resumo da dieta</Label>
                      <Textarea
                        value={s.dieta_resumo ?? ""}
                        onChange={(e) => updateStructured(specialty.id, { dieta_resumo: e.target.value })}
                        placeholder="Ex: Low carb, foca em proteínas, come pouca fruta..."
                        rows={2}
                        className="text-sm resize-none"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* ── Observações livres ── */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Observações livres</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={s.observacoes ?? ""}
                      onChange={(e) => updateStructured(specialty.id, { observacoes: e.target.value })}
                      placeholder="Informações adicionais que não se encaixam nos campos acima..."
                      rows={4}
                      className="text-sm resize-y"
                    />
                    <p className="text-xs text-muted-foreground">
                      {(s.observacoes ?? "").length} caracteres
                    </p>
                  </CardContent>
                </Card>

                {/* ── Legacy text (collapsible) ── */}
                {hasLegacy && (
                  <Card className="border-dashed">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-xs flex items-center gap-2 text-muted-foreground">
                        <FileText className="h-3.5 w-3.5" />
                        Texto legado (somente leitura)
                        <button
                          type="button"
                          className="ml-auto text-xs underline hover:text-foreground transition-colors"
                          onClick={() => setShowLegacy((prev) => ({ ...prev, [specialty.id]: !prev[specialty.id] }))}
                        >
                          {showLegacy[specialty.id] ? "Ocultar" : "Mostrar"}
                        </button>
                      </CardTitle>
                    </CardHeader>
                    {showLegacy[specialty.id] && (
                      <CardContent>
                        <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono bg-muted/30 p-3 rounded-md max-h-48 overflow-y-auto">
                          {legacyTexts[specialty.id]}
                        </pre>
                      </CardContent>
                    )}
                  </Card>
                )}

                <Separator />

                {/* ── Save ── */}
                <Button onClick={() => handleSave(specialty.id)} disabled={saving} className="w-full">
                  {saving ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</>
                  ) : (
                    <><Save className="h-4 w-4 mr-2" /> Salvar Anamnese</>
                  )}
                </Button>
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
