import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  CalendarIcon,
  FileText,
  CheckCircle2,
  PenLine,
  Clock,
  Stethoscope,
  ChevronRight,
} from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ClinicalEvolutionTabProps {
  patientId: string;
  patientName?: string;
  /** Default specialty for creating new encounters */
  specialtyId: string;
  specialtyName?: string;
  practitionerName?: string;
  /** Available specialties for display */
  availableSpecialties?: Array<{ specialty_id: string; specialty_name: string; specialty_icon?: string }>;
  onRequestAnalysis?: (encounterId: string) => void;
  onViewAnalysis?: (analysisId: string) => void;
}

interface Encounter {
  id: string;
  encounter_date: string;
  status: "draft" | "finalized";
  chief_complaint: string | null;
  specialty_id: string;
  created_at: string;
  updated_at: string;
}

export function ClinicalEvolutionTab({
  patientId,
  specialtyId,
  availableSpecialties = [],
}: ClinicalEvolutionTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [newChief, setNewChief] = useState("");
  const [saving, setSaving] = useState(false);

  // Build specialty lookup map
  const specialtyMap = new Map(
    availableSpecialties.map((s) => [s.specialty_id, s.specialty_name])
  );

  // ── Load ALL encounters (no specialty filter) ──
  const loadEncounters = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("clinical_encounters")
      .select("id, encounter_date, status, chief_complaint, specialty_id, created_at, updated_at")
      .eq("patient_id", patientId)
      .eq("practitioner_id", user.id)
      .order("encounter_date", { ascending: false });

    if (error) console.warn("Load encounters error:", error.message);
    setEncounters(data ?? []);
    setLoading(false);
  }, [patientId, user?.id]);

  useEffect(() => {
    loadEncounters();
  }, [loadEncounters]);

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
    setShowCreateForm(false);
    // Navigate directly to the new encounter workspace
    navigate(`/patient/${patientId}/encounter/${enc.id}`);
  };

  const getSpecialtyLabel = (sid: string): string => {
    return specialtyMap.get(sid) ?? sid.replace(/_/g, " ");
  };

  // ── Empty state ──
  if (!loading && encounters.length === 0 && !showCreateForm) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Stethoscope className="mb-4 h-12 w-12 text-muted-foreground/40" />
            <p className="text-lg font-medium">Nenhuma consulta registrada</p>
            <p className="text-sm text-muted-foreground mt-1">
              Registre a primeira consulta para iniciar o histórico clínico deste paciente.
            </p>
            <Button
              className="mt-4"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Nova Consulta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with create action */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Consultas</h2>
          {!loading && (
            <Badge variant="secondary" className="text-xs">
              {encounters.length}
            </Badge>
          )}
        </div>
        <Button
          size="sm"
          variant={showCreateForm ? "ghost" : "outline"}
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? (
            "Cancelar"
          ) : (
            <>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova Consulta
            </>
          )}
        </Button>
      </div>

      {/* Inline create form (collapsible) */}
      {showCreateForm && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex gap-3 items-end flex-wrap">
              <div className="space-y-1.5">
                <Label className="text-xs">Data</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 w-[160px] justify-start">
                      <CalendarIcon className="h-3.5 w-3.5" />
                      {format(newDate, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={newDate} onSelect={(d) => d && setNewDate(d)} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <Label className="text-xs">Queixa principal</Label>
                <Input
                  value={newChief}
                  onChange={(e) => setNewChief(e.target.value)}
                  placeholder="Ex: Retorno, fadiga persistente..."
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
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Clock className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Carregando consultas...</span>
        </div>
      )}

      {/* Encounter list — single consolidated timeline */}
      {!loading && encounters.length > 0 && (
        <div className="space-y-2">
          {encounters.map((enc) => {
            const isDraft = enc.status === "draft";
            return (
              <Card
                key={enc.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-muted/30 group",
                  isDraft && "border-l-4 border-l-amber-400"
                )}
                onClick={() => navigate(`/patient/${patientId}/encounter/${enc.id}`)}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Status icon */}
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      isDraft
                        ? "bg-amber-100 dark:bg-amber-900/30"
                        : "bg-emerald-100 dark:bg-emerald-900/30"
                    )}>
                      {isDraft
                        ? <PenLine className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        : <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      }
                    </div>

                    {/* Main info */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">
                          {format(parseISO(enc.encounter_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                        <Badge
                          variant={isDraft ? "outline" : "default"}
                          className={cn(
                            "text-[10px] shrink-0",
                            !isDraft && "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0",
                            isDraft && "border-amber-300 text-amber-700 dark:border-amber-600 dark:text-amber-300"
                          )}
                        >
                          {isDraft ? "Rascunho" : "Finalizada"}
                        </Badge>
                      </div>

                      {/* Specialty */}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getSpecialtyLabel(enc.specialty_id)}
                      </p>

                      {/* Chief complaint */}
                      {enc.chief_complaint ? (
                        <p className="text-xs text-foreground/80 mt-1 line-clamp-1">
                          <span className="font-medium text-muted-foreground">QP:</span>{" "}
                          {enc.chief_complaint}
                        </p>
                      ) : isDraft ? (
                        <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mt-1 italic">
                          Sem queixa principal registrada
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(enc.created_at), "dd/MM HH:mm")}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
