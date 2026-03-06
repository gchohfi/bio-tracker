/**
 * historicalExtract.test.ts
 *
 * Testes para detecção de perfil de documento e extração histórica.
 */
import { describe, it, expect } from "vitest";

// We test the pure functions by importing from the edge function module
// Since these are Deno files, we replicate the key logic for testing

// --- Replicated helpers for test environment ---

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

// ─── Tests ───────────────────────────────────────────────────────────────────

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
  it("parses DD/MM/YYYY", () => {
    expect(parseBrDate("15/01/2025")).toBe("2025-01-15");
  });

  it("parses DD/MM/YY", () => {
    expect(parseBrDate("15/01/25")).toBe("2025-01-15");
  });

  it("parses DD.MM.YYYY", () => {
    expect(parseBrDate("15.01.2025")).toBe("2025-01-15");
  });

  it("rejects invalid month", () => {
    expect(parseBrDate("15/13/2025")).toBeNull();
  });

  it("rejects invalid day", () => {
    expect(parseBrDate("32/01/2025")).toBeNull();
  });

  it("extracts multiple dates from text", () => {
    const dates = extractDates("Datas: 15/01/2025, 03/06/2024 e 12/12/2023");
    expect(dates.length).toBe(3);
    expect(dates).toContain("2025-01-15");
    expect(dates).toContain("2024-06-03");
    expect(dates).toContain("2023-12-12");
  });
});

describe("filterOutCurrentDate", () => {
  it("removes entries matching current exam date", () => {
    const timelines = [{
      marker_id: "hemoglobina",
      marker_name: "Hemoglobina",
      entries: [
        { date: "2025-01-15", value: 13.1, source_type: "evolution_page" as const },
        { date: "2024-06-03", value: 12.8, source_type: "evolution_page" as const },
      ],
    }];

    // Replicate filterOutCurrentDate
    const currentExamDate = "2025-01-15";
    const filtered = timelines
      .map(tl => ({
        ...tl,
        entries: tl.entries.filter(e => e.date !== currentExamDate),
      }))
      .filter(tl => tl.entries.length > 0);

    expect(filtered.length).toBe(1);
    expect(filtered[0].entries.length).toBe(1);
    expect(filtered[0].entries[0].date).toBe("2024-06-03");
  });

  it("removes entire timeline if all entries match current date", () => {
    const timelines = [{
      marker_id: "tsh",
      marker_name: "TSH",
      entries: [
        { date: "2025-01-15", value: 2.5, source_type: "evolution_page" as const },
      ],
    }];

    const currentExamDate = "2025-01-15";
    const filtered = timelines
      .map(tl => ({
        ...tl,
        entries: tl.entries.filter(e => e.date !== currentExamDate),
      }))
      .filter(tl => tl.entries.length > 0);

    expect(filtered.length).toBe(0);
  });
});
