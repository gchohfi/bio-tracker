import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trace } from "@/lib/traceability";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Activity,
  Lightbulb,
  Stethoscope,
  ChevronDown,
  ChevronRight,
  Shield,
  FlaskConical,
  Info,
  Check,
  Pencil,
  X,
  Undo2,
  MessageSquare,
  FileDown,
} from "lucide-react";
import {
  useReviewState,
  type ReviewDecision,
  type ItemReview,
  type ReviewState,
  type ReviewStats,
} from "@/hooks/useReviewState";
import { buildReviewedReport } from "@/lib/buildReviewedReport";
import { generateReportV2Pdf } from "@/lib/generateReportV2Pdf";
import { computeAnalysisV2Hash, computeAnalysisV2HashSync, REVIEW_SCHEMA_VERSION } from "@/lib/analysisV2Hash";
import { ReviewHistoryPanel } from "@/components/ReviewHistoryPanel";



// ── Types matching analysisResponseV2.types.ts ──────────────────────────

type ClinicalPriority = "critical" | "high" | "medium" | "low";
type ConfidenceLevel = "high" | "moderate" | "low";
type SourceType = "deterministic" | "llm" | "hybrid";
type RedFlagSeverity = "critical" | "high" | "moderate";

interface ClinicalItemBase {
  id: string;
  source_type: SourceType;
  specialty_relevant: boolean;
  cross_specialty_alert: boolean;
}

interface RedFlagItem extends ClinicalItemBase {
  finding: string;
  severity: RedFlagSeverity;
  suggested_action: string;
  evidence: string[];
}

interface ClinicalFindingItem extends ClinicalItemBase {
  system: string;
  markers: string[];
  interpretation: string;
  priority: ClinicalPriority;
  confidence: ConfidenceLevel;
}

interface DiagnosticHypothesisItem extends ClinicalItemBase {
  hypothesis: string;
  supporting_findings: string[];
  contradicting_findings?: string[];
  confirmatory_exams?: string[];
  likelihood: "probable" | "possible" | "unlikely";
  priority: ClinicalPriority;
}

interface SuggestedActionItem extends ClinicalItemBase {
  action_type: "investigate" | "treat" | "monitor" | "refer";
  description: string;
  rationale: string;
  priority: ClinicalPriority;
  confidence: ConfidenceLevel;
}

interface FollowUp {
  suggested_exams: string[];
  suggested_return_days?: number;
  notes?: string;
}

