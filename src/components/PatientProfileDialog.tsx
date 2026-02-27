import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { UserCircle2, Dumbbell, Target, AlertCircle, Activity } from "lucide-react";

const OBJECTIVES = [
  { id: "performance_esportiva", label: "Performance esportiva" },
  { id: "ganho_massa", label: "Ganho de massa muscular" },
  { id: "emagrecimento", label: "Emagrecimento" },
  { id: "desinflamacao", label: "Desinflamação / dor crônica" },
  { id: "energia_disposicao", label: "Energia e disposição" },
  { id: "longevidade", label: "Longevidade / anti-aging" },
  { id: "saude_hormonal", label: "Saúde hormonal" },
  { id: "imunidade", label: "Imunidade" },
  { id: "cognicao_foco", label: "Cognição / foco" },
  { id: "saude_pele", label: "Saúde da pele / estética" },
  { id: "sono", label: "Sono" },
  { id: "libido", label: "Libido" },
  { id: "recuperacao_muscular", label: "Recuperação muscular" },
  { id: "saude_intestinal", label: "Saúde intestinal" },
];

const ACTIVITY_LEVELS = [
  { id: "sedentario", label: "Sedentário" },
  { id: "ativo_leve", label: "Ativo (1–2x/semana)" },
  { id: "ativo", label: "Ativo (3–4x/semana)" },
  { id: "muito_ativo", label: "Muito ativo (5+x/semana)" },
  { id: "atleta_amador", label: "Atleta amador" },
  { id: "atleta_alto_rendimento", label: "Atleta de alto rendimento" },
];

interface PatientProfile {
  objectives: string[] | null;
  activity_level: string | null;
  sport_modality: string | null;
  main_complaints: string | null;
  restrictions: string | null;
}

interface PatientProfileDialogProps {
  open: boolean;
  onClose: () => void;
  profile: PatientProfile;
  onSave: (profile: PatientProfile) => Promise<void>;
}

export function PatientProfileDialog({
  open,
  onClose,
  profile,
  onSave,
}: PatientProfileDialogProps) {
  const [objectives, setObjectives] = useState<string[]>([]);
  const [activityLevel, setActivityLevel] = useState<string>("");
  const [sportModality, setSportModality] = useState<string>("");
  const [mainComplaints, setMainComplaints] = useState<string>("");
  const [restrictions, setRestrictions] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setObjectives(profile.objectives ?? []);
      setActivityLevel(profile.activity_level ?? "");
      setSportModality(profile.sport_modality ?? "");
      setMainComplaints(profile.main_complaints ?? "");
      setRestrictions(profile.restrictions ?? "");
    }
  }, [open, profile]);

  const toggleObjective = (id: string) => {
    setObjectives((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      objectives,
      activity_level: activityLevel || null,
      sport_modality: sportModality.trim() || null,
      main_complaints: mainComplaints.trim() || null,
      restrictions: restrictions.trim() || null,
    });
    setSaving(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCircle2 className="h-5 w-5 text-blue-600" />
            Perfil e Objetivos do Paciente
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Essas informações são usadas pela IA para personalizar a recomendação de protocolos Essential.
          </p>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Objectives */}
          <div>
            <Label className="flex items-center gap-1.5 mb-3 text-sm font-semibold">
              <Target className="h-4 w-4 text-blue-600" />
              Objetivos principais
            </Label>
            <div className="flex flex-wrap gap-2">
              {OBJECTIVES.map((obj) => {
                const selected = objectives.includes(obj.id);
                return (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => toggleObjective(obj.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm border transition-all",
                      selected
                        ? "bg-blue-600 text-white border-blue-600 font-medium"
                        : "bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-700"
                    )}
                  >
                    {obj.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Activity Level */}
          <div>
            <Label className="flex items-center gap-1.5 mb-3 text-sm font-semibold">
              <Activity className="h-4 w-4 text-green-600" />
              Nível de atividade física
            </Label>
            <div className="flex flex-wrap gap-2">
              {ACTIVITY_LEVELS.map((level) => {
                const selected = activityLevel === level.id;
                return (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setActivityLevel(selected ? "" : level.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm border transition-all",
                      selected
                        ? "bg-green-600 text-white border-green-600 font-medium"
                        : "bg-white text-gray-700 border-gray-200 hover:border-green-300 hover:text-green-700"
                    )}
                  >
                    {level.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sport Modality */}
          <div>
            <Label className="flex items-center gap-1.5 mb-2 text-sm font-semibold">
              <Dumbbell className="h-4 w-4 text-orange-500" />
              Modalidade esportiva
              <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <input
              type="text"
              value={sportModality}
              onChange={(e) => setSportModality(e.target.value)}
              placeholder="Ex: corrida, musculação, natação, ciclismo..."
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>

          {/* Main Complaints */}
          <div>
            <Label className="flex items-center gap-1.5 mb-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Queixas principais
              <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              value={mainComplaints}
              onChange={(e) => setMainComplaints(e.target.value)}
              placeholder="Ex: cansaço ao acordar, dores nas articulações, dificuldade de concentração..."
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          {/* Restrictions */}
          <div>
            <Label className="flex items-center gap-1.5 mb-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Restrições / alergias
              <span className="text-xs font-normal text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              value={restrictions}
              onChange={(e) => setRestrictions(e.target.value)}
              placeholder="Ex: alergia a vitamina C IV, intolerância a determinado componente..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {/* Summary preview */}
          {objectives.length > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs text-blue-700 font-medium mb-2">Perfil atual:</p>
              <div className="flex flex-wrap gap-1">
                {objectives.map((id) => {
                  const obj = OBJECTIVES.find((o) => o.id === id);
                  return obj ? (
                    <Badge key={id} variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                      {obj.label}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Perfil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
