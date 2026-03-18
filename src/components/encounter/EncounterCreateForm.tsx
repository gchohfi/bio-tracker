/**
 * EncounterCreateForm — Inline form for creating a new encounter.
 * Extracted from ClinicalEvolutionTab.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, CalendarIcon } from "lucide-react";

interface EncounterCreateFormProps {
  patientId: string;
  specialtyId: string;
  onCreated?: (encounterId: string) => void;
}

export function EncounterCreateForm({ patientId, specialtyId, onCreated }: EncounterCreateFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [newChief, setNewChief] = useState("");
  const [saving, setSaving] = useState(false);

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

    await (supabase as any)
      .from("clinical_evolution_notes")
      .insert({ encounter_id: enc.id });

    setSaving(false);
    setNewChief("");

    if (onCreated) {
      onCreated(enc.id);
    } else {
      navigate(`/patient/${patientId}/encounter/${enc.id}`);
    }
  };

  return (
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
  );
}
