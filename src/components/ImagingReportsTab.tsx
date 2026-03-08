import { useState, useEffect, useCallback, useRef } from "react";
import { Trace } from "@/lib/traceability";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, ArrowLeft, Save, CalendarIcon, FileImage, Trash2, Clock,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// ── Types ──

interface ImagingReport {
  id: string;
  patient_id: string;
  practitioner_id: string;
  report_date: string;
  exam_type: string;
  exam_region: string | null;
  findings: string | null;
  conclusion: string | null;
  recommendations: string | null;
  incidental_findings: string | null;
  measurements: Record<string, unknown> | null;
  classifications: string | null;
  source_lab: string | null;
  source_type: string;
  specialty_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface FormFields {
  report_date: string;
  exam_type: string;
  exam_region: string | null;
  findings: string | null;
  conclusion: string | null;
  recommendations: string | null;
  incidental_findings: string | null;
  classifications: string | null;
  source_lab: string | null;
  notes: string | null;
}

const EMPTY_FORM: FormFields = {
  report_date: new Date().toISOString().slice(0, 10),
  exam_type: "",
  exam_region: null,
  findings: null,
  conclusion: null,
  recommendations: null,
  incidental_findings: null,
  classifications: null,
  source_lab: null,
  notes: null,
};

const EXAM_TYPES = [
  { value: "ultrassom_tireoide", label: "Ultrassom de Tireoide" },
  { value: "ultrassom_abdome", label: "Ultrassom de Abdome" },
  { value: "ultrassom_pelve", label: "Ultrassom Pélvico" },
  { value: "ultrassom_mama", label: "Ultrassom de Mama" },
  { value: "densitometria", label: "Densitometria Óssea" },
  { value: "ressonancia", label: "Ressonância Magnética" },
  { value: "tomografia", label: "Tomografia" },
  { value: "raio_x", label: "Raio-X" },
  { value: "mamografia", label: "Mamografia" },
  { value: "ecocardiograma", label: "Ecocardiograma" },
  { value: "elastografia", label: "Elastografia Hepática" },
  { value: "outro", label: "Outro" },
];

interface ImagingReportsTabProps {
  patientId: string;
}

export function ImagingReportsTab({ patientId }: ImagingReportsTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<ImagingReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form">("list");
  const [activeReport, setActiveReport] = useState<ImagingReport | null>(null);
  const [form, setForm] = useState<FormFields>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [newDate, setNewDate] = useState<Date>(new Date());

  const loadReports = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("imaging_reports")
      .select("*")
      .eq("patient_id", patientId)
      .eq("practitioner_id", user.id)
      .order("report_date", { ascending: false });
    if (error) console.warn("Load imaging reports error:", error.message);
    setReports(data ?? []);
    setLoading(false);
  }, [patientId, user?.id]);

  useEffect(() => { loadReports(); }, [loadReports]);

  const handleCreate = () => {
    setActiveReport(null);
    setForm({ ...EMPTY_FORM, report_date: format(newDate, "yyyy-MM-dd") });
    setView("form");
  };

  const openReport = (r: ImagingReport) => {
    setActiveReport(r);
    setForm({
      report_date: r.report_date,
      exam_type: r.exam_type,
      exam_region: r.exam_region,
      findings: r.findings,
      conclusion: r.conclusion,
      recommendations: r.recommendations,
      incidental_findings: r.incidental_findings,
      classifications: r.classifications,
      source_lab: r.source_lab,
      notes: r.notes,
    });
    setView("form");
  };

  const handleSave = async () => {
    if (!user?.id) return;
    if (!form.exam_type) {
      toast({ title: "Tipo de exame obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      patient_id: patientId,
      practitioner_id: user.id,
      report_date: form.report_date,
      exam_type: form.exam_type,
      exam_region: form.exam_region || null,
      findings: form.findings || null,
      conclusion: form.conclusion || null,
      recommendations: form.recommendations || null,
      incidental_findings: form.incidental_findings || null,
      classifications: form.classifications || null,
      source_lab: form.source_lab || null,
      notes: form.notes || null,
    };

    if (activeReport) {
      const { error } = await (supabase as any)
        .from("imaging_reports").update(payload).eq("id", activeReport.id);
      if (error) toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      else toast({ title: "Laudo atualizado" });
    } else {
      const { data, error } = await (supabase as any)
        .from("imaging_reports").insert(payload).select().single();
      if (error) toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      else { setActiveReport(data); toast({ title: "Laudo registrado" }); }
    }
    setSaving(false);
    await loadReports();
  };

  const handleDelete = async () => {
    if (!activeReport) return;
    const { error } = await (supabase as any)
      .from("imaging_reports").delete().eq("id", activeReport.id);
    if (error) toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Laudo excluído" });
      setView("list");
      setActiveReport(null);
      await loadReports();
    }
  };

  const updateField = (key: keyof FormFields, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value || null }));
  };

  const getExamLabel = (type: string) =>
    EXAM_TYPES.find((t) => t.value === type)?.label ?? type;

  // ── LIST VIEW ──
  if (view === "list") {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileImage className="h-4 w-4" />
              Novo Laudo de Imagem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Data do exame</Label>
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
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileImage className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-lg font-medium">Nenhum laudo de imagem</p>
              <p className="text-sm text-muted-foreground">
                Registre o primeiro laudo de exame de imagem deste paciente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <Card key={r.id} className="cursor-pointer transition-colors hover:bg-muted/30" onClick={() => openReport(r)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <FileImage className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{getExamLabel(r.exam_type)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(parseISO(r.report_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                          {r.exam_region && ` — ${r.exam_region}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.classifications && (
                        <Badge variant="secondary" className="text-[10px]">{r.classifications}</Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(parseISO(r.created_at), "dd/MM HH:mm")}
                      </span>
                    </div>
                  </div>
                  {r.conclusion && (
                    <p className="text-xs text-muted-foreground ml-11 line-clamp-2">{r.conclusion}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── FORM VIEW ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => { setView("list"); setActiveReport(null); }} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs gap-1">
            <Save className="h-3.5 w-3.5" />
            {activeReport ? "Atualizar" : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Metadata */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data do exame</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-full justify-start">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {form.report_date ? format(parseISO(form.report_date), "dd/MM/yyyy") : "—"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={form.report_date ? parseISO(form.report_date) : undefined}
                    onSelect={(d) => d && updateField("report_date", format(d, "yyyy-MM-dd"))}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de exame *</Label>
              <Select value={form.exam_type} onValueChange={(v) => updateField("exam_type", v)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Região anatômica</Label>
              <Input value={form.exam_region ?? ""} onChange={(e) => updateField("exam_region", e.target.value)} placeholder="Ex: tireoide, abdome, coluna lombar" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Laboratório / Clínica</Label>
              <Input value={form.source_lab ?? ""} onChange={(e) => updateField("source_lab", e.target.value)} placeholder="Ex: Fleury, DASA..." className="h-8 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinical content */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium">Conteúdo do Laudo</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Achados principais</Label>
            <Textarea value={form.findings ?? ""} onChange={(e) => updateField("findings", e.target.value)} rows={4} className="text-sm resize-none" placeholder="Descreva os achados principais do laudo..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conclusão</Label>
            <Textarea value={form.conclusion ?? ""} onChange={(e) => updateField("conclusion", e.target.value)} rows={3} className="text-sm resize-none" placeholder="Conclusão do radiologista / médico..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Recomendações</Label>
            <Textarea value={form.recommendations ?? ""} onChange={(e) => updateField("recommendations", e.target.value)} rows={2} className="text-sm resize-none" placeholder="Recomendações do laudo (acompanhamento, repetir em X meses...)" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Achados incidentais</Label>
            <Textarea value={form.incidental_findings ?? ""} onChange={(e) => updateField("incidental_findings", e.target.value)} rows={2} className="text-sm resize-none" placeholder="Achados incidentais relevantes, se houver..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Classificações (TI-RADS, BI-RADS, T-score, etc.)</Label>
            <Input value={form.classifications ?? ""} onChange={(e) => updateField("classifications", e.target.value)} placeholder="Ex: TI-RADS 3, BI-RADS 2, T-score -1.5" className="h-8 text-sm" />
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardContent className="p-4 space-y-1.5">
          <Label className="text-xs font-medium">Observações do médico</Label>
          <Textarea value={form.notes ?? ""} onChange={(e) => updateField("notes", e.target.value)} rows={2} className="text-sm resize-none" placeholder="Notas adicionais sobre o laudo..." />
        </CardContent>
      </Card>

      {/* Destructive action — isolated at the bottom */}
      {activeReport && (
        <div className="flex justify-end pt-2 border-t">
          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
            <Trash2 className="h-3.5 w-3.5" />
            Excluir laudo
          </Button>
        </div>
      )}
    </div>
  );
}
