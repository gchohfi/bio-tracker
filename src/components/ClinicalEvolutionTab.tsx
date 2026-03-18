import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Stethoscope } from "lucide-react";
import { EncounterTimelineCard } from "@/components/encounter/EncounterTimelineCard";
import { EncounterInlineDetail } from "@/components/encounter/EncounterInlineDetail";
import { EncounterCreateForm } from "@/components/encounter/EncounterCreateForm";

interface ClinicalEvolutionTabProps {
  patientId: string;
  patientName?: string;
  specialtyId: string;
  specialtyName?: string;
  practitionerName?: string;
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
  const navigate = useNavigate();
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const specialtyMap = new Map(
    availableSpecialties.map((s) => [s.specialty_id, s.specialty_name])
  );

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
            <Button className="mt-4" onClick={() => setShowCreateForm(true)}>
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
      {/* Header */}
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
          {showCreateForm ? "Cancelar" : (
            <>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nova Consulta
            </>
          )}
        </Button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <EncounterCreateForm
          patientId={patientId}
          specialtyId={specialtyId}
          onCreated={(encId) => {
            setShowCreateForm(false);
            navigate(`/patient/${patientId}/encounter/${encId}`);
          }}
        />
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Clock className="h-5 w-5 animate-spin text-muted-foreground mr-2" />
          <span className="text-sm text-muted-foreground">Carregando consultas...</span>
        </div>
      )}

      {/* Timeline */}
      {!loading && encounters.length > 0 && (
        <div className="space-y-1 relative">
          {encounters.map((enc) => (
            <EncounterTimelineCard
              key={enc.id}
              encounter={enc}
              specialtyLabel={getSpecialtyLabel(enc.specialty_id)}
              patientId={patientId}
              isExpanded={expandedId === enc.id}
              onToggle={() => setExpandedId(expandedId === enc.id ? null : enc.id)}
              onClose={() => setExpandedId(null)}
            >
              <EncounterInlineDetail
                encounterId={enc.id}
                patientId={patientId}
                isFinalized={enc.status === "finalized"}
              />
            </EncounterTimelineCard>
          ))}
        </div>
      )}
    </div>
  );
}
