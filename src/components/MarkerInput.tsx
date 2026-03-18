import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getMarkerStatus, type MarkerDef } from "@/lib/markers";

interface MarkerInputProps {
  marker: MarkerDef;
  sex: "M" | "F";
  value: string;
  onChange: (v: string) => void;
}

export function MarkerInput({ marker, sex, value, onChange }: MarkerInputProps) {
  if (marker.qualitative) {
    return (
      <div className="rounded-lg border p-3 transition-colors">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-xs font-medium">{marker.name}</label>
          <Badge variant="outline" className="text-[9px] h-4 px-1">Qualitativo</Badge>
        </div>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ex: Negativo, Ausente, Normal..."
          className="h-8 text-sm"
        />
      </div>
    );
  }

  const [min, max] = marker.labRange[sex];
  const operatorMatch = value.match(/^([<>]=?)\s*(\d+[.,]?\d*)$/);
  const isOperatorValue = !!operatorMatch;
  const numVal = isOperatorValue ? parseFloat(operatorMatch![2].replace(",", ".")) : Number(value);
  const hasValue = value !== "" && !isNaN(numVal);
  const operator = isOperatorValue ? operatorMatch![1] : undefined;
  const status = hasValue ? getMarkerStatus(numVal, marker, sex, operator) : null;

  const borderColor =
    status === "normal"
      ? "border-emerald-400 focus-visible:ring-emerald-400"
      : status === "low" || status === "high"
      ? "border-red-400 focus-visible:ring-red-400"
      : "";

  const bgColor =
    status === "normal"
      ? "bg-emerald-50"
      : status === "low" || status === "high"
      ? "bg-red-50"
      : "";

  return (
    <div className={cn("rounded-lg border p-3 transition-colors", bgColor)}>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-xs font-medium">{marker.name}</label>
        <span className="text-[10px] text-muted-foreground">{marker.unit}</span>
      </div>
      <Input
        type={isOperatorValue ? "text" : "number"}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`${min} – ${max}`}
        className={cn("h-8 text-sm", borderColor)}
      />
      <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-foreground/80">Lab: {min} – {max}</span>
          {status && (
            <Badge
              variant="outline"
              className={cn(
                "h-4 px-1 text-[10px]",
                status === "normal" && "border-emerald-400 text-emerald-700",
                (status === "low" || status === "high") && "border-red-400 text-red-700"
              )}
            >
              {status === "normal" ? "✓" : status === "low" ? "↓ Baixo" : "↑ Alto"}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
