import { useState, useEffect, useCallback } from "react";
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
  FileText,
  CheckCircle2,
  PenLine,
  Clock,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ClinicalEvolutionTabProps {
  patientId: string;
  specialtyId: string;
  onRequestAnalysis?: (encounterId: string) => void;
  onViewAnalysis?: (analysisId: string) => void;
}

interface Encounter {
  id: string;
  encounter_date: string;
  status: "draft" | "finalized";
  chief_complaint: string | null;
  created_at: string;
  updated_at: string;
}

interface EvolutionNote {
  id?: string;
  encounter_id: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  exams_requested: string;
  medications: string;
  free_notes: string;
}

const EMPTY_NOTE: Omit<EvolutionNote, "encounter_id"> = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  exams_requested: "",
  medications: "",
  free_notes: "",
};

export function ClinicalEvolutionTab({ patientId, specialtyId }: ClinicalEvolutionTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "form">("list");
  const [activeEncounter, setActiveEncounter] = useState<Encounter | null>(null);
  const [note, setNote] = useState<EvolutionNote & { id?: string }>({ encounter_id: "", ...EMPTY_NOTE });
  const [saving, setSaving] = useState(false);
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [newChief, setNewChief] = useState("");

  // ── Load encounters ──
  const loadEncounters = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("clinical_encounters")
      .select("*")
      .eq("patient_id", patientId)
      .eq("specialty_id", specialtyId)
      .eq("practitioner_id", user.id)
      .order("encounter_date", { ascending: false });

    if (error) console.warn("Load encounters error:", error.message);
    setEncounters(data ?? []);
    setLoading(false);
  }, [patientId, specialtyId, user?.id]);

  useEffect(() => { loadEncounters(); }, [loadEncounters]);

  // ── Create encounter ──
  const handleCreate = async () => {
    if (!user?.id) return;
    setSaving(true);
    const { data: enc, error: encErr } = await (supabase as any)
      .from("clinical_encounters")
      .insert({
        patient_id: patientId,
        practitioner_id: user.id,
        specialty_id: specialtyId,
        encounter_date: format(newDate, "yyyy-MM-dd"),
        chief_complaint: newChief || null,
        status: "draft",
      })
      .select()
      .single();

    if (encErr || !enc) {
      toast({ title: "Erro ao criar consulta", description: encErr?.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    // Create empty note
    await (supabase as any)
      .from("clinical_evolution_notes")
      .insert({ encounter_id: enc.id });

    setSaving(false);
    setNewChief("");
    await loadEncounters();
    openEncounter(enc);
  };

  // ── Open encounter detail ──
  const openEncounter = async (enc: Encounter) => {
    setActiveEncounter(enc);
    const { data } = await (supabase as any)
      .from("clinical_evolution_notes")
      .select("*")
      .eq("encounter_id", enc.id)
      .single();

    setNote(data ? { ...data } : { encounter_id: enc.id, ...EMPTY_NOTE });
    setView("form");
  };

  // ── Save note ──
  const handleSave = async () => {
    if (!activeEncounter) return;
    setSaving(true);

    const payload = {
      encounter_id: activeEncounter.id,
      subjective: note.subjective || null,
      objective: note.objective || null,
      assessment: note.assessment || null,
      plan: note.plan || null,
      exams_requested: note.exams_requested || null,
      medications: note.medications || null,
      free_notes: note.free_notes || null,
    };

    if (note.id) {
      await (supabase as any).from("clinical_evolution_notes").update(payload).eq("id", note.id);
    } else {
      const { data } = await (supabase as any).from("clinical_evolution_notes").insert(payload).select().single();
      if (data) setNote((prev) => ({ ...prev, id: data.id }));
    }

    toast({ title: "Evolução salva" });
    setSaving(false);
  };

  // ── Finalize ──
  const handleFinalize = async () => {
    if (!activeEncounter) return;
    await handleSave();
    await (supabase as any)
      .from("clinical_encounters")
      .update({ status: "finalized" })
      .eq("id", activeEncounter.id);

    setActiveEncounter({ ...activeEncounter, status: "finalized" });
    toast({ title: "Consulta finalizada" });
    loadEncounters();
  };

  // ── Form field helper ──
  const Field = ({ label, field, rows = 3 }: { label: string; field: keyof typeof EMPTY_NOTE; rows?: number }) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Textarea
        value={(note as any)[field] ?? ""}
        onChange={(e) => setNote((prev) => ({ ...prev, [field]: e.target.value }))}
        rows={rows}
        disabled={activeEncounter?.status === "finalized"}
        className="text-sm resize-none"
        placeholder={`Registrar ${label.toLowerCase()}...`}
      />
    </div>
  );

  // ── LIST VIEW ──
  if (view === "list") {
    return (
      <div className="space-y-4">
        {/* New encounter form */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nova Evolução Clínica
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Data do atendimento</Label>
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
              <div className="flex-1 space-y-1.5">
                <Label className="text-xs">Queixa principal</Label>
                <Input
                  value={newChief}
                  onChange={(e) => setNewChief(e.target.value)}
                  placeholder="Ex: Retorno para acompanhamento, fadiga persistente..."
                  className="h-8 text-sm"
                />
              </div>
              <Button size="sm" className="h-8" onClick={handleCreate} disabled={saving}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Criar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Encounter list */}
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : encounters.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-lg font-medium">Nenhuma evolução registrada</p>
              <p className="text-sm text-muted-foreground">
                Crie uma nova evolução clínica para começar o histórico deste paciente.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {encounters.map((enc) => (
              <Card
                key={enc.id}
                className="cursor-pointer transition-colors hover:bg-muted/30"
                onClick={() => openEncounter(enc)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      enc.status === "finalized" ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-primary/10"
                    )}>
                      {enc.status === "finalized"
                        ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        : <PenLine className="h-5 w-5 text-primary" />
                      }
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {format(parseISO(enc.encounter_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </p>
                      {enc.chief_complaint && (
                        <p className="text-xs text-muted-foreground truncate max-w-[400px]">
                          {enc.chief_complaint}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={enc.status === "finalized" ? "default" : "outline"}
                      className={cn(
                        "text-[10px]",
                        enc.status === "finalized" && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0"
                      )}
                    >
                      {enc.status === "finalized" ? "Finalizado" : "Rascunho"}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(enc.created_at), "dd/MM HH:mm")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── FORM VIEW (SOAP) ──
  const isFinalized = activeEncounter?.status === "finalized";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => { setView("list"); setActiveEncounter(null); }} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <div className="flex items-center gap-2">
          {activeEncounter && (
            <span className="text-sm font-medium">
              {format(parseISO(activeEncounter.encounter_date), "dd/MM/yyyy")}
            </span>
          )}
          <Badge
            variant={isFinalized ? "default" : "outline"}
            className={cn(
              "text-[10px]",
              isFinalized && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0"
            )}
          >
            {isFinalized ? "Finalizado" : "Rascunho"}
          </Badge>
        </div>
        <div className="flex gap-2">
          {!isFinalized && (
            <>
              <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
                <Save className="h-3.5 w-3.5 mr-1" />
                Salvar
              </Button>
              <Button size="sm" onClick={handleFinalize} disabled={saving}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Finalizar
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Chief complaint */}
      {activeEncounter?.chief_complaint && (
        <div className="rounded-lg bg-muted/50 p-3 border-l-4 border-primary">
          <p className="text-xs font-medium text-muted-foreground mb-0.5">Queixa principal</p>
          <p className="text-sm">{activeEncounter.chief_complaint}</p>
        </div>
      )}

      {/* SOAP Fields */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Field label="Subjetivo (S)" field="subjective" rows={4} />
          <Separator />
          <Field label="Objetivo (O)" field="objective" rows={4} />
          <Separator />
          <Field label="Avaliação (A)" field="assessment" rows={4} />
          <Separator />
          <Field label="Plano (P)" field="plan" rows={4} />
          <Separator />
          <Field label="Exames solicitados" field="exams_requested" rows={2} />
          <Separator />
          <Field label="Medicações / Conduta" field="medications" rows={2} />
          <Separator />
          <Field label="Observações livres" field="free_notes" rows={3} />
        </CardContent>
      </Card>
    </div>
  );
}
