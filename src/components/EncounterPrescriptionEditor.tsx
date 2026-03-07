import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Plus, Save, Trash2, Pill, CheckCircle2, Copy } from "lucide-react";

interface PrescriptionItem {
  substance: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  conditions: string;
  monitoring: string;
}

interface EncounterPrescriptionEditorProps {
  encounterId: string;
  patientId: string;
  specialtyId: string;
  isFinalized: boolean;
  /** Legacy prescription from analysis to use as fallback seed */
  legacyPrescription?: any[];
}

const EMPTY_ITEM: PrescriptionItem = {
  substance: "",
  dose: "",
  route: "",
  frequency: "",
  duration: "",
  conditions: "",
  monitoring: "",
};

/**
 * Maps legacy prescription_table items (from AI analysis) to our structured format.
 */
function mapLegacyItems(legacy: any[]): PrescriptionItem[] {
  return legacy.map((item) => ({
    substance: item.substance ?? item.supplement ?? item.name ?? item.key_actives?.join(", ") ?? "",
    dose: item.dose ?? item.dosage ?? item.composition ?? "",
    route: item.route ?? item.via ?? "",
    frequency: item.frequency ?? item.posologia ?? "",
    duration: item.duration ?? "",
    conditions: item.conditions ?? item.contraindications ?? item.ci ?? "",
    monitoring: item.monitoring ?? item.monitoramento ?? "",
  }));
}

export function EncounterPrescriptionEditor({
  encounterId,
  patientId,
  specialtyId,
  isFinalized,
  legacyPrescription,
}: EncounterPrescriptionEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [prescriptionId, setPrescriptionId] = useState<string | null>(null);
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [status, setStatus] = useState<"draft" | "finalized">("draft");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // ── Load prescription ──
  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("clinical_prescriptions")
      .select("*")
      .eq("encounter_id", encounterId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setPrescriptionId(data.id);
      setItems(Array.isArray(data.prescription_json) ? data.prescription_json : []);
      setStatus(data.status);
      setSeeded(true);
    } else {
      setPrescriptionId(null);
      setItems([]);
      setStatus("draft");
      setSeeded(false);
    }
    setLoading(false);
  }, [encounterId]);

  useEffect(() => { load(); }, [load]);

  // ── Seed from legacy ──
  const seedFromLegacy = () => {
    if (!legacyPrescription || legacyPrescription.length === 0) return;
    const mapped = mapLegacyItems(legacyPrescription);
    setItems(mapped);
    setSeeded(true);
    toast({ title: "Prescrição importada da análise IA" });
  };

  // ── Save ──
  const handleSave = async (overrideStatus?: "draft" | "finalized") => {
    if (!user?.id) return;
    setSaving(true);
    const effectiveStatus = overrideStatus ?? status;

    const payload = {
      encounter_id: encounterId,
      patient_id: patientId,
      practitioner_id: user.id,
      specialty_id: specialtyId,
      status: effectiveStatus,
      prescription_json: items,
    };

    if (prescriptionId) {
      await (supabase as any)
        .from("clinical_prescriptions")
        .update({ prescription_json: items, status: effectiveStatus })
        .eq("id", prescriptionId);
    } else {
      const { data } = await (supabase as any)
        .from("clinical_prescriptions")
        .insert(payload)
        .select()
        .single();
      if (data) setPrescriptionId(data.id);
    }

    toast({ title: "Prescrição salva" });
    setSaving(false);
  };

  // ── Item CRUD ──
  const addItem = () => setItems((prev) => [...prev, { ...EMPTY_ITEM }]);

  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateItem = (idx: number, field: keyof PrescriptionItem, value: string) =>
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));

  const editable = !isFinalized && status !== "finalized";

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">Carregando prescrição...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium flex items-center gap-1.5">
            <Pill className="h-3.5 w-3.5 text-primary" />
            Prescrição da Consulta
            <Badge
              variant={status === "finalized" ? "default" : "outline"}
              className={cn(
                "text-[9px] h-4 ml-1",
                status === "finalized" &&
                  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0"
              )}
            >
              {status === "finalized" ? "Finalizada" : "Rascunho"}
            </Badge>
          </p>
          <div className="flex gap-1.5">
            {editable && !seeded && legacyPrescription && legacyPrescription.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={seedFromLegacy}
              >
                <Copy className="h-3 w-3" />
                Importar da IA
              </Button>
            )}
            {editable && (
              <>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addItem}>
                  <Plus className="h-3 w-3" />
                  Item
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleSave()} disabled={saving}>
                  <Save className="h-3 w-3" />
                  Salvar
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setStatus("finalized");
                    handleSave("finalized");
                  }}
                  disabled={saving || items.length === 0}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Finalizar
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            Nenhum item na prescrição.
            {legacyPrescription && legacyPrescription.length > 0 && !seeded && (
              <> Clique em "Importar da IA" para carregar da análise.</>
            )}
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={idx}
                className="rounded-lg border p-3 space-y-2 relative group"
              >
                {editable && (
                  <button
                    onClick={() => removeItem(idx)}
                    className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    title="Remover item"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Substância</Label>
                    <Input
                      value={item.substance}
                      onChange={(e) => updateItem(idx, "substance", e.target.value)}
                      disabled={!editable}
                      className="h-7 text-xs"
                      placeholder="Ex: Vitamina D3"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Dose</Label>
                    <Input
                      value={item.dose}
                      onChange={(e) => updateItem(idx, "dose", e.target.value)}
                      disabled={!editable}
                      className="h-7 text-xs"
                      placeholder="Ex: 10.000 UI"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Via</Label>
                    <Input
                      value={item.route}
                      onChange={(e) => updateItem(idx, "route", e.target.value)}
                      disabled={!editable}
                      className="h-7 text-xs"
                      placeholder="Ex: Oral"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Frequência</Label>
                    <Input
                      value={item.frequency}
                      onChange={(e) => updateItem(idx, "frequency", e.target.value)}
                      disabled={!editable}
                      className="h-7 text-xs"
                      placeholder="Ex: 1x/dia"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Duração</Label>
                    <Input
                      value={item.duration}
                      onChange={(e) => updateItem(idx, "duration", e.target.value)}
                      disabled={!editable}
                      className="h-7 text-xs"
                      placeholder="Ex: 90 dias"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Condições / CI</Label>
                    <Input
                      value={item.conditions}
                      onChange={(e) => updateItem(idx, "conditions", e.target.value)}
                      disabled={!editable}
                      className="h-7 text-xs"
                      placeholder="Ex: Não usar se gestante"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Monitorização</Label>
                    <Input
                      value={item.monitoring}
                      onChange={(e) => updateItem(idx, "monitoring", e.target.value)}
                      disabled={!editable}
                      className="h-7 text-xs"
                      placeholder="Ex: Dosar 25-OH em 90d"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
