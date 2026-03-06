/**
 * historicalExtract.test.ts
 *
 * Testes para:
 * - Detecção de perfil de documento
 * - Extração histórica
 * - Normalização de histórico (operadores, conversão, scale)
 * - Deduplicação composta
 * - Preservação de raw + normalized lado a lado
 */
import { describe, it, expect } from "vitest";

// --- Replicated core logic for test environment (Deno modules can't be imported in vitest) ---

function parseBrDate(dateStr: string): string | null {
  const m = dateStr.trim().match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function extractDates(text: string): string[] {
  const dates: string[] = [];
  const regex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const parsed = parseBrDate(match[0]);
    if (parsed) dates.push(parsed);
  }
  return [...new Set(dates)];
}

// --- Profile detection (replicated) ---

const EVOLUTION_PATTERNS = [
  /LAUDO\s+EVOLUTIVO/i,
  /EVOLU[CÇ][AÃ]O\s+(?:DE\s+)?(?:RESULTADOS|EXAMES)/i,
  /HIST[OÓ]RICO\s+DE\s+RESULTADOS/i,
  /RESULTADOS\s+COMPARATIVOS/i,
];

const INLINE_HISTORY_PATTERNS = [
  /Resultado(?:s)?\s+Anterior(?:es)?/i,
  /Exames?\s+Anterior(?:es)?/i,
];

type DocumentProfileType = "evolution_page" | "inline_history" | "multi_date_table" | "current_result";

interface HistoricalEntry {
  date: string;
  value?: number;
  text_value?: string;
  unit?: string;
  raw_value?: number;
  raw_text_value?: string;
  raw_unit?: string;
  raw_ref_text?: string;
  conversion_applied?: boolean;
  conversion_reason?: string;
  flag?: "normal" | "high" | "low" | null;
  source_type: DocumentProfileType;
  source_lab?: string;
  source_document?: string;
}

interface HistoricalMarkerTimeline {
  marker_id: string;
  marker_name: string;
  entries: HistoricalEntry[];
  reference_text?: string;
}

interface DetectedBlock {
  type: DocumentProfileType;
  start: number;
  end: number;
  text: string;
  dates: string[];
}

function detectDocumentProfiles(pdfText: string): DetectedBlock[] {
  const blocks: DetectedBlock[] = [];
  const pages = pdfText.split(/\f|(?:\n\s*\n\s*\n\s*\n)/);
  let offset = 0;
  for (const page of pages) {
    const trimmed = page.trim();
    if (!trimmed) { offset += page.length + 1; continue; }
    let detected = false;
    for (const pat of EVOLUTION_PATTERNS) {
      if (pat.test(trimmed)) {
        const dates = extractDates(trimmed);
        if (dates.length >= 2) {
          blocks.push({ type: "evolution_page", start: offset, end: offset + page.length, text: trimmed, dates: dates.sort() });
          detected = true;
          break;
        }
      }
    }
    if (!detected) {
      for (const pat of INLINE_HISTORY_PATTERNS) {
        const m = trimmed.match(pat);
        if (m && m.index !== undefined) {
          const histText = trimmed.slice(m.index);
          const dates = extractDates(histText);
          if (dates.length >= 1) {
            blocks.push({ type: "inline_history", start: offset + m.index, end: offset + page.length, text: histText, dates });
          }
          detected = true;
          break;
        }
      }
    }
    if (!detected) {
      const headerArea = trimmed.slice(0, Math.min(500, trimmed.length));
      const dates = extractDates(headerArea);
      if (dates.length >= 3) {
        blocks.push({ type: "multi_date_table", start: offset, end: offset + page.length, text: trimmed, dates: dates.sort() });
      }
    }
    offset += page.length + 1;
  }
  return blocks;
}

// --- Composite dedup key (replicated from historicalExtract.ts) ---

function entryDedupKey(e: HistoricalEntry): string {
  const valueKey = e.value !== undefined ? String(e.value) : (e.text_value || "");
  return `${e.date}|${e.source_type}|${e.source_lab || ""}|${e.source_document || ""}|${valueKey}`;
}

