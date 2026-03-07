import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  CalendarIcon,
  ChevronRight,
  Clock,
  Stethoscope,
} from "lucide-react";

interface Encounter {
  id: string;
  encounter_date: string;
  chief_complaint: string | null;
  status: "draft" | "finalized";
  specialty_id: string;
  created_at: string;
}

interface ClinicalEvolutionSummaryProps {
  patientId: string;
  onNavigateToEncounter: (encounterId: string) => void;
}

export function ClinicalEvolutionSummary({
  patientId,
  onNavigateToEncounter,
}: ClinicalEvolutionSummaryProps) {
  const { user } = useAuth();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("clinical_encounters")
        .select("id, encounter_date, chief_complaint, status, specialty_id, created_at")
        .eq("patient_id", patientId)
        .eq("practitioner_id", user.id)
        .order("encounter_date", { ascending: false });
      setEncounters((data as Encounter[]) ?? []);
      setLoading(false);
    })();
  }, [patientId, user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Clock className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
        <span className="text-muted-foreground">Carregando evolução clínica...</span>
      </div>
    );
  }

  if (encounters.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-lg font-medium">Nenhuma evolução clínica registrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            As evoluções clínicas aparecem aqui quando você registra consultas na aba Prontuário.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => onNavigateToEncounter("")}
          >
            <Stethoscope className="h-4 w-4 mr-2" />
            Ir para o Prontuário
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">
          Evolução Clínica
        </h2>
        <Badge variant="secondary" className="text-xs">
          {encounters.length} consulta{encounters.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {encounters.map((enc) => (
        <Card
          key={enc.id}
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => onNavigateToEncounter(enc.id)}
        >
          <CardContent className="flex items-center justify-between py-4 px-5">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10">
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {format(parseISO(enc.encounter_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
                {enc.chief_complaint && (
                  <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                    {enc.chief_complaint}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={enc.status === "finalized" ? "default" : "outline"} className="text-xs">
                {enc.status === "finalized" ? "Finalizado" : "Rascunho"}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
