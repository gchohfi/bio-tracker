import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  ArrowLeft,
  Save,
  CalendarIcon,
  Scale,
  Activity,
  Trash2,
  Clock,
  Upload,
  Loader2,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseInBodyPdf } from "@/lib/parseInBodyPdf";

// ── Types ──

interface BodyCompositionSession {
  id: string;
  patient_id: string;
  practitioner_id: string;
  session_date: string;
  weight_kg: number | null;
  bmi: number | null;
  skeletal_muscle_kg: number | null;
  body_fat_kg: number | null;
  body_fat_pct: number | null;
  visceral_fat_level: number | null;
  total_body_water_l: number | null;
  ecw_tbw_ratio: number | null;
  bmr_kcal: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  waist_hip_ratio: number | null;
  device_model: string | null;
  source_type: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

type FormFields = Omit<BodyCompositionSession, "id" | "patient_id" | "practitioner_id" | "source_type" | "created_at" | "updated_at">;

const EMPTY_FORM: FormFields = {
  session_date: new Date().toISOString().slice(0, 10),
  weight_kg: null,
  bmi: null,
  skeletal_muscle_kg: null,
  body_fat_kg: null,
  body_fat_pct: null,
  visceral_fat_level: null,
  total_body_water_l: null,
  ecw_tbw_ratio: null,
  bmr_kcal: null,
  waist_cm: null,
  hip_cm: null,
  waist_hip_ratio: null,
  device_model: null,
  notes: null,
};

interface BodyCompositionTabProps {
  patientId: string;
}

// ── Field definitions for the form ──

interface FieldDef {
  key: keyof FormFields;
  label: string;
  unit: string;
  step?: string;
  group: "core" | "anthropometric" | "metabolic";
}

const FIELDS: FieldDef[] = [
  { key: "weight_kg", label: "Peso", unit: "kg", step: "0.1", group: "core" },
  { key: "bmi", label: "IMC", unit: "kg/m²", step: "0.1", group: "core" },
  { key: "skeletal_muscle_kg", label: "Massa Muscular Esquelética", unit: "kg", step: "0.1", group: "core" },
  { key: "body_fat_kg", label: "Massa de Gordura Corporal", unit: "kg", step: "0.1", group: "core" },
  { key: "body_fat_pct", label: "Percentual de Gordura", unit: "%", step: "0.1", group: "core" },
  { key: "visceral_fat_level", label: "Gordura Visceral", unit: "nível", step: "1", group: "core" },
  { key: "total_body_water_l", label: "Água Corporal Total", unit: "L", step: "0.1", group: "core" },
  { key: "ecw_tbw_ratio", label: "Relação ECW/TBW", unit: "", step: "0.001", group: "core" },
  { key: "bmr_kcal", label: "TMB / BMR", unit: "kcal", step: "1", group: "metabolic" },
  { key: "waist_cm", label: "Cintura", unit: "cm", step: "0.1", group: "anthropometric" },
  { key: "hip_cm", label: "Quadril", unit: "cm", step: "0.1", group: "anthropometric" },
  { key: "waist_hip_ratio", label: "Relação Cintura/Quadril", unit: "", step: "0.01", group: "anthropometric" },
];

const GROUP_LABELS: Record<string, string> = {
  core: "Composição Corporal",
  metabolic: "Metabolismo",
  anthropometric: "Antropometria",
};

// ── Component ──

export function BodyCompositionTab({ patientId }: BodyCompositionTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sessions, setSessions] = useState<BodyCompositionSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form">("list");
  const [activeSession, setActiveSession] = useState<BodyCompositionSession | null>(null);
  const [form, setForm] = useState<FormFields>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [importing, setImporting] = useState(false);
  const [sourceType, setSourceType] = useState<string>("manual");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load sessions ──
  const loadSessions = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("body_composition_sessions")
      .select("*")
      .eq("patient_id", patientId)
      .eq("practitioner_id", user.id)
      .order("session_date", { ascending: false });

