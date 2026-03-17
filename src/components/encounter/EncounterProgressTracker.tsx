/**
 * EncounterProgressTracker — Horizontal step tracker for the encounter workflow.
 * Shows 5 clinical steps with completion status and allows navigation.
 */
import { cn } from "@/lib/utils";
import {
  FlaskConical,
  FileText,
  Brain,
  Pill,
  CheckCircle2,
  Circle,
  Sparkles,
} from "lucide-react";

export interface StepStatus {
  exams: boolean;
  soap: boolean;
  analysis: boolean;
  prescription: boolean;
  finalized: boolean;
}

interface EncounterProgressTrackerProps {
  status: StepStatus;
  activeStep: string;
  onStepClick: (step: string) => void;
}

const STEPS = [
  { id: "exames", label: "Exames", icon: FlaskConical },
  { id: "soap", label: "Evolução", icon: FileText },
  { id: "ia", label: "Análise IA", icon: Brain },
  { id: "prescricao", label: "Prescrição", icon: Pill },
  { id: "finalizar", label: "Finalizar", icon: CheckCircle2 },
] as const;

function stepCompleted(stepId: string, status: StepStatus): boolean {
  switch (stepId) {
    case "exames": return status.exams;
    case "soap": return status.soap;
    case "ia": return status.analysis;
    case "prescricao": return status.prescription;
    case "finalizar": return status.finalized;
    default: return false;
  }
}

export function EncounterProgressTracker({
  status,
  activeStep,
  onStepClick,
}: EncounterProgressTrackerProps) {
  const completedCount = [status.exams, status.soap, status.analysis, status.prescription, status.finalized].filter(Boolean).length;

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${(completedCount / 5) * 100}%` }}
          />
        </div>
        <span className="text-[10px] font-medium text-muted-foreground shrink-0">
          {completedCount}/5
        </span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const completed = stepCompleted(step.id, status);
          const active = activeStep === step.id;

          return (
            <button
              key={step.id}
              onClick={() => onStepClick(step.id)}
              className={cn(
                "flex-1 flex items-center gap-1.5 rounded-md px-2 py-2 text-[11px] font-medium transition-all",
                "hover:bg-accent/60",
                active && "bg-primary/10 text-primary ring-1 ring-primary/20",
                !active && completed && "text-foreground/70",
                !active && !completed && "text-muted-foreground"
              )}
            >
              <div className="relative shrink-0">
                {completed ? (
                  <CheckCircle2 className={cn("h-4 w-4", active ? "text-primary" : "text-emerald-500")} />
                ) : (
                  <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground/60")} />
                )}
              </div>
              <span className="hidden sm:inline truncate">{step.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
