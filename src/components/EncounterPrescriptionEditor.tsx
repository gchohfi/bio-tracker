import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Plus,
  Save,
  Trash2,
  Pill,
  CheckCircle2,
  Copy,
  Brain,
  Check,
  Pencil,
  X,
  User,
  Undo2,
} from "lucide-react";

// ── Types ──

export type ItemOrigin =
  | "suggested_by_ai"
  | "accepted_by_physician"
  | "edited_by_physician"
  | "removed_by_physician"
  | "manually_added";

interface PrescriptionItemCore {
  substance: string;
  dose: string;
  route: string;
  frequency: string;
  duration: string;
  conditions: string;
  monitoring: string;
}

export interface PrescriptionItem extends PrescriptionItemCore {
  /** Current status in the physician review workflow */
  origin: ItemOrigin;
  /** Snapshot of the AI-suggested values (immutable, for audit) */
  ai_original?: PrescriptionItemCore;
}

interface EncounterPrescriptionEditorProps {
  encounterId: string;
  patientId: string;
  specialtyId: string;
  isFinalized: boolean;
  /** Legacy prescription from analysis to use as fallback seed */
  legacyPrescription?: any[];
}

const EMPTY_CORE: PrescriptionItemCore = {
  substance: "",
  dose: "",
  route: "",
  frequency: "",
  duration: "",
  conditions: "",
  monitoring: "",
};

// ── Helpers ──

/** Maps legacy prescription_table items (from AI analysis) to tracked format */
function mapLegacyItems(legacy: any[]): PrescriptionItem[] {
  return legacy.map((item) => {
    const core: PrescriptionItemCore = {
      substance: item.substance ?? item.substancia ?? item.supplement ?? item.name ?? item.key_actives?.join(", ") ?? "",
      dose: item.dose ?? item.dosage ?? item.composition ?? "",
      route: item.route ?? item.via ?? "",
      frequency: item.frequency ?? item.frequencia ?? item.posologia ?? "",
      duration: item.duration ?? item.duracao ?? "",
      conditions: item.conditions ?? item.condicoes_ci ?? item.contraindications ?? item.ci ?? "",
      monitoring: item.monitoring ?? item.monitorizacao ?? item.monitoramento ?? "",
    };
    return { ...core, origin: "suggested_by_ai" as ItemOrigin, ai_original: { ...core } };
  });
}

/** Migrate old items that lack the `origin` field */
function migrateItem(item: any): PrescriptionItem {
  if (item.origin) return item as PrescriptionItem;
  return { ...item, origin: "manually_added" as ItemOrigin };
}

function hasBeenEdited(item: PrescriptionItem): boolean {
  if (!item.ai_original) return false;
  const fields: (keyof PrescriptionItemCore)[] = ["substance", "dose", "route", "frequency", "duration", "conditions", "monitoring"];
  return fields.some((f) => item[f] !== item.ai_original![f]);
}

// ── Origin labels & colors ──

