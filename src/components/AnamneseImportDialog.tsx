import { useState, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Upload,
  ClipboardPaste,
  FileText,
  Loader2,
  Check,
  XCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import type { StructuredAnamnese } from "./AnamneseTab";

// ── Parsing config ──────────────────────────────────────────────────────

interface FieldDef {
  key: keyof StructuredAnamnese;
  label: string;
  /** keywords/patterns that signal this field in the text */
  patterns: RegExp[];
  /** Whether the value should be split into an array */
  isArray?: boolean;
}

const FIELD_DEFS: FieldDef[] = [
  {
    key: "queixa_principal",
    label: "Queixa principal",
    patterns: [
      /queixa\s*(?:principal)?[:\-–]\s*(.+)/i,
      /motivo\s*(?:da\s*consulta)?[:\-–]\s*(.+)/i,
    ],
  },
  {
    key: "objetivos",
    label: "Objetivos",
    patterns: [/objetivos?[:\-–]\s*(.+)/i, /meta[s]?[:\-–]\s*(.+)/i],
    isArray: true,
  },
  {
    key: "sintomas",
    label: "Sintomas",
    patterns: [
      /sintomas?\s*(?:atuais|relevantes|relatados)?[:\-–]\s*(.+)/i,
      /queixas?\s*(?:secundárias|associadas)?[:\-–]\s*(.+)/i,
    ],
    isArray: true,
  },
  {
    key: "comorbidades",
    label: "Antecedentes / Comorbidades",
    patterns: [
      /(?:antecedentes?|comorbidades?|doenças?\s*(?:prévias|crônicas)?)[:\-–]\s*(.+)/i,
      /hist[oó]rico\s*(?:m[eé]dico|pessoal)[:\-–]\s*(.+)/i,
    ],
    isArray: true,
  },
  {
    key: "alergias",
    label: "Alergias",
    patterns: [/alergias?[:\-–]\s*(.+)/i],
    isArray: true,
  },
  {
    key: "medicacoes",
    label: "Medicações em uso",
    patterns: [
      /medica[çc][oõ]es?\s*(?:em\s*uso|cont[ií]nu[ao]s?)?[:\-–]\s*(.+)/i,
      /medicamentos?\s*(?:em\s*uso)?[:\-–]\s*(.+)/i,
      /rem[eé]dios?\s*(?:em\s*uso)?[:\-–]\s*(.+)/i,
    ],
    isArray: true,
  },
  {
    key: "suplementos",
    label: "Suplementos em uso",
    patterns: [
      /suplementos?\s*(?:em\s*uso)?[:\-–]\s*(.+)/i,
      /suplementa[çc][aã]o[:\-–]\s*(.+)/i,
    ],
    isArray: true,
  },
  {
    key: "restricoes_alimentares",
    label: "Restrições alimentares",
    patterns: [
      /restri[çc][oõ]es?\s*(?:alimentares?)?[:\-–]\s*(.+)/i,
      /intoler[aâ]ncias?\s*(?:alimentares?)?[:\-–]\s*(.+)/i,
    ],
  },
  {
    key: "atividade_fisica",
    label: "Atividade física",
    patterns: [
      /atividade\s*f[ií]sica[:\-–]\s*(.+)/i,
      /exerc[ií]cios?[:\-–]\s*(.+)/i,
    ],
  },
  {
    key: "dieta_resumo",
    label: "Dieta / Alimentação",
    patterns: [
      /dieta[:\-–]\s*(.+)/i,
      /alimenta[çc][aã]o[:\-–]\s*(.+)/i,
      /padr[aã]o\s*alimentar[:\-–]\s*(.+)/i,
    ],
  },
  {
    key: "historico_familiar",
    label: "Histórico familiar",
    patterns: [
      /hist[oó]rico\s*familiar[:\-–]\s*(.+)/i,
      /antecedentes?\s*familiares?[:\-–]\s*(.+)/i,
    ],
  },
  {
    key: "cirurgias",
    label: "Cirurgias prévias",
    patterns: [/cirurgias?\s*(?:pr[eé]vias?)?[:\-–]\s*(.+)/i],
    isArray: true,
  },
  {
    key: "observacoes",
    label: "Observações livres",
    patterns: [/observa[çc][oõ]es?[:\-–]\s*(.+)/i, /notas?[:\-–]\s*(.+)/i],
  },
];

// ── Local parser (no AI) ────────────────────────────────────────────────

export interface ParsedField {
  key: keyof StructuredAnamnese;
  label: string;
  value: string | string[];
  /** Simple confidence: "alta" if pattern matched, "média" if fuzzy */
  confidence: "alta" | "média";
  /** Whether user chose to apply this field */
  accepted: boolean;
}

function parseAnamneseText(raw: string): ParsedField[] {
  const results: ParsedField[] = [];
  const lines = raw.split("\n");
  const usedLines = new Set<number>();

  for (const def of FIELD_DEFS) {
    for (let i = 0; i < lines.length; i++) {
      if (usedLines.has(i)) continue;
      const line = lines[i].trim();
      if (!line) continue;

      for (const pattern of def.patterns) {
        const match = line.match(pattern);
        if (match && match[1]?.trim()) {
          const rawVal = match[1].trim();
          usedLines.add(i);

          // Collect continuation lines (indented or without colon pattern)
          let fullVal = rawVal;
          for (let j = i + 1; j < lines.length; j++) {
            const next = lines[j];
            if (!next.trim()) break;
            // If next line starts with a keyword pattern, stop
            const isNewField = FIELD_DEFS.some((d) =>
              d.patterns.some((p) => p.test(next))
            );
            if (isNewField) break;
            // Continuation: indented or starts with - or •
            if (/^[\s\-•]/.test(next)) {
              fullVal += ", " + next.trim().replace(/^[\-•]\s*/, "");
              usedLines.add(j);
            } else {
              break;
            }
          }

          if (def.isArray) {
            const items = fullVal
              .split(/[,;]/)
              .map((s) => s.trim())
              .filter(Boolean);
            results.push({
              key: def.key,
              label: def.label,
              value: items,
              confidence: "alta",
              accepted: true,
            });
          } else {
            results.push({
              key: def.key,
              label: def.label,
              value: fullVal,
              confidence: "alta",
              accepted: true,
            });
          }
          break; // Found match for this field, move to next
        }
      }
    }
  }

  // Collect unmatched lines into "observacoes" if not already extracted
  const unmatchedLines = lines
    .filter((_, i) => !usedLines.has(i))
    .map((l) => l.trim())
    .filter(Boolean);

  if (unmatchedLines.length > 0) {
    const existing = results.find((r) => r.key === "observacoes");
    if (existing) {
      existing.value =
        (typeof existing.value === "string" ? existing.value : existing.value.join(", ")) +
        "\n" +
        unmatchedLines.join("\n");
    } else {
      results.push({
        key: "observacoes",
        label: "Observações livres",
        value: unmatchedLines.join("\n"),
        confidence: "média",
        accepted: true,
      });
    }
  }

  return results;
}

// ── Import result shape ─────────────────────────────────────────────────

export interface ImportResult {
  /** Parsed structured fields the user confirmed */
  fields: Partial<StructuredAnamnese>;
  /** Original imported text for auditability */
  importedText: string;
  /** Full parse results (for traceability) */
  parseResults: ParsedField[];
}

// ── Steps ───────────────────────────────────────────────────────────────

type Step = "import" | "review" | "done";

interface AnamneseImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when user confirms the import. Caller applies to structured fields. */
  onConfirm: (result: ImportResult) => void;
  /** Current structured data, to show conflicts */
  currentData: StructuredAnamnese;
}

