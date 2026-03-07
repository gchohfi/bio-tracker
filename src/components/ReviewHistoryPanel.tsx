import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  History,
  ChevronDown,
  Check,
  Pencil,
  X,
  Clock,
  Hash,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ReviewState } from "@/hooks/useReviewState";

interface SnapshotRow {
  id: string;
  analysis_id: string;
  patient_id: string;
  practitioner_id: string;
  analysis_v2_hash: string | null;
  schema_version: number;
  review_state_json: ReviewState;
  snapshot_reason: string;
  saved_at: string;
}

interface SnapshotStats {
  total: number;
  accepted: number;
  edited: number;
  rejected: number;
  pending: number;
}

function computeStats(state: ReviewState, allItemIds?: string[]): SnapshotStats {
  const entries = Object.values(state);
  const total = allItemIds?.length ?? entries.length;
  let accepted = 0, edited = 0, rejected = 0;

  for (const item of entries) {
    if (item.decision === "accepted") accepted++;
    else if (item.decision === "edited") edited++;
    else if (item.decision === "rejected") rejected++;
  }

  return { total, accepted, edited, rejected, pending: total - accepted - edited - rejected };
}

const REASON_LABELS: Record<string, string> = {
  auto_save: "Salvamento automático",
  manual_save: "Salvamento manual",
  review_completed: "Revisão finalizada",
};

interface ReviewHistoryPanelProps {
  analysisId: string;
  currentHash: string | null;
  allItemIds: string[];
}

export function ReviewHistoryPanel({ analysisId, currentHash, allItemIds }: ReviewHistoryPanelProps) {
  const { user } = useAuth();
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !analysisId || !user?.id) return;
    setLoading(true);
    (supabase as any)
      .from("review_snapshots")
      .select("*")
      .eq("analysis_id", analysisId)
      .eq("practitioner_id", user.id)
      .order("saved_at", { ascending: false })
      .limit(50)
      .then(({ data, error }: { data: SnapshotRow[] | null; error: any }) => {
        if (error) console.warn("[ReviewHistory] load failed:", error.message);
        setSnapshots(data ?? []);
        setLoading(false);
      });
  }, [open, analysisId, user?.id]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" variant="ghost" className="h-7 text-[11px] px-2 gap-1">
          <History className="h-3.5 w-3.5" />
          Histórico
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[420px] sm:w-[480px] p-0">
        <SheetHeader className="px-6 pt-6 pb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" />
            Histórico de Revisões
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            Timeline de snapshots salvos para esta análise.
          </p>
        </SheetHeader>
        <Separator />
        <ScrollArea className="h-[calc(100vh-120px)]">
          <div className="px-6 py-4 space-y-1">
            {loading && (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
            )}
            {!loading && snapshots.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum snapshot de revisão encontrado.
              </p>
            )}

            {/* Current state indicator */}
            {!loading && snapshots.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  Estado atual salvo em analysis_reviews
                </span>
              </div>
            )}

            {snapshots.map((snap, idx) => {
              const stats = computeStats(snap.review_state_json, allItemIds);
              const isLatest = idx === 0;
              const isExpanded = expandedId === snap.id;
              const hashMatch = currentHash && snap.analysis_v2_hash === currentHash;

              return (
                <Collapsible
                  key={snap.id}
                  open={isExpanded}
                  onOpenChange={() => setExpandedId(isExpanded ? null : snap.id)}
                >
                  <div
                    className={cn(
                      "relative border rounded-lg transition-colors",
                      isLatest
                        ? "border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/10"
                        : "border-border bg-card"
                    )}
                  >
                    {/* Timeline line */}
                    {idx < snapshots.length - 1 && (
                      <div className="absolute left-5 top-full w-px h-1 bg-border" />
                    )}

                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-start gap-3 p-3 text-left hover:bg-muted/30 rounded-lg transition-colors">
                        <div className={cn(
                          "mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold",
                          isLatest
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {isLatest ? <Star className="h-3 w-3" /> : (snapshots.length - idx)}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium">
                              {format(new Date(snap.saved_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                            </span>
                            {isLatest && (
                              <Badge className="text-[9px] h-4 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">
                                Mais recente
                              </Badge>
                            )}
                          </div>

                          {/* Stats row */}
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="flex items-center gap-0.5 text-emerald-600">
                              <Check className="h-2.5 w-2.5" /> {stats.accepted}
                            </span>
                            <span className="flex items-center gap-0.5 text-blue-600">
                              <Pencil className="h-2.5 w-2.5" /> {stats.edited}
                            </span>
                            <span className="flex items-center gap-0.5 text-red-500">
                              <X className="h-2.5 w-2.5" /> {stats.rejected}
                            </span>
                            <span className="flex items-center gap-0.5 text-muted-foreground">
                              <Clock className="h-2.5 w-2.5" /> {stats.pending}
                            </span>
                            <span className="text-muted-foreground ml-auto">
                              {stats.accepted + stats.edited + stats.rejected}/{stats.total} revisados
                            </span>
                          </div>
                        </div>

                        <ChevronDown className={cn(
                          "h-4 w-4 text-muted-foreground shrink-0 mt-1 transition-transform",
                          isExpanded && "rotate-180"
                        )} />
                      </button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/50 mt-1">
                        {/* Metadata */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted-foreground pt-2">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Motivo:</span>
                            <span>{REASON_LABELS[snap.snapshot_reason] ?? snap.snapshot_reason}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">Schema:</span>
                            <span>v{snap.schema_version}</span>
                          </div>
                          <div className="flex items-center gap-1 col-span-2">
                            <Hash className="h-2.5 w-2.5" />
                            <span className="font-medium">Hash:</span>
                            <code className="font-mono text-[9px]">{snap.analysis_v2_hash ?? "—"}</code>
                            {hashMatch && (
                              <Badge className="text-[8px] h-3.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-0 ml-1">
                                compatível
                              </Badge>
                            )}
                            {snap.analysis_v2_hash && !hashMatch && (
                              <Badge className="text-[8px] h-3.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300 border-0 ml-1">
                                desatualizado
                              </Badge>
                            )}
                          </div>
                        </div>

                        <Separator className="my-1" />

                        {/* Individual item decisions */}
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          <p className="text-[10px] font-medium text-muted-foreground">Decisões registradas:</p>
                          {Object.entries(snap.review_state_json).map(([itemId, review]) => (
                            <div key={itemId} className="flex items-center gap-2 text-[10px] py-0.5">
                              <DecisionDot decision={review.decision} />
                              <code className="font-mono text-[9px] text-muted-foreground truncate max-w-[120px]">
                                {itemId}
                              </code>
                              <span className="text-muted-foreground">→</span>
                              <span className={cn(
                                "font-medium",
                                review.decision === "accepted" && "text-emerald-600",
                                review.decision === "edited" && "text-blue-600",
                                review.decision === "rejected" && "text-red-500",
                              )}>
                                {review.decision === "accepted" ? "Aceito" :
                                 review.decision === "edited" ? "Editado" :
                                 review.decision === "rejected" ? "Rejeitado" : "Pendente"}
                              </span>
                              {review.edited_content && (
                                <span className="text-muted-foreground truncate max-w-[100px]" title={review.edited_content}>
                                  "{review.edited_content.slice(0, 30)}…"
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function DecisionDot({ decision }: { decision: string }) {
  return (
    <div className={cn(
      "h-2 w-2 rounded-full shrink-0",
      decision === "accepted" && "bg-emerald-500",
      decision === "edited" && "bg-blue-500",
      decision === "rejected" && "bg-red-500",
      decision === "pending" && "bg-muted-foreground/40",
    )} />
  );
}
