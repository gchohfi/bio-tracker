import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FlaskConical,
  Scale,
  FileImage,
  Link2,
  Unlink,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// ── Types ──

interface LinkedItem {
  id: string;
  date: string;
  label: string;
  detail?: string;
  type: "lab" | "body" | "imaging";
  encounter_id: string | null;
}

interface LinkedExamsSectionProps {
  encounterId: string;
  patientId: string;
  practitionerId: string;
  encounterDate: string;
  isFinalized: boolean;
}

// ── Component ──

export function LinkedExamsSection({
  encounterId,
  patientId,
  practitionerId,
  encounterDate,
  isFinalized,
}: LinkedExamsSectionProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<LinkedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [showAvailable, setShowAvailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [labRes, bodyRes, imgRes] = await Promise.all([
      (supabase as any)
        .from("lab_sessions")
        .select("id, session_date, encounter_id")
        .eq("patient_id", patientId)
        .order("session_date", { ascending: false }),
      (supabase as any)
        .from("body_composition_sessions")
        .select("id, session_date, encounter_id, weight_kg, body_fat_pct")
        .eq("patient_id", patientId)
        .eq("practitioner_id", practitionerId)
        .order("session_date", { ascending: false }),
      (supabase as any)
        .from("imaging_reports")
        .select("id, report_date, encounter_id, exam_type, exam_region")
        .eq("patient_id", patientId)
        .eq("practitioner_id", practitionerId)
        .order("report_date", { ascending: false }),
    ]);

    const all: LinkedItem[] = [];

    for (const s of labRes.data ?? []) {
      all.push({
        id: s.id,
        date: s.session_date,
        label: `Sessão laboratorial`,
        detail: format(parseISO(s.session_date), "dd/MM/yyyy"),
        type: "lab",
        encounter_id: s.encounter_id,
      });
    }
    for (const b of bodyRes.data ?? []) {
      const parts: string[] = [];
      if (b.weight_kg) parts.push(`${b.weight_kg} kg`);
      if (b.body_fat_pct) parts.push(`${b.body_fat_pct}% gordura`);
      all.push({
        id: b.id,
        date: b.session_date,
        label: `Composição corporal`,
        detail: parts.length > 0 ? parts.join(" · ") : format(parseISO(b.session_date), "dd/MM/yyyy"),
        type: "body",
        encounter_id: b.encounter_id,
      });
    }
    for (const r of imgRes.data ?? []) {
      all.push({
        id: r.id,
        date: r.report_date,
        label: r.exam_type || "Laudo de imagem",
        detail: r.exam_region || format(parseISO(r.report_date), "dd/MM/yyyy"),
        type: "imaging",
        encounter_id: r.encounter_id,
      });
    }

    setItems(all);
    setLoading(false);
  }, [patientId, practitionerId]);

  useEffect(() => { load(); }, [load]);

  // ── Derived lists ──
  const linked = useMemo(() => items.filter((i) => i.encounter_id === encounterId), [items, encounterId]);
  const available = useMemo(() => {
    return items.filter((i) => !i.encounter_id || i.encounter_id !== encounterId);
  }, [items, encounterId]);

  // Suggested = within 14 days of encounter date and not linked elsewhere
  const suggested = useMemo(() => {
    const encDate = parseISO(encounterDate);
    return available.filter((i) => {
      if (i.encounter_id) return false; // already linked to another encounter
      const diff = Math.abs(differenceInDays(parseISO(i.date), encDate));
      return diff <= 14;
    });
  }, [available, encounterDate]);

  const otherAvailable = useMemo(() => {
    const sugIds = new Set(suggested.map((s) => s.id + s.type));
    return available.filter((i) => !sugIds.has(i.id + i.type));
  }, [available, suggested]);

  // ── Toggle link ──
  const toggleLink = async (item: LinkedItem, link: boolean) => {
    setToggling(item.id + item.type);
    const table =
      item.type === "lab" ? "lab_sessions" :
      item.type === "body" ? "body_composition_sessions" :
      "imaging_reports";

    const { error } = await (supabase as any)
      .from(table)
      .update({ encounter_id: link ? encounterId : null })
      .eq("id", item.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id && i.type === item.type
            ? { ...i, encounter_id: link ? encounterId : null }
            : i
        )
      );
    }
    setToggling(null);
  };

  // ── Icon per type ──
  const TypeIcon = ({ type }: { type: LinkedItem["type"] }) => {
    if (type === "lab") return <FlaskConical className="h-3.5 w-3.5 text-primary" />;
    if (type === "body") return <Scale className="h-3.5 w-3.5 text-emerald-600" />;
    return <FileImage className="h-3.5 w-3.5 text-violet-600" />;
  };

  const typeLabel = (type: LinkedItem["type"]) => {
    if (type === "lab") return "Lab";
    if (type === "body") return "Corpo";
    return "Imagem";
  };

  // ── Item row ──
  const ItemRow = ({ item, isLinked }: { item: LinkedItem; isLinked: boolean }) => {
    const isThisToggling = toggling === item.id + item.type;
    const linkedElsewhere = !!item.encounter_id && item.encounter_id !== encounterId;

    return (
      <div className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <TypeIcon type={item.type} />
          <div className="min-w-0">
            <span className="text-xs font-medium text-foreground truncate block">{item.label}</span>
            <span className="text-[10px] text-muted-foreground">
              {format(parseISO(item.date), "dd/MM/yyyy")}
              {item.detail && item.detail !== format(parseISO(item.date), "dd/MM/yyyy") && ` · ${item.detail}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {linkedElsewhere && (
            <Badge variant="outline" className="text-[8px] h-4 px-1 text-muted-foreground">
              outra consulta
            </Badge>
          )}
          {!isFinalized && (
            <Button
              size="sm"
              variant={isLinked ? "ghost" : "outline"}
              className={cn(
                "h-6 px-2 text-[10px] gap-1",
                isLinked ? "text-destructive hover:bg-destructive/10" : "text-primary"
              )}
              onClick={() => toggleLink(item, !isLinked)}
              disabled={isThisToggling}
            >
              {isThisToggling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : isLinked ? (
                <><Unlink className="h-3 w-3" />Desvincular</>
              ) : (
                <><Link2 className="h-3 w-3" />Vincular</>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-4 px-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Exames Vinculados</h2>
            {linked.length > 0 && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{linked.length}</Badge>
            )}
          </div>
        </div>

        {/* Linked items */}
        {linked.length > 0 ? (
          <div className="space-y-0.5">
            {linked.map((item) => (
              <ItemRow key={item.id + item.type} item={item} isLinked />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">
            Nenhum exame vinculado a esta consulta ainda.
          </p>
        )}

        {/* Suggested items */}
        {!isFinalized && suggested.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                Sugestões (±14 dias)
              </span>
            </div>
            <div className="space-y-0.5">
              {suggested.map((item) => (
                <ItemRow key={item.id + item.type} item={item} isLinked={false} />
              ))}
            </div>
          </div>
        )}

        {/* All other available */}
        {!isFinalized && otherAvailable.length > 0 && (
          <Collapsible open={showAvailable} onOpenChange={setShowAvailable}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 text-muted-foreground w-full justify-start">
                {showAvailable ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Ver todos os exames disponíveis ({otherAvailable.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-0.5 mt-1">
              {otherAvailable.map((item) => (
                <ItemRow key={item.id + item.type} item={item} isLinked={false} />
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