export function AnamneseImportDialog({
  open,
  onOpenChange,
  onConfirm,
  currentData,
}: AnamneseImportDialogProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("import");
  const [rawText, setRawText] = useState("");
  const [parsedFields, setParsedFields] = useState<ParsedField[]>([]);
  const [loadingFile, setLoadingFile] = useState(false);

  // Reset on close
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setStep("import");
      setRawText("");
      setParsedFields([]);
    }
    onOpenChange(v);
  };

  // ── File upload handler (plain text only) ─────────────────────────────
  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!file.name.match(/\.(txt|text|md)$/i) && file.type !== "text/plain") {
        toast({
          title: "Formato não suportado",
          description: "Use arquivos .txt ou .md. PDFs e planilhas serão suportados em versão futura.",
          variant: "destructive",
        });
        return;
      }

      setLoadingFile(true);
      try {
        const text = await file.text();
        setRawText(text);
        toast({ title: "Arquivo carregado", description: file.name });
      } catch {
        toast({ title: "Erro ao ler arquivo", variant: "destructive" });
      } finally {
        setLoadingFile(false);
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [toast]
  );

  // ── Extract / Parse ───────────────────────────────────────────────────
  const handleExtract = () => {
    if (rawText.trim().length < 10) {
      toast({
        title: "Texto muito curto",
        description: "Cole ou suba um texto com pelo menos 10 caracteres.",
        variant: "destructive",
      });
      return;
    }

    const results = parseAnamneseText(rawText);
    if (results.length === 0) {
      toast({
        title: "Nenhum campo encontrado",
        description: "O parser não identificou campos estruturados no texto. Revise o formato.",
        variant: "destructive",
      });
      return;
    }

    setParsedFields(results);
    setStep("review");
  };

  // ── Toggle field acceptance ───────────────────────────────────────────
  const toggleField = (idx: number) => {
    setParsedFields((prev) =>
      prev.map((f, i) => (i === idx ? { ...f, accepted: !f.accepted } : f))
    );
  };

  // ── Check for conflict with existing data ─────────────────────────────
  const hasConflict = (key: keyof StructuredAnamnese): boolean => {
    const existing = currentData[key];
    if (existing === undefined || existing === null || existing === "") return false;
    if (Array.isArray(existing) && existing.length === 0) return false;
    return true;
  };

  // ── Confirm import ────────────────────────────────────────────────────
  const handleConfirm = () => {
    const accepted = parsedFields.filter((f) => f.accepted);
    if (accepted.length === 0) {
      toast({
        title: "Nenhum campo selecionado",
        description: "Selecione ao menos um campo para importar.",
        variant: "destructive",
      });
      return;
    }

    const fields: Partial<StructuredAnamnese> = {};
    for (const f of accepted) {
      (fields as any)[f.key] = f.value;
    }

    onConfirm({
      fields,
      importedText: rawText,
      parseResults: parsedFields,
    });

    handleOpenChange(false);
    toast({
      title: "Importação aplicada",
      description: `${accepted.length} campo(s) aplicados ao formulário. Revise e salve.`,
    });
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "import" ? (
              <>
                <Upload className="h-5 w-5 text-primary" />
                Importar Anamnese
              </>
            ) : (
              <>
                <Eye className="h-5 w-5 text-primary" />
                Revisar Extração
              </>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {step === "import"
              ? "Cole o texto de uma anamnese pronta ou suba um arquivo .txt. O sistema extrairá os campos automaticamente para revisão."
              : "Revise os campos extraídos. Desative campos que não deseja importar. Campos com conflito (já preenchidos) são marcados."}
          </DialogDescription>
        </DialogHeader>

        {/* ── Step 1: Import ── */}
        {step === "import" && (
          <div className="space-y-4 flex-1">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <ClipboardPaste className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Colar texto</span>
              </div>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Cole aqui o texto da anamnese...\n\nExemplo:\nQueixa principal: Fadiga crônica\nSintomas: Insônia, queda de cabelo, ganho de peso\nMedicações: Levotiroxina 75mcg\nAlergias: Dipirona\n...`}
                rows={12}
                className="text-sm font-mono resize-y"
              />
              <p className="text-xs text-muted-foreground">
                {rawText.length} caracteres
              </p>
            </div>

            <Separator />

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Ou suba um arquivo</span>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.text,.md,text/plain"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
                disabled={loadingFile}
              >
                {loadingFile ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Selecionar .txt
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Review ── */}
        {step === "review" && (
          <ScrollArea className="flex-1 max-h-[55vh] pr-4">
            <div className="space-y-2">
              {parsedFields.map((field, idx) => {
                const conflict = hasConflict(field.key);
                const displayValue = Array.isArray(field.value)
                  ? field.value.join(", ")
                  : field.value;

                return (
                  <div
                    key={idx}
                    className={`rounded-md border p-3 transition-colors ${
                      field.accepted
                        ? "border-border bg-background"
                        : "border-muted bg-muted/30 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            {field.label}
                          </span>
                          <Badge
                            variant={field.confidence === "alta" ? "default" : "secondary"}
                            className="text-[10px] px-1.5 py-0"
                          >
                            {field.confidence === "alta" ? "Alta" : "Média"}
                          </Badge>
                          {conflict && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-600"
                            >
                              Já preenchido
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                          {displayValue}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleField(idx)}
                        className="shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        title={field.accepted ? "Desativar campo" : "Ativar campo"}
                      >
                        {field.accepted ? (
                          <ToggleRight className="h-5 w-5 text-primary" />
                        ) : (
                          <ToggleLeft className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* ── Footer ── */}
        <DialogFooter className="gap-2 sm:gap-0">
          {step === "import" && (
            <>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleExtract}
                disabled={rawText.trim().length < 10}
                className="gap-1.5"
              >
                <ArrowRight className="h-4 w-4" />
                Extrair para campos
              </Button>
            </>
          )}
          {step === "review" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep("import")}
                className="gap-1.5"
              >
                Voltar
              </Button>
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="gap-1.5"
              >
                <XCircle className="h-4 w-4" /> Cancelar
              </Button>
              <Button onClick={handleConfirm} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                Confirmar importação ({parsedFields.filter((f) => f.accepted).length})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