export interface AnalysisV2Data {
  executive_summary: string;
  red_flags: RedFlagItem[];
  clinical_findings: ClinicalFindingItem[];
  diagnostic_hypotheses: DiagnosticHypothesisItem[];
  suggested_actions: SuggestedActionItem[];
  follow_up?: FollowUp;
  meta: {
    specialty_id: string;
    specialty_name: string;
    mode: string;
    version: string;
    model_used?: string;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<ClinicalPriority, { label: string; className: string }> = {
  critical: { label: "Crítico", className: "bg-destructive text-destructive-foreground" },
  high: { label: "Alto", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  medium: { label: "Médio", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  low: { label: "Baixo", className: "bg-muted text-muted-foreground" },
};

const SEVERITY_CONFIG: Record<RedFlagSeverity, { label: string; className: string }> = {
  critical: { label: "Crítico", className: "bg-destructive text-destructive-foreground" },
  high: { label: "Alto", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  moderate: { label: "Moderado", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
};

const SOURCE_LABELS: Record<SourceType, string> = {
  deterministic: "Dados Lab",
  llm: "IA",
  hybrid: "Híbrido",
};

const ACTION_TYPE_ICONS: Record<string, string> = {
  investigate: "🔍",
  treat: "💊",
  monitor: "📊",
  refer: "🏥",
};

const DECISION_CONFIG: Record<ReviewDecision, { label: string; icon: typeof Check; className: string; bgClassName: string }> = {
  accepted: { label: "Aceito", icon: Check, className: "text-emerald-700 dark:text-emerald-400", bgClassName: "border-emerald-300 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20" },
  edited: { label: "Editado", icon: Pencil, className: "text-blue-700 dark:text-blue-400", bgClassName: "border-blue-300 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20" },
  rejected: { label: "Rejeitado", icon: X, className: "text-red-600 dark:text-red-400", bgClassName: "border-red-300 bg-red-50/30 dark:border-red-800 dark:bg-red-950/20 opacity-60" },
  pending: { label: "Pendente", icon: Info, className: "text-muted-foreground", bgClassName: "" },
};

function PriorityBadge({ priority }: { priority: ClinicalPriority | string }) {
  const cfg = PRIORITY_CONFIG[priority as ClinicalPriority] ?? PRIORITY_CONFIG.medium;
  return <Badge className={cn("text-[10px] font-medium", cfg.className)}>{cfg.label}</Badge>;
}

function SourceBadge({ source }: { source: SourceType | string }) {
  const label = SOURCE_LABELS[source as SourceType] ?? source;
  return (
    <Badge variant="outline" className="text-[9px] font-normal gap-1">
      {source === "deterministic" && <Shield className="h-2.5 w-2.5" />}
      {source === "llm" && <Lightbulb className="h-2.5 w-2.5" />}
      {label}
    </Badge>
  );
}

function ReviewStatusBadge({ review }: { review?: ItemReview }) {
  if (!review || review.decision === "pending") return null;
  const cfg = DECISION_CONFIG[review.decision];
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn("text-[9px] font-medium gap-1 border", cfg.className, cfg.bgClassName.split(" ").filter(c => c.startsWith("border-")).join(" "))}>
      <Icon className="h-2.5 w-2.5" />
      {cfg.label}
    </Badge>
  );
}

// ── Review Controls ─────────────────────────────────────────────────────

interface ReviewControlsProps {
  itemId: string;
  originalText: string;
  review?: ItemReview;
  onDecision: (id: string, decision: ReviewDecision, opts?: { edited_content?: string; physician_note?: string }) => void;
  onClear: (id: string) => void;
}

function ReviewControls({ itemId, originalText, review, onDecision, onClear }: ReviewControlsProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(review?.edited_content ?? originalText);
  const [noteText, setNoteText] = useState(review?.physician_note ?? "");
  const [showNote, setShowNote] = useState(false);

  const hasDecision = review && review.decision !== "pending";

  const handleAccept = () => {
    onDecision(itemId, "accepted", noteText ? { physician_note: noteText } : undefined);
    setEditing(false);
  };

  const handleReject = () => {
    onDecision(itemId, "rejected", noteText ? { physician_note: noteText } : undefined);
    setEditing(false);
  };

  const handleSaveEdit = () => {
    onDecision(itemId, "edited", {
      edited_content: editText,
      physician_note: noteText || undefined,
    });
    setEditing(false);
  };

  const handleUndo = () => {
    onClear(itemId);
    setEditing(false);
    setEditText(originalText);
    setNoteText("");
    setShowNote(false);
  };

  return (
    <div className="space-y-2">
      {/* Edit area */}
      {editing && (
        <div className="space-y-2 mt-2">
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="text-xs min-h-[60px] bg-background"
            placeholder="Editar conteúdo..."
          />
          <div className="flex gap-1.5">
            <Button size="sm" variant="default" className="h-6 text-[10px] px-2" onClick={handleSaveEdit}>
              Salvar edição
            </Button>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Note area */}
      {showNote && !editing && (
        <div className="mt-2">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="text-xs min-h-[40px] bg-background"
            placeholder="Nota do médico..."
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-1 mt-1">
        {!hasDecision && !editing && (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              onClick={handleAccept}
            >
              <Check className="h-3 w-3 mr-0.5" />
              Aceitar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 text-blue-700 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
              onClick={() => { setEditing(true); setEditText(originalText); }}
            >
              <Pencil className="h-3 w-3 mr-0.5" />
              Editar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={handleReject}
            >
              <X className="h-3 w-3 mr-0.5" />
              Rejeitar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-1.5 text-muted-foreground"
              onClick={() => setShowNote(!showNote)}
            >
              <MessageSquare className="h-3 w-3" />
            </Button>
          </>
        )}
        {hasDecision && (
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] px-2 text-muted-foreground"
            onClick={handleUndo}
          >
            <Undo2 className="h-3 w-3 mr-0.5" />
            Desfazer
          </Button>
        )}
      </div>

      {/* Show physician note if present */}
      {review?.physician_note && !showNote && (
        <p className="text-[10px] text-muted-foreground italic mt-1">
          <MessageSquare className="h-2.5 w-2.5 inline mr-0.5" />
          {review.physician_note}
        </p>
      )}
    </div>
  );
}

// ── Reviewable Item Wrapper ─────────────────────────────────────────────

interface ReviewableItemProps {
  itemId: string;
  originalText: string;
  review?: ItemReview;
  onDecision: ReviewControlsProps["onDecision"];
  onClear: ReviewControlsProps["onClear"];
  reviewMode: boolean;
  children: React.ReactNode;
}

function ReviewableItem({ itemId, originalText, review, onDecision, onClear, reviewMode, children }: ReviewableItemProps) {
  const decision = review?.decision ?? "pending";
  const cfg = DECISION_CONFIG[decision];

  return (
    <div className={cn(
      "rounded-md border p-3 space-y-1.5 transition-all",
      reviewMode && decision !== "pending" ? cfg.bgClassName : "bg-background"
    )}>
      {/* Show edited version if edited, original with strikethrough */}
      {review?.decision === "edited" && review.edited_content && (
        <div className="space-y-1">
          <p className="text-sm text-blue-700 dark:text-blue-400">{review.edited_content}</p>
          <p className="text-[10px] text-muted-foreground line-through">{originalText}</p>
        </div>
      )}

      {/* Show original content if not edited */}
      {review?.decision !== "edited" && children}

      {/* Review status badge */}
      {review && review.decision !== "pending" && (
        <ReviewStatusBadge review={review} />
      )}

      {/* Review controls */}
      {reviewMode && (
        <ReviewControls
          itemId={itemId}
          originalText={originalText}
          review={review}
          onDecision={onDecision}
          onClear={onClear}
        />
      )}
    </div>
  );
}

// ── Section Components (with review) ────────────────────────────────────

interface ReviewSectionProps {
  reviewMode: boolean;
  getReview: (id: string) => ItemReview | undefined;
  onDecision: ReviewControlsProps["onDecision"];
  onClear: ReviewControlsProps["onClear"];
}

function RedFlagsSection({ flags, ...rp }: { flags: RedFlagItem[] } & ReviewSectionProps) {
  if (flags.length === 0) return null;

  return (
    <div className="rounded-lg border-2 border-destructive/50 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h3 className="font-bold text-sm text-destructive uppercase tracking-wide">
          Alertas Críticos ({flags.length})
        </h3>
      </div>
      <div className="space-y-2">
        {flags.map((flag) => (
          <ReviewableItem
            key={flag.id}
            itemId={flag.id}
            originalText={`${flag.finding} — ${flag.suggested_action}`}
            review={rp.getReview(flag.id)}
            onDecision={rp.onDecision}
            onClear={rp.onClear}
            reviewMode={rp.reviewMode}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{flag.finding}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge className={cn("text-[10px]", SEVERITY_CONFIG[flag.severity].className)}>
                    {SEVERITY_CONFIG[flag.severity].label}
                  </Badge>
                  <SourceBadge source={flag.source_type} />
                </div>
              </div>
              {flag.evidence.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  {flag.evidence.map((e, i) => (
                    <p key={i}>• {e}</p>
                  ))}
                </div>
              )}
              <p className="text-xs font-medium text-destructive/80">
                ➜ {flag.suggested_action}
              </p>
            </div>
          </ReviewableItem>
        ))}
      </div>
    </div>
  );
}

function ClinicalFindingsSection({ findings, ...rp }: { findings: ClinicalFindingItem[] } & ReviewSectionProps) {
  if (findings.length === 0) return null;

  const grouped: Record<string, ClinicalFindingItem[]> = {};
  for (const f of findings) {
    if (!grouped[f.system]) grouped[f.system] = [];
    grouped[f.system].push(f);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-sm text-primary uppercase tracking-wide">
          Achados Clínicos ({findings.length})
        </h3>
      </div>
      <div className="space-y-2">
        {Object.entries(grouped).map(([system, items]) => (
          <CollapsibleFindingGroup key={system} system={system} items={items} {...rp} />
        ))}
      </div>
    </div>
  );
}

function CollapsibleFindingGroup({ system, items, ...rp }: { system: string; items: ClinicalFindingItem[] } & ReviewSectionProps) {
  const [open, setOpen] = useState(true);
  const highestPriority = items.reduce<ClinicalPriority>((acc, item) => {
    const order: ClinicalPriority[] = ["critical", "high", "medium", "low"];
    return order.indexOf(item.priority) < order.indexOf(acc) ? item.priority : acc;
  }, "low");

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full rounded-md border bg-background p-3 hover:bg-muted/50 transition-colors text-left">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span className="text-sm font-semibold">{system}</span>
            <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
          </div>
          <PriorityBadge priority={highestPriority} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 mt-1 space-y-1.5">
          {items.map((item) => (
            <ReviewableItem
              key={item.id}
              itemId={item.id}
              originalText={item.interpretation}
              review={rp.getReview(item.id)}
              onDecision={rp.onDecision}
              onClear={rp.onClear}
              reviewMode={rp.reviewMode}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm">{item.interpretation}</p>
                <div className="flex items-center gap-1 shrink-0">
                  <PriorityBadge priority={item.priority} />
                  <SourceBadge source={item.source_type} />
                </div>
              </div>
              {item.markers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {item.markers.map((m, idx) => (
                    <Badge key={`${m}-${idx}`} variant="secondary" className="text-[9px] font-mono">{m}</Badge>
                  ))}
                </div>
              )}
            </ReviewableItem>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function HypothesesSection({ hypotheses, ...rp }: { hypotheses: DiagnosticHypothesisItem[] } & ReviewSectionProps) {
  if (hypotheses.length === 0) return null;

  const likelihoodLabels: Record<string, string> = {
    probable: "Provável",
    possible: "Possível",
    unlikely: "Improvável",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Stethoscope className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-sm text-primary uppercase tracking-wide">
          Hipóteses Diagnósticas ({hypotheses.length})
        </h3>
      </div>
      <div className="space-y-2">
        {hypotheses.map((h) => (
          <ReviewableItem
            key={h.id}
            itemId={h.id}
            originalText={h.hypothesis}
            review={rp.getReview(h.id)}
            onDecision={rp.onDecision}
            onClear={rp.onClear}
            reviewMode={rp.reviewMode}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{h.hypothesis}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-[10px]">
                    {likelihoodLabels[h.likelihood] ?? h.likelihood}
                  </Badge>
                  <PriorityBadge priority={h.priority} />
                  <SourceBadge source={h.source_type} />
                </div>
              </div>
              {h.supporting_findings.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Achados de suporte: </span>
                  {Array.isArray(h.supporting_findings) ? h.supporting_findings.join("; ") : String(h.supporting_findings ?? "")}
                </div>
              )}
              {h.confirmatory_exams && h.confirmatory_exams.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  <span className="font-medium">Exames confirmatórios: </span>
                  {h.confirmatory_exams.join("; ")}
                </div>
              )}
            </div>
          </ReviewableItem>
        ))}
      </div>
    </div>
  );
}

function SuggestedActionsSection({ actions, ...rp }: { actions: SuggestedActionItem[] } & ReviewSectionProps) {
  if (actions.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-sm text-primary uppercase tracking-wide">
          Ações Sugeridas ({actions.length})
        </h3>
      </div>
      <div className="space-y-2">
        {actions.map((a) => (
          <ReviewableItem
            key={a.id}
            itemId={a.id}
            originalText={a.description}
            review={rp.getReview(a.id)}
            onDecision={rp.onDecision}
            onClear={rp.onClear}
            reviewMode={rp.reviewMode}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-base">{ACTION_TYPE_ICONS[a.action_type] ?? "📋"}</span>
                <span className="text-sm font-medium">{a.description}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <PriorityBadge priority={a.priority} />
                <SourceBadge source={a.source_type} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{a.rationale}</p>
          </ReviewableItem>
        ))}
      </div>
    </div>
  );
}

function FollowUpSection({ followUp }: { followUp?: FollowUp }) {
  if (!followUp) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-primary" />
        <h3 className="font-bold text-sm text-primary uppercase tracking-wide">Follow-up</h3>
      </div>
      <div className="rounded-md border bg-background p-3 space-y-2">
        {followUp.suggested_exams.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Exames sugeridos:</p>
            <ul className="space-y-0.5">
              {followUp.suggested_exams.map((e, i) => (
                <li key={i} className="text-sm flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {followUp.suggested_return_days && (
          <p className="text-xs text-muted-foreground">
            Retorno sugerido: <span className="font-medium">{followUp.suggested_return_days} dias</span>
          </p>
        )}
        {followUp.notes && (
          <p className="text-xs text-muted-foreground italic">{followUp.notes}</p>
        )}
      </div>
    </div>
  );
}

// ── Review Summary Bar ──────────────────────────────────────────────────

function ReviewSummaryBar({ stats }: { stats: ReviewStats }) {
  if (stats.total === 0) return null;
  const reviewed = stats.accepted + stats.edited + stats.rejected;
  const pct = Math.round((reviewed / stats.total) * 100);

  return (
    <div className="flex items-center gap-3 text-[11px] text-muted-foreground border rounded-md p-2 bg-muted/30">
      <span className="font-medium">Revisão: {reviewed}/{stats.total} ({pct}%)</span>
      <div className="flex items-center gap-2">
        {stats.accepted > 0 && (
          <span className="flex items-center gap-0.5 text-emerald-700 dark:text-emerald-400">
            <Check className="h-3 w-3" /> {stats.accepted}
          </span>
        )}
        {stats.edited > 0 && (
          <span className="flex items-center gap-0.5 text-blue-700 dark:text-blue-400">
            <Pencil className="h-3 w-3" /> {stats.edited}
          </span>
        )}
        {stats.rejected > 0 && (
          <span className="flex items-center gap-0.5 text-red-600 dark:text-red-400">
            <X className="h-3 w-3" /> {stats.rejected}
          </span>
        )}
        {stats.pending > 0 && (
          <span className="text-muted-foreground">⏳ {stats.pending}</span>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

interface ClinicalReportV2Props {
  data: AnalysisV2Data;
  patientName?: string;
  analysisId?: string;
  patientId?: string;
  specialtyId?: string;
  initialReviewState?: ReviewState;
  onReviewChange?: (reviews: ReviewState) => void;
}

export default function ClinicalReportV2({ data, patientName, analysisId, patientId, specialtyId, initialReviewState, onReviewChange }: ClinicalReportV2Props) {
  const [reviewMode, setReviewMode] = useState(false);
  const [reviewOutdated, setReviewOutdated] = useState(false);
  const { reviews, setDecision, clearDecision, getReview, getStats, setAll } = useReviewState(initialReviewState);
  const { user } = useAuth();
  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentHashRef = useRef<string>(computeAnalysisV2HashSync(data));

  const [resettingStale, setResettingStale] = useState(false);

  // Keep hash in sync if data changes
  useEffect(() => {
    currentHashRef.current = computeAnalysisV2HashSync(data);
  }, [data]);

  // ── Load persisted review state (with version check) ──
  useEffect(() => {
    if (!analysisId || !user?.id || loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      const { data: row } = await (supabase as any)
        .from("analysis_reviews")
        .select("review_state_json, analysis_v2_hash, schema_version")
        .eq("analysis_id", analysisId)
        .eq("practitioner_id", user.id)
        .maybeSingle();
      if (!row?.review_state_json || Object.keys(row.review_state_json).length === 0) return;

      const savedHash = row.analysis_v2_hash;
      const currentHash = currentHashRef.current;

      if (savedHash && savedHash !== currentHash) {
        console.warn(`[ReviewState] Hash mismatch: saved=${savedHash} current=${currentHash}. Review marked outdated.`);
        setReviewOutdated(true);
        return;
      }

      setAll(row.review_state_json as ReviewState);
    })();
  }, [analysisId, user?.id]);

  // ── Explicit stale reset ──
  const handleStaleReset = useCallback(async () => {
    if (!analysisId || !user?.id || !patientId) return;
    setResettingStale(true);
    try {
      // 1. Read the current (stale) review to archive it
      const { data: staleRow } = await (supabase as any)
        .from("analysis_reviews")
        .select("review_state_json, analysis_v2_hash, schema_version")
        .eq("analysis_id", analysisId)
        .eq("practitioner_id", user.id)
        .maybeSingle();

      // 2. If there's a stale review, archive it as a snapshot with reason "stale_reset"
      if (staleRow?.review_state_json && Object.keys(staleRow.review_state_json).length > 0) {
        await (supabase as any)
          .from("review_snapshots")
          .insert({
            analysis_id: analysisId,
            patient_id: patientId,
            practitioner_id: user.id,
            analysis_v2_hash: staleRow.analysis_v2_hash,
            schema_version: staleRow.schema_version ?? REVIEW_SCHEMA_VERSION,
            review_state_json: staleRow.review_state_json,
            snapshot_reason: "stale_reset",
          });
      }

      // 3. Overwrite active review with empty state + current hash
      const newHash = currentHashRef.current;
      await (supabase as any)
        .from("analysis_reviews")
        .upsert({
          analysis_id: analysisId,
          practitioner_id: user.id,
          patient_id: patientId,
          specialty_id: specialtyId || "medicina_funcional",
          review_state_json: {},
          analysis_v2_hash: newHash,
          schema_version: REVIEW_SCHEMA_VERSION,
        }, { onConflict: "analysis_id,practitioner_id" });

      // 4. Clear local state and mark as current
      setAll({});
      setReviewOutdated(false);
      setReviewMode(true);
      console.info("[ReviewState] Stale review archived and reset. New review started.");
    } catch (err) {
      console.error("[ReviewState] Stale reset failed:", err);
    } finally {
      setResettingStale(false);
    }
  }, [analysisId, user?.id, patientId, specialtyId, setAll]);

  // ── Debounced save (includes hash + schema version) ──
  const persistReview = useCallback((state: ReviewState) => {
    if (!analysisId || !user?.id || !patientId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const hash = currentHashRef.current;
      // 1. Upsert current state (unchanged logic)
      await (supabase as any)
        .from("analysis_reviews")
        .upsert({
          analysis_id: analysisId,
          practitioner_id: user.id,
          patient_id: patientId,
          specialty_id: specialtyId || "medicina_funcional",
          review_state_json: state,
          analysis_v2_hash: hash,
          schema_version: REVIEW_SCHEMA_VERSION,
        }, { onConflict: "analysis_id,practitioner_id" });
      setReviewOutdated(false);

      // 2. Append audit snapshot (fire-and-forget)
      (supabase as any)
        .from("review_snapshots")
        .insert({
          analysis_id: analysisId,
          patient_id: patientId,
          practitioner_id: user.id,
          analysis_v2_hash: hash,
          schema_version: REVIEW_SCHEMA_VERSION,
          review_state_json: state,
          snapshot_reason: "auto_save",
        })
        .then(({ error }: { error: any }) => {
          if (error) console.warn("[ReviewSnapshot] insert failed:", error.message);
          else {
            // ── TRACE: Rastreabilidade da revisão médica ──
            const s = getStats([...Object.keys(state)]);
            Trace.medicalReview(user.id, patientId, analysisId, { accepted: s.accepted, edited: s.edited, rejected: s.rejected });
          }
        });
    }, 800);
  }, [analysisId, user?.id, patientId, specialtyId]);

  // Collect all reviewable item IDs
  const allIds = [
    ...data.red_flags.map((f) => f.id),
    ...data.clinical_findings.map((f) => f.id),
    ...data.diagnostic_hypotheses.map((h) => h.id),
    ...data.suggested_actions.map((a) => a.id),
  ];
  const stats = getStats(allIds);

  const handleDecision: ReviewControlsProps["onDecision"] = (id, decision, opts) => {
    setDecision(id, decision, opts);
    const updated = { ...reviews, [id]: { decision, ...opts, reviewed_at: new Date().toISOString() } };
    onReviewChange?.(updated);
    persistReview(updated);
  };

  const handleClear: ReviewControlsProps["onClear"] = (id) => {
    clearDecision(id);
    const next = { ...reviews };
    delete next[id];
    onReviewChange?.(next);
    persistReview(next);
  };

  const reviewProps: ReviewSectionProps = {
    reviewMode,
    getReview,
    onDecision: handleDecision,
    onClear: handleClear,
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Relatório Clínico Estruturado
            <Badge variant="outline" className="text-[10px] font-mono">v2</Badge>
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {data.meta.specialty_name}
            </Badge>
            <Button
              size="sm"
              variant={reviewMode ? "default" : "outline"}
              className="h-7 text-[11px] px-3"
              onClick={() => setReviewMode(!reviewMode)}
            >
              <Stethoscope className="h-3.5 w-3.5 mr-1" />
              {reviewMode ? "Revisando" : "Revisar"}
            </Button>
            {reviewMode && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px] px-3"
                  onClick={() => {
                    const reviewed = buildReviewedReport(data, reviews);
                    generateReportV2Pdf(reviewed, patientName || "Paciente");
                  }}
                >
                  <FileDown className="h-3.5 w-3.5 mr-1" />
                  Exportar PDF
                </Button>
                <ReviewHistoryPanel
                  analysisId={analysisId}
                  currentHash={currentHashRef.current}
                  allItemIds={allIds}
                  analysisData={data}
                />
              </>
            )}
          </div>
        </div>
        {reviewOutdated && (
          <div className="flex items-center gap-2 rounded-md border border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="font-medium">Revisão desatualizada</p>
              <p>A análise foi re-gerada desde a última revisão. Os itens mudaram e a revisão anterior não corresponde mais ao conteúdo atual. A revisão antiga foi preservada no histórico.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] px-3 shrink-0 border-yellow-400 text-yellow-800 hover:bg-yellow-100 dark:border-yellow-700 dark:text-yellow-300 dark:hover:bg-yellow-900/30"
              disabled={resettingStale}
              onClick={handleStaleReset}
            >
              {resettingStale ? "Arquivando…" : "Iniciar nova revisão"}
            </Button>
          </div>
        )}
        {reviewMode && <ReviewSummaryBar stats={stats} />}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Executive Summary ── */}
        {data.executive_summary && (
          <div className="rounded-lg bg-muted/50 p-4 border-l-4 border-primary">
            <h3 className="font-bold text-sm text-primary mb-2 uppercase tracking-wide">
              Sumário Executivo
            </h3>
            <p className="text-sm leading-relaxed">{data.executive_summary}</p>
          </div>
        )}

        {/* ── Red Flags ── */}
        <RedFlagsSection flags={data.red_flags} {...reviewProps} />

        {/* ── Clinical Findings ── */}
        <ClinicalFindingsSection findings={data.clinical_findings} {...reviewProps} />

        {/* ── Diagnostic Hypotheses ── */}
        <HypothesesSection hypotheses={data.diagnostic_hypotheses} {...reviewProps} />

        {/* ── Suggested Actions ── */}
        <SuggestedActionsSection actions={data.suggested_actions} {...reviewProps} />

        {/* ── Follow-up ── */}
        <FollowUpSection followUp={data.follow_up} />

        {/* ── Provenance Legend ── */}
        <div className="border-t pt-3 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>Proveniência:</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">Dados Lab = determinístico</span>
          </div>
          <div className="flex items-center gap-1">
            <Lightbulb className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">IA = modelo de linguagem</span>
          </div>
          {data.meta.model_used && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              Modelo: {data.meta.model_used}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