const ORIGIN_CONFIG: Record<ItemOrigin, { label: string; icon: typeof Brain; className: string }> = {
  suggested_by_ai: { label: "Sugestão IA", icon: Brain, className: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  accepted_by_physician: { label: "Aceito", icon: Check, className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  edited_by_physician: { label: "Editado", icon: Pencil, className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  removed_by_physician: { label: "Removido", icon: X, className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  manually_added: { label: "Manual", icon: User, className: "bg-muted text-muted-foreground" },
};

// ── Component ──

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

  // ── Load ──
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("clinical_prescriptions")
      .select("*")
      .eq("encounter_id", encounterId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setPrescriptionId(data.id);
      const raw = Array.isArray(data.prescription_json) ? data.prescription_json : [];
      setItems(raw.map(migrateItem));
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

  // ── Seed from AI ──
  const seedFromLegacy = () => {
    if (!legacyPrescription || legacyPrescription.length === 0) return;
    setItems(mapLegacyItems(legacyPrescription));
    setSeeded(true);
    toast({ title: "Prescrição importada da análise IA", description: "Revise cada item antes de finalizar." });
  };

  // ── Save (excludes removed items from final payload) ──
  const handleSave = async (overrideStatus?: "draft" | "finalized") => {
    if (!user?.id) return;
    setSaving(true);
    const effectiveStatus = overrideStatus ?? status;
    // Keep removed items in draft for audit, but strip from finalized
    const payload_items = effectiveStatus === "finalized"
      ? items.filter((i) => i.origin !== "removed_by_physician")
      : items;

    const payload = {
      encounter_id: encounterId,
      patient_id: patientId,
      practitioner_id: user.id,
      specialty_id: specialtyId,
      status: effectiveStatus,
      prescription_json: payload_items,
    };

    if (prescriptionId) {
      await (supabase as any)
        .from("clinical_prescriptions")
        .update({ prescription_json: payload_items, status: effectiveStatus })
        .eq("id", prescriptionId);
    } else {
      const { data } = await (supabase as any)
        .from("clinical_prescriptions")
        .insert(payload)
        .select()
        .single();
      if (data) setPrescriptionId(data.id);
    }

    if (effectiveStatus === "finalized") {
      setItems(payload_items);
      setStatus("finalized");
    }
    toast({ title: effectiveStatus === "finalized" ? "Prescrição finalizada" : "Prescrição salva" });
    setSaving(false);
  };

  // ── Item actions ──
  const addItem = () =>
    setItems((prev) => [...prev, { ...EMPTY_CORE, origin: "manually_added" }]);

  const softRemoveItem = (idx: number) =>
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        // AI items → mark removed; manual items → hard delete handled below
        if (item.ai_original) return { ...item, origin: "removed_by_physician" };
        return item;
      }).filter((item, i) => {
        // Hard-delete manual items
        if (i === idx && !item.ai_original) return false;
        return true;
      })
    );

  const restoreItem = (idx: number) =>
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx && item.ai_original
          ? { ...item, ...item.ai_original, origin: "suggested_by_ai" }
          : item
      )
    );

  const acceptItem = (idx: number) =>
    setItems((prev) =>
      prev.map((item, i) =>
        i === idx ? { ...item, origin: "accepted_by_physician" } : item
      )
    );

  const updateItem = (idx: number, field: keyof PrescriptionItemCore, value: string) =>
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        // Auto-detect edit vs accept
        if (item.ai_original) {
          updated.origin = hasBeenEdited({ ...updated, ai_original: item.ai_original })
            ? ("edited_by_physician" as ItemOrigin)
            : ("accepted_by_physician" as ItemOrigin);
        }
        return updated;
      })
    );

  const editable = !isFinalized && status !== "finalized";
  const activeItems = items.filter((i) => i.origin !== "removed_by_physician");
  const removedItems = items.filter((i) => i.origin === "removed_by_physician");
  const pendingReview = items.some((i) => i.origin === "suggested_by_ai");

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
    <TooltipProvider>
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-2">
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
              {pendingReview && editable && (
                <Badge className="text-[9px] h-4 bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-0 animate-pulse">
                  Itens pendentes de revisão
                </Badge>
              )}
            </p>
            <div className="flex gap-1.5 flex-wrap">
              {editable && !seeded && legacyPrescription && legacyPrescription.length > 0 && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={seedFromLegacy}>
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
                    onClick={() => handleSave("finalized")}
                    disabled={saving || activeItems.length === 0 || pendingReview}
                    title={pendingReview ? "Revise todos os itens da IA antes de finalizar" : ""}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    Finalizar
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Active items */}
          {activeItems.length === 0 && removedItems.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              Nenhum item na prescrição.
              {legacyPrescription && legacyPrescription.length > 0 && !seeded && (
                <> Clique em "Importar da IA" para carregar sugestões.</>
              )}
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item, idx) => {
                const isRemoved = item.origin === "removed_by_physician";
                const cfg = ORIGIN_CONFIG[item.origin];
                const Icon = cfg.icon;

                return (
                  <div
                    key={idx}
                    className={cn(
                      "rounded-lg border p-3 space-y-2 relative group transition-all",
                      isRemoved && "opacity-50 border-dashed bg-muted/30",
                      item.origin === "suggested_by_ai" && "border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/10",
                    )}
                  >
                    {/* Origin badge + actions */}
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="secondary" className={cn("text-[9px] h-4 gap-0.5 border-0", cfg.className)}>
                        <Icon className="h-2.5 w-2.5" />
                        {cfg.label}
                      </Badge>

                      {editable && !isRemoved && (
                        <div className="flex items-center gap-1">
                          {item.origin === "suggested_by_ai" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => acceptItem(idx)}
                                  className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 transition-colors"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">Aceitar sugestão</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => softRemoveItem(idx)}
                                className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">Remover item</TooltipContent>
                          </Tooltip>
                        </div>
                      )}

                      {editable && isRemoved && item.ai_original && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => restoreItem(idx)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground transition-colors"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">Restaurar sugestão original</TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* AI original reference (collapsed, shown on edited items) */}
                    {item.ai_original && item.origin === "edited_by_physician" && (
                      <p className="text-[10px] text-muted-foreground italic line-through">
                        IA: {item.ai_original.substance} — {item.ai_original.dose} — {item.ai_original.frequency}
                      </p>
                    )}

                    {/* Fields */}
                    {!isRemoved && (
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
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