    if (error) console.warn("Load body composition error:", error.message);
    setSessions(data ?? []);
    setLoading(false);
  }, [patientId, user?.id]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // ── Create new session ──
  const handleCreate = () => {
    setActiveSession(null);
    setForm({ ...EMPTY_FORM, session_date: format(newDate, "yyyy-MM-dd") });
    setSourceType("manual");
    setView("form");
  };

  // ── Import PDF ──
  const handleImportPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = "";

    if (file.type !== "application/pdf") {
      toast({ title: "Arquivo inválido", description: "Selecione um arquivo PDF.", variant: "destructive" });
      return;
    }

    setImporting(true);
    try {
      const parsed = await parseInBodyPdf(file);
      setActiveSession(null);
      setForm({
        session_date: parsed.session_date || format(newDate, "yyyy-MM-dd"),
        weight_kg: parsed.weight_kg,
        bmi: parsed.bmi,
        skeletal_muscle_kg: parsed.skeletal_muscle_kg,
        body_fat_kg: parsed.body_fat_kg,
        body_fat_pct: parsed.body_fat_pct,
        visceral_fat_level: parsed.visceral_fat_level,
        total_body_water_l: parsed.total_body_water_l,
        ecw_tbw_ratio: parsed.ecw_tbw_ratio,
        bmr_kcal: parsed.bmr_kcal,
        waist_cm: parsed.waist_cm,
        hip_cm: parsed.hip_cm,
        waist_hip_ratio: parsed.waist_hip_ratio,
        device_model: parsed.device_model,
        notes: parsed.notes,
      });
      // Track source as pdf_parsed (will be set on save)
      setSourceType("pdf_parsed");
      setView("form");

      const filledCount = Object.values(parsed).filter((v) => v !== null).length;
      toast({
        title: "PDF importado",
        description: `${filledCount} campo(s) extraído(s). Confira e confirme os dados.`,
      });
    } catch (err: any) {
      console.warn("PDF parse error:", err);
      toast({ title: "Erro ao ler PDF", description: err?.message || "Não foi possível extrair dados do PDF.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  // ── Open existing session ──
  const openSession = (session: BodyCompositionSession) => {
    setActiveSession(session);
    setSourceType(session.source_type);
    setForm({
      session_date: session.session_date,
      weight_kg: session.weight_kg,
      bmi: session.bmi,
      skeletal_muscle_kg: session.skeletal_muscle_kg,
      body_fat_kg: session.body_fat_kg,
      body_fat_pct: session.body_fat_pct,
      visceral_fat_level: session.visceral_fat_level,
      total_body_water_l: session.total_body_water_l,
      ecw_tbw_ratio: session.ecw_tbw_ratio,
      bmr_kcal: session.bmr_kcal,
      waist_cm: session.waist_cm,
      hip_cm: session.hip_cm,
      waist_hip_ratio: session.waist_hip_ratio,
      device_model: session.device_model,
      notes: session.notes,
    });
    setView("form");
  };

  // ── Save ──
  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);

    const payload = {
      patient_id: patientId,
      practitioner_id: user.id,
      session_date: form.session_date,
      weight_kg: form.weight_kg,
      bmi: form.bmi,
      skeletal_muscle_kg: form.skeletal_muscle_kg,
      body_fat_kg: form.body_fat_kg,
      body_fat_pct: form.body_fat_pct,
      visceral_fat_level: form.visceral_fat_level,
      total_body_water_l: form.total_body_water_l,
      ecw_tbw_ratio: form.ecw_tbw_ratio,
      bmr_kcal: form.bmr_kcal,
      waist_cm: form.waist_cm,
      hip_cm: form.hip_cm,
      waist_hip_ratio: form.waist_hip_ratio,
      device_model: form.device_model || null,
      notes: form.notes || null,
      source_type: sourceType,
    };

    if (activeSession) {
      const { error } = await (supabase as any)
        .from("body_composition_sessions")
        .update(payload)
        .eq("id", activeSession.id);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Avaliação corporal atualizada" });
      }
    } else {
      const { data, error } = await (supabase as any)
        .from("body_composition_sessions")
        .insert(payload)
        .select()
        .single();
      if (error) {
        toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      } else {
        setActiveSession(data);
        toast({ title: "Avaliação corporal registrada" });
      }
    }

    setSaving(false);
    await loadSessions();
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!activeSession) return;
    const { error } = await (supabase as any)
      .from("body_composition_sessions")
      .delete()
      .eq("id", activeSession.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Avaliação excluída" });
      setView("list");
      setActiveSession(null);
      await loadSessions();
    }
  };

  // ── Field updater ──
  const updateField = (key: keyof FormFields, value: string) => {
    if (key === "device_model" || key === "notes" || key === "session_date") {
      setForm((prev) => ({ ...prev, [key]: value || null }));
    } else {
      setForm((prev) => ({ ...prev, [key]: value === "" ? null : Number(value) }));
    }
  };

  // ── Metric card for list view ──
  const MetricBadge = ({ label, value, unit }: { label: string; value: number | null; unit: string }) => {
    if (value === null || value === undefined) return null;
    return (
      <span className="text-[10px] text-muted-foreground">
        {label}: <span className="font-medium text-foreground">{value}{unit && ` ${unit}`}</span>
      </span>
    );
  };

  // ── LIST VIEW ──
  if (view === "list") {
    return (
      <div className="space-y-4">
        {/* New session */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Nova Avaliação Corporal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Data da avaliação</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-[180px] justify-start">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {format(newDate, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newDate} onSelect={(d) => d && setNewDate(d)} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <Button size="sm" className="h-8" onClick={handleCreate}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Registrar
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
              >
                {importing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Importar PDF
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleImportPdf}
              />
            </div>
          </CardContent>
        </Card>

        {/* Session list */}
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : sessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Scale className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-lg font-medium">Nenhuma avaliação corporal</p>
              <p className="text-sm text-muted-foreground">
                Registre a primeira avaliação de composição corporal deste paciente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <Card
                key={s.id}
                className="cursor-pointer transition-colors hover:bg-muted/30"
                onClick={() => openSession(s)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Scale className="h-4 w-4 text-primary" />
                      </div>
                      <p className="font-medium text-sm">
                        {format(parseISO(s.session_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(s.created_at), "dd/MM HH:mm")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-3 ml-11">
                    <MetricBadge label="Peso" value={s.weight_kg} unit="kg" />
                    <MetricBadge label="IMC" value={s.bmi} unit="" />
                    <MetricBadge label="% Gordura" value={s.body_fat_pct} unit="%" />
                    <MetricBadge label="M. Muscular" value={s.skeletal_muscle_kg} unit="kg" />
                    <MetricBadge label="G. Visceral" value={s.visceral_fat_level} unit="" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── FORM VIEW ──
  const groups = ["core", "metabolic", "anthropometric"] as const;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => { setView("list"); setActiveSession(null); setSourceType("manual"); }} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          {sourceType === "pdf_parsed" && !activeSession && (
            <Badge variant="secondary" className="text-[10px]">Importado do PDF — confira antes de salvar</Badge>
          )}
        </div>
        <div className="flex gap-2">
          {activeSession && (
            <Button size="sm" variant="destructive" className="h-8 text-xs gap-1" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs gap-1">
            <Save className="h-3.5 w-3.5" />
            {activeSession ? "Atualizar" : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Date */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Data da avaliação</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-[180px] justify-start">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {form.session_date ? format(parseISO(form.session_date), "dd/MM/yyyy") : "—"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.session_date ? parseISO(form.session_date) : undefined}
                    onSelect={(d) => d && updateField("session_date", format(d, "yyyy-MM-dd"))}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">Equipamento / Modelo</Label>
              <Input
                value={form.device_model ?? ""}
                onChange={(e) => updateField("device_model", e.target.value)}
                placeholder="Ex: InBody 770, Tanita MC-780..."
                className="h-8 text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metric fields grouped */}
      {groups.map((group) => {
        const groupFields = FIELDS.filter((f) => f.group === group);
        if (groupFields.length === 0) return null;
        return (
          <Card key={group}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium flex items-center gap-1.5">
                {group === "core" ? <Scale className="h-3.5 w-3.5 text-primary" /> : <Activity className="h-3.5 w-3.5 text-primary" />}
                {GROUP_LABELS[group]}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {groupFields.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">{f.label} {f.unit && <span className="opacity-60">({f.unit})</span>}</Label>
                    <Input
                      type="number"
                      step={f.step}
                      value={form[f.key] ?? ""}
                      onChange={(e) => updateField(f.key, e.target.value)}
                      className="h-8 text-sm"
                      placeholder="—"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Notes */}
      <Card>
        <CardContent className="p-4 space-y-1.5">
          <Label className="text-xs font-medium">Observações</Label>
          <Textarea
            value={form.notes ?? ""}
            onChange={(e) => updateField("notes", e.target.value)}
            rows={3}
            className="text-sm resize-none"
            placeholder="Observações sobre a avaliação, condições da medição, etc."
          />
        </CardContent>
      </Card>
    </div>
  );
}