// --- Operator normalization (replicated from historicalNormalize.ts) ---

function normalizeOperator(textValue: string): { normalized: string; value: number | null } {
  const tv = textValue.trim();
  const infMatch = tv.match(/^inferior\s+a\s+(\d+[.,]?\d*)/i);
  if (infMatch) {
    const num = parseFloat(infMatch[1].replace(",", "."));
    return { normalized: `< ${num}`, value: num };
  }
  const supMatch = tv.match(/^superior\s+a\s+(\d+[.,]?\d*)/i);
  if (supMatch) {
    const num = parseFloat(supMatch[1].replace(",", "."));
    return { normalized: `> ${num}`, value: num };
  }
  const symMatch = tv.match(/^([<>]=?)\s*([\d,\.]+)/);
  if (symMatch) {
    const num = parseFloat(symMatch[2].replace(",", "."));
    return { normalized: `${symMatch[1]} ${num}`, value: num };
  }
  return { normalized: tv, value: null };
}

// --- Unit conversion (replicated subset) ---

interface ConversionRule {
  from_unit_pattern: RegExp;
  from_unit_label: string;
  to_unit: string;
  factor: number;
  value_heuristic?: (v: number) => boolean;
}

const UNIT_CONVERSIONS: Record<string, ConversionRule[]> = {
  pcr: [{ from_unit_pattern: /mg\/d/i, from_unit_label: "mg/dL", to_unit: "mg/L", factor: 10, value_heuristic: (v) => v > 0 && v < 0.5 }],
  estradiol: [{ from_unit_pattern: /ng\/d/i, from_unit_label: "ng/dL", to_unit: "pg/mL", factor: 10, value_heuristic: (v) => v < 1 }],
  t3_livre: [{ from_unit_pattern: /ng\/d/i, from_unit_label: "ng/dL", to_unit: "pg/mL", factor: 10, value_heuristic: (v) => v < 1.0 }],
};

function findConversionRule(markerId: string, unitRaw: string | undefined, value: number | undefined): { rule: ConversionRule; reason: string } | null {
  const rules = UNIT_CONVERSIONS[markerId];
  if (!rules) return null;
  if (unitRaw) {
    const matched = rules.find(r => r.from_unit_pattern.test(unitRaw));
    if (matched) return { rule: matched, reason: `unit ${unitRaw} → ${matched.to_unit}` };
  }
  if (value !== undefined) {
    const matched = rules.find(r => r.value_heuristic?.(value));
    if (matched) return { rule: matched, reason: `heuristic` };
  }
  return null;
}

function applyFactor(value: number, factor: number): number {
  return Math.round(value * factor * 10000) / 10000;
}

function roundValue(value: number): number {
  if (value === 0) return 0;
  const abs = Math.abs(value);
  let decimals: number;
  if (abs >= 100) decimals = 0;
  else if (abs >= 10) decimals = 1;
  else if (abs >= 1) decimals = 2;
  else if (abs >= 0.1) decimals = 3;
  else decimals = 4;
  return parseFloat(value.toFixed(decimals));
}

/**
 * Simplified normalizeHistoricalResults for test environment
 */
function normalizeHistoricalResults(timelines: HistoricalMarkerTimeline[]): HistoricalMarkerTimeline[] {
  for (const tl of timelines) {
    for (const entry of tl.entries) {
      // 1. Preserve raw
      entry.raw_value = entry.value;
      entry.raw_text_value = entry.text_value;
      entry.raw_unit = entry.unit;
      entry.raw_ref_text = tl.reference_text;

      // 2. Normalize operators
      if (entry.text_value) {
        const { normalized, value: opValue } = normalizeOperator(entry.text_value);
        entry.text_value = normalized;
        if (opValue !== null && entry.value === undefined) {
          entry.value = opValue;
        }
      }

      // 3. Unit conversion
      if (typeof entry.value === "number") {
        const match = findConversionRule(tl.marker_id, entry.unit, entry.value);
        if (match) {
          entry.value = applyFactor(entry.value, match.rule.factor);
          entry.unit = match.rule.to_unit;
          entry.conversion_applied = true;
          entry.conversion_reason = match.reason;
        } else {
          entry.conversion_applied = false;
        }
        entry.value = roundValue(entry.value);
      } else {
        entry.conversion_applied = false;
      }
    }
  }
  return timelines;
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

describe("Document Profile Detection", () => {
  it("detects LAUDO EVOLUTIVO page", () => {
    const text = `LAUDO EVOLUTIVO
Exame          15/01/2025    03/06/2024    12/12/2023
Hemoglobina    13.1          12.8          13.5
Hematócrito    39.2          38.5          40.1`;
    const blocks = detectDocumentProfiles(text);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("evolution_page");
    expect(blocks[0].dates).toContain("2025-01-15");
    expect(blocks[0].dates).toContain("2024-06-03");
    expect(blocks[0].dates).toContain("2023-12-12");
  });

  it("detects EVOLUÇÃO DE RESULTADOS", () => {
    const text = `EVOLUÇÃO DE RESULTADOS
Data: 10/03/2025  15/09/2024
TSH     2.5    3.1`;
    const blocks = detectDocumentProfiles(text);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("evolution_page");
  });

  it("detects inline Resultados Anteriores", () => {
    const text = `Hemoglobina
Resultado: 13.1 g/dL
Referência: 12.0 a 16.0

Resultados Anteriores
Data         Resultado
03/06/2024   12.8
12/12/2023   13.5`;
    const blocks = detectDocumentProfiles(text);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("inline_history");
    expect(blocks[0].dates.length).toBe(2);
  });

  it("detects multi-date table by header density", () => {
    const text = `Analito    01/01/2025  01/06/2024  01/01/2024  Referência
Glicose    95          102         88          70 a 99
TSH        2.1         3.4         2.8         0.4 a 4.0`;
    const blocks = detectDocumentProfiles(text);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("multi_date_table");
    expect(blocks[0].dates.length).toBe(3);
  });

  it("does not detect current result pages as historical", () => {
    const text = `HEMOGRAMA COMPLETO
Hemoglobina    13.1 g/dL    12.0 a 16.0
Hematócrito    39.2 %       36.0 a 46.0`;
    const blocks = detectDocumentProfiles(text);
    expect(blocks.length).toBe(0);
  });

  it("separates evolution and current pages with form-feed", () => {
    const currentPage = `HEMOGRAMA COMPLETO
Hemoglobina    13.1 g/dL    12.0 a 16.0`;
    const evolutionPage = `LAUDO EVOLUTIVO
Exame          15/01/2025    03/06/2024
Hemoglobina    13.1          12.8`;
    const blocks = detectDocumentProfiles(currentPage + "\f" + evolutionPage);
    expect(blocks.length).toBe(1);
    expect(blocks[0].type).toBe("evolution_page");
  });
});

describe("Date Parsing", () => {
  it("parses DD/MM/YYYY", () => { expect(parseBrDate("15/01/2025")).toBe("2025-01-15"); });
  it("parses DD/MM/YY", () => { expect(parseBrDate("15/01/25")).toBe("2025-01-15"); });
  it("parses DD.MM.YYYY", () => { expect(parseBrDate("15.01.2025")).toBe("2025-01-15"); });
  it("rejects invalid month", () => { expect(parseBrDate("15/13/2025")).toBeNull(); });
  it("rejects invalid day", () => { expect(parseBrDate("32/01/2025")).toBeNull(); });
  it("extracts multiple dates from text", () => {
    const dates = extractDates("Datas: 15/01/2025, 03/06/2024 e 12/12/2023");
    expect(dates.length).toBe(3);
    expect(dates).toContain("2025-01-15");
    expect(dates).toContain("2024-06-03");
    expect(dates).toContain("2023-12-12");
  });
});

describe("filterOutCurrentDate", () => {
  function filterOutCurrentDate(timelines: HistoricalMarkerTimeline[], currentExamDate: string | null) {
    if (!currentExamDate) return timelines;
    return timelines
      .map(tl => ({ ...tl, entries: tl.entries.filter(e => e.date !== currentExamDate) }))
      .filter(tl => tl.entries.length > 0);
  }

  it("removes entries matching current exam date", () => {
    const timelines: HistoricalMarkerTimeline[] = [{
      marker_id: "hemoglobina", marker_name: "Hemoglobina",
      entries: [
        { date: "2025-01-15", value: 13.1, source_type: "evolution_page" },
        { date: "2024-06-03", value: 12.8, source_type: "evolution_page" },
      ],
    }];
    const filtered = filterOutCurrentDate(timelines, "2025-01-15");
    expect(filtered.length).toBe(1);
    expect(filtered[0].entries.length).toBe(1);
    expect(filtered[0].entries[0].date).toBe("2024-06-03");
  });

  it("removes entire timeline if all entries match current date", () => {
    const timelines: HistoricalMarkerTimeline[] = [{
      marker_id: "tsh", marker_name: "TSH",
      entries: [{ date: "2025-01-15", value: 2.5, source_type: "evolution_page" }],
    }];
    const filtered = filterOutCurrentDate(timelines, "2025-01-15");
    expect(filtered.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Historical Normalization Tests
// ═══════════════════════════════════════════════════════════════════

describe("Historical Normalization", () => {
  it("preserves raw_value and raw_unit after conversion", () => {
    const timelines: HistoricalMarkerTimeline[] = [{
      marker_id: "pcr", marker_name: "PCR",
      entries: [
        { date: "2024-06-03", value: 0.3, unit: "mg/dL", source_type: "evolution_page" },
      ],
    }];
    const result = normalizeHistoricalResults(timelines);
    const entry = result[0].entries[0];

    // Raw preserved
    expect(entry.raw_value).toBe(0.3);
    expect(entry.raw_unit).toBe("mg/dL");

    // Normalized: 0.3 mg/dL × 10 = 3.0 mg/L
    expect(entry.value).toBe(3);
    expect(entry.unit).toBe("mg/L");
    expect(entry.conversion_applied).toBe(true);
  });

  it("normalizes operator text and preserves raw_text_value", () => {
    const timelines: HistoricalMarkerTimeline[] = [{
      marker_id: "anti_tpo", marker_name: "Anti-TPO",
      entries: [
        { date: "2024-06-03", text_value: "inferior a 34", source_type: "evolution_page" },
      ],
    }];
    const result = normalizeHistoricalResults(timelines);
    const entry = result[0].entries[0];

    expect(entry.raw_text_value).toBe("inferior a 34");
    expect(entry.text_value).toBe("< 34");
    expect(entry.value).toBe(34);
  });

  it("converts estradiol ng/dL → pg/mL in historical entry", () => {
    const timelines: HistoricalMarkerTimeline[] = [{
      marker_id: "estradiol", marker_name: "Estradiol",
      entries: [
        { date: "2024-01-15", value: 0.5, unit: "ng/dL", source_type: "evolution_page" },
      ],
    }];
    const result = normalizeHistoricalResults(timelines);
    const entry = result[0].entries[0];

    expect(entry.raw_value).toBe(0.5);
    expect(entry.raw_unit).toBe("ng/dL");
    expect(entry.value).toBe(5);
    expect(entry.unit).toBe("pg/mL");
    expect(entry.conversion_applied).toBe(true);
  });

  it("does not convert when unit is already canonical", () => {
    const timelines: HistoricalMarkerTimeline[] = [{
      marker_id: "hemoglobina", marker_name: "Hemoglobina",
      entries: [
        { date: "2024-06-03", value: 13.1, source_type: "evolution_page" },
      ],
    }];
    const result = normalizeHistoricalResults(timelines);
    const entry = result[0].entries[0];

    expect(entry.raw_value).toBe(13.1);
    expect(entry.value).toBe(13.1);
    expect(entry.conversion_applied).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Composite Dedup Tests
// ═══════════════════════════════════════════════════════════════════

describe("Composite Dedup Strategy", () => {
  it("keeps two entries for same marker+date from different sources", () => {
    const e1: HistoricalEntry = {
      date: "2024-06-03", value: 13.1,
      source_type: "evolution_page", source_lab: "Fleury",
    };
    const e2: HistoricalEntry = {
      date: "2024-06-03", value: 12.9,
      source_type: "inline_history", source_lab: "DASA",
    };
    const k1 = entryDedupKey(e1);
    const k2 = entryDedupKey(e2);
    expect(k1).not.toBe(k2);
  });

  it("deduplicates truly identical entries", () => {
    const e1: HistoricalEntry = {
      date: "2024-06-03", value: 13.1,
      source_type: "evolution_page",
    };
    const e2: HistoricalEntry = {
      date: "2024-06-03", value: 13.1,
      source_type: "evolution_page",
    };
    expect(entryDedupKey(e1)).toBe(entryDedupKey(e2));
  });

  it("keeps entries with same date but different values", () => {
    const e1: HistoricalEntry = {
      date: "2024-06-03", value: 13.1,
      source_type: "evolution_page",
    };
    const e2: HistoricalEntry = {
      date: "2024-06-03", value: 12.8,
      source_type: "evolution_page",
    };
    expect(entryDedupKey(e1)).not.toBe(entryDedupKey(e2));
  });

  it("differentiates by source_document", () => {
    const e1: HistoricalEntry = {
      date: "2024-06-03", value: 13.1,
      source_type: "evolution_page", source_document: "laudo_jan_2025.pdf",
    };
    const e2: HistoricalEntry = {
      date: "2024-06-03", value: 13.1,
      source_type: "evolution_page", source_document: "laudo_mar_2025.pdf",
    };
    expect(entryDedupKey(e1)).not.toBe(entryDedupKey(e2));
  });
});

// ═══════════════════════════════════════════════════════════════════
// Raw + Normalized Side-by-Side
// ═══════════════════════════════════════════════════════════════════

describe("Raw + Normalized Coexistence", () => {
  it("t3_livre with ng/dL: raw and normalized coexist", () => {
    const timelines: HistoricalMarkerTimeline[] = [{
      marker_id: "t3_livre", marker_name: "T3 Livre",
      entries: [
        { date: "2024-03-10", value: 0.35, unit: "ng/dL", source_type: "evolution_page" },
      ],
    }];
    const result = normalizeHistoricalResults(timelines);
    const entry = result[0].entries[0];

    // Raw
    expect(entry.raw_value).toBe(0.35);
    expect(entry.raw_unit).toBe("ng/dL");

    // Normalized
    expect(entry.value).toBe(3.5);
    expect(entry.unit).toBe("pg/mL");
    expect(entry.conversion_applied).toBe(true);
    expect(entry.conversion_reason).toBeDefined();
  });

  it("entry without conversion still has raw fields populated", () => {
    const timelines: HistoricalMarkerTimeline[] = [{
      marker_id: "glicose_jejum", marker_name: "Glicose Jejum",
      entries: [
        { date: "2024-01-10", value: 95, source_type: "inline_history" },
      ],
    }];
    const result = normalizeHistoricalResults(timelines);
    const entry = result[0].entries[0];

    expect(entry.raw_value).toBe(95);
    expect(entry.value).toBe(95);
    expect(entry.conversion_applied).toBe(false);
    expect(entry.raw_unit).toBeUndefined(); // no unit provided
  });

  it("reference_text is copied to raw_ref_text", () => {
    const timelines: HistoricalMarkerTimeline[] = [{
      marker_id: "tsh", marker_name: "TSH",
      reference_text: "0.4 a 4.0",
      entries: [
        { date: "2024-01-10", value: 2.5, source_type: "evolution_page" },
      ],
    }];
    const result = normalizeHistoricalResults(timelines);
    expect(result[0].entries[0].raw_ref_text).toBe("0.4 a 4.0");
  });
});
