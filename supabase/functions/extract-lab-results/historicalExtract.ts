/**
 * historicalExtract.ts
 *
 * Módulo de extração de dados históricos/evolutivos de laudos laboratoriais.
 * 
 * Responsabilidades:
 * - Detectar perfis de documento (evolution_page, inline_history, multi_date_table)
 * - Extrair dados históricos de blocos identificados
 * - Normalizar entradas históricas em formato consistente
 *
 * NÃO modifica currentResults — apenas produz historicalResults em paralelo.
 */

import { parseBrNum } from "./utils.ts";
import { MARKER_LIST } from "./constants.ts";
import type {
  DetectedBlock,
  DocumentProfileType,
  HistoricalEntry,
  HistoricalMarkerTimeline,
} from "./historicalTypes.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MARKER_NAME_TO_ID = new Map<string, string>();
for (const m of MARKER_LIST) {
  MARKER_NAME_TO_ID.set(m.name.toLowerCase(), m.id);
  // Common aliases
  const id = m.id;
  MARKER_NAME_TO_ID.set(id, id);
}

// Additional aliases for common lab names → marker_id
const ALIASES: Record<string, string> = {
  "hemoglobina": "hemoglobina",
  "hematócrito": "hematocrito",
  "hematocrito": "hematocrito",
  "hemácias": "eritrocitos",
  "hemacias": "eritrocitos",
  "eritrócitos": "eritrocitos",
  "leucócitos": "leucocitos",
  "leucocitos": "leucocitos",
  "plaquetas": "plaquetas",
  "glicose": "glicose_jejum",
  "glicemia de jejum": "glicose_jejum",
  "insulina": "insulina_jejum",
  "hemoglobina glicada": "hba1c",
  "hba1c": "hba1c",
  "colesterol total": "colesterol_total",
  "hdl": "hdl",
  "hdl colesterol": "hdl",
  "ldl": "ldl",
  "ldl colesterol": "ldl",
  "vldl": "vldl",
  "triglicérides": "triglicerides",
  "triglicerides": "triglicerides",
  "triglicerídeos": "triglicerides",
  "triglicerideos": "triglicerides",
  "tsh": "tsh",
  "t4 livre": "t4_livre",
  "t3 livre": "t3_livre",
  "t4 total": "t4_total",
  "t3 total": "t3_total",
  "vitamina d": "vitamina_d",
  "25-oh vitamina d": "vitamina_d",
  "vitamina b12": "vitamina_b12",
  "ácido fólico": "acido_folico",
  "acido folico": "acido_folico",
  "ferro sérico": "ferro_serico",
  "ferro serico": "ferro_serico",
  "ferritina": "ferritina",
  "transferrina": "transferrina",
  "creatinina": "creatinina",
  "ureia": "ureia",
  "uréia": "ureia",
  "ácido úrico": "acido_urico",
  "acido urico": "acido_urico",
  "tgo": "tgo_ast",
  "ast": "tgo_ast",
  "tgp": "tgp_alt",
  "alt": "tgp_alt",
  "ggt": "ggt",
  "gama gt": "ggt",
  "fosfatase alcalina": "fosfatase_alcalina",
  "bilirrubina total": "bilirrubina_total",
  "bilirrubina direta": "bilirrubina_direta",
  "pcr": "pcr",
  "proteína c reativa": "pcr",
  "proteina c reativa": "pcr",
  "vhs": "vhs",
  "testosterona total": "testosterona_total",
  "testosterona livre": "testosterona_livre",
  "estradiol": "estradiol",
  "progesterona": "progesterona",
  "dhea-s": "dhea_s",
  "dhea sulfato": "dhea_s",
  "cortisol": "cortisol",
  "shbg": "shbg",
  "fsh": "fsh",
  "lh": "lh",
  "prolactina": "prolactina",
  "igf-1": "igf1",
  "somatomedina c": "igf1",
  "pth": "pth",
  "paratormônio": "pth",
  "paratormonio": "pth",
  "cálcio total": "calcio_total",
  "calcio total": "calcio_total",
  "cálcio iônico": "calcio_ionico",
  "calcio ionico": "calcio_ionico",
  "magnésio": "magnesio",
  "magnesio": "magnesio",
  "zinco": "zinco",
  "sódio": "sodio",
  "sodio": "sodio",
  "potássio": "potassio",
  "potassio": "potassio",
  "fósforo": "fosforo",
  "fosforo": "fosforo",
  "albumina": "albumina",
  "proteínas totais": "proteinas_totais",
  "proteinas totais": "proteinas_totais",
  "homocisteína": "homocisteina",
  "homocisteina": "homocisteina",
  "fibrinogênio": "fibrinogenio",
  "fibrinogenio": "fibrinogenio",
  "selênio": "selenio",
  "selenio": "selenio",
  "anti-tpo": "anti_tpo",
  "anti tpo": "anti_tpo",
  "anti-tg": "anti_tg",
  "anti tg": "anti_tg",
  "neutrófilos": "neutrofilos",
  "neutrofilos": "neutrofilos",
  "linfócitos": "linfocitos",
  "linfocitos": "linfocitos",
  "monócitos": "monocitos",
  "monocitos": "monocitos",
  "eosinófilos": "eosinofilos",
  "eosinofilos": "eosinofilos",
  "basófilos": "basofilos",
  "basofilos": "basofilos",
  "rdw": "rdw",
  "vcm": "vcm",
  "hcm": "hcm",
  "chcm": "chcm",
  "vpm": "vpm",
};

/** Resolve nome do exame para marker_id */
function resolveMarkerId(name: string): string | null {
  const lower = name.toLowerCase().trim();
  // Direct alias match
  if (ALIASES[lower]) return ALIASES[lower];
  // Try MARKER_NAME_TO_ID
  if (MARKER_NAME_TO_ID.has(lower)) return MARKER_NAME_TO_ID.get(lower)!;
  // Fuzzy: remove accents and try again
  const normalized = lower
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "").trim();
  if (ALIASES[normalized]) return ALIASES[normalized];
  return null;
}

/** Parse date in DD/MM/YYYY or DD/MM/YY format to ISO string */
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

/** Extract all dates from a text segment */
function extractDates(text: string): string[] {
  const dates: string[] = [];
  const regex = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const parsed = parseBrDate(match[0]);
    if (parsed) dates.push(parsed);
  }
  // Deduplicate
  return [...new Set(dates)];
}

// ---------------------------------------------------------------------------
// 1. Document Profile Detection
// ---------------------------------------------------------------------------

/** Patterns that indicate an evolution/historical page */
const EVOLUTION_PATTERNS = [
  /LAUDO\s+EVOLUTIVO/i,
  /EVOLU[CÇ][AÃ]O\s+(?:DE\s+)?(?:RESULTADOS|EXAMES)/i,
  /HIST[OÓ]RICO\s+DE\s+RESULTADOS/i,
  /RESULTADOS\s+COMPARATIVOS/i,
];

/** Patterns for inline history within current results */
const INLINE_HISTORY_PATTERNS = [
  /Resultado(?:s)?\s+Anterior(?:es)?/i,
  /Exames?\s+Anterior(?:es)?/i,
  /Resultado(?:s)?\s+Pr[eé]vio(?:s)?/i,
  /Hist[oó]rico\s+(?:do\s+)?(?:Exame|Resultado)/i,
];

/**
 * Detecta blocos/páginas com perfis diferentes no texto do PDF.
 * Retorna array de blocos detectados com tipo e posição.
 */
export function detectDocumentProfiles(pdfText: string): DetectedBlock[] {
  const blocks: DetectedBlock[] = [];

  // Split by page markers or large gaps (common in PDF-to-text)
  // Most PDF extractors insert form-feed (\f) or multiple newlines between pages
  const pages = pdfText.split(/\f|(?:\n\s*\n\s*\n\s*\n)/);
  
  let offset = 0;
  for (const page of pages) {
    const trimmed = page.trim();
    if (!trimmed) {
      offset += page.length + 1;
      continue;
    }

    let detected = false;

    // Check for evolution page
    for (const pat of EVOLUTION_PATTERNS) {
      if (pat.test(trimmed)) {
        const dates = extractDates(trimmed);
        if (dates.length >= 2) {
          blocks.push({
            type: "evolution_page",
            start: offset,
            end: offset + page.length,
            text: trimmed,
            dates: dates.sort(),
          });
          detected = true;
          break;
        }
      }
    }

    // Check for inline history blocks within the page
    if (!detected) {
      for (const pat of INLINE_HISTORY_PATTERNS) {
        const m = trimmed.match(pat);
        if (m && m.index !== undefined) {
          // Extract the inline history section
          const histStart = m.index;
          const histText = trimmed.slice(histStart);
          const dates = extractDates(histText);
          if (dates.length >= 1) {
            blocks.push({
              type: "inline_history",
              start: offset + histStart,
              end: offset + page.length,
              text: histText,
              dates,
            });
          }
          detected = true;
          break;
        }
      }
    }

    // Check for multi-date table (3+ dates in header area)
    if (!detected) {
      const headerArea = trimmed.slice(0, Math.min(500, trimmed.length));
      const dates = extractDates(headerArea);
      if (dates.length >= 3) {
        blocks.push({
          type: "multi_date_table",
          start: offset,
          end: offset + page.length,
          text: trimmed,
          dates: dates.sort(),
        });
      }
    }

    offset += page.length + 1;
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// 2. Evolution Table Parser
// ---------------------------------------------------------------------------

/**
 * Parse uma página de LAUDO EVOLUTIVO.
 * Formato típico:
 *   EXAME          | 15/01/25 | 03/06/24 | 12/12/23 | Referência
 *   Hemoglobina    | 13.1     | 12.8     | 13.5     | 12.0 a 16.0
 *   Hematócrito    | 39.2     | 38.5     | 40.1     | 36.0 a 46.0
 */
function parseEvolutionTable(block: DetectedBlock): HistoricalMarkerTimeline[] {
  const timelines: HistoricalMarkerTimeline[] = [];
  const lines = block.text.split("\n").map(l => l.trim()).filter(Boolean);
  
  // Find the dates in the header
  const dates = block.dates;
  if (dates.length < 2) return timelines;

  // Try to detect table structure
  for (const line of lines) {
    // Skip header lines and section titles
    if (/^(LAUDO|EVOLU|EXAME|ANALITO|Material|Paciente|Data)/i.test(line)) continue;
    if (/^\s*$/.test(line)) continue;
    
    // Try to parse: "ExamName  value1  value2  value3  reference"
    // Values might be separated by tabs, multiple spaces, or pipes
    const parts = line.split(/\t|\s{2,}|\|/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 3) continue;

    // First part is the exam name
    const examName = parts[0];
    const markerId = resolveMarkerId(examName);
    if (!markerId) continue;

    const marker = MARKER_LIST.find(m => m.id === markerId);
    const entries: HistoricalEntry[] = [];

    // Try to match values to dates
    const valueParts = parts.slice(1);
    
    // Last part might be reference text (contains "a" or operator)
    let refText: string | undefined;
    const lastPart = valueParts[valueParts.length - 1];
    if (lastPart && /\d+\s*(?:a|até|[-–])\s*\d+|^[<>]/.test(lastPart)) {
      refText = lastPart;
      valueParts.pop();
    }

    for (let i = 0; i < Math.min(valueParts.length, dates.length); i++) {
      const rawVal = valueParts[i];
      if (!rawVal || rawVal === "-" || rawVal === "--" || rawVal === "***") continue;

      const entry: HistoricalEntry = {
        date: dates[i],
        source_type: "evolution_page",
      };

      // Check for operator values
      const opMatch = rawVal.match(/^([<>]=?)\s*([\d,\.]+)/);
      if (opMatch) {
        entry.value = parseBrNum(opMatch[2]);
        entry.text_value = rawVal;
      } else {
        const num = parseBrNum(rawVal);
        if (!isNaN(num)) {
          entry.value = num;
        } else {
          entry.text_value = rawVal;
        }
      }

      entries.push(entry);
    }

    if (entries.length > 0) {
      timelines.push({
        marker_id: markerId,
        marker_name: marker?.name || examName,
        entries,
        reference_text: refText,
      });
    }
  }

  return timelines;
}

// ---------------------------------------------------------------------------
// 3. Inline History Parser
// ---------------------------------------------------------------------------

/**
 * Parse blocos de "Resultados Anteriores" inline.
 * Formato típico (Fleury):
 *   Resultados Anteriores
 *   Data         Resultado
 *   03/06/2024   12.8
 *   12/12/2023   13.5
 */
function parseInlineHistory(block: DetectedBlock, contextMarkerId?: string): HistoricalMarkerTimeline[] {
  const timelines: HistoricalMarkerTimeline[] = [];
  const lines = block.text.split("\n").map(l => l.trim()).filter(Boolean);

  // Try to detect current marker from context
  let currentMarkerId = contextMarkerId || null;
  const entries: HistoricalEntry[] = [];

  for (const line of lines) {
    // Skip headers
    if (/^Resultado(?:s)?\s+Anterior|^Data\s+Resultado|^Exame/i.test(line)) continue;

    // Try to extract marker name from context (line before "Resultados Anteriores")
    if (!currentMarkerId) {
      const markerId = resolveMarkerId(line);
      if (markerId) {
        currentMarkerId = markerId;
        continue;
      }
    }

    // Parse date + value lines
    const dateValueMatch = line.match(
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\s+(.*)/
    );
    if (dateValueMatch) {
      const date = parseBrDate(dateValueMatch[1]);
      if (!date) continue;

      const rawVal = dateValueMatch[2].trim();
      const entry: HistoricalEntry = {
        date,
        source_type: "inline_history",
      };

      const opMatch = rawVal.match(/^([<>]=?)\s*([\d,\.]+)/);
      if (opMatch) {
        entry.value = parseBrNum(opMatch[2]);
        entry.text_value = rawVal;
      } else {
        const num = parseBrNum(rawVal);
        if (!isNaN(num)) {
          entry.value = num;
        } else if (rawVal.length > 0 && rawVal !== "-") {
          entry.text_value = rawVal;
        }
      }

      if (entry.value !== undefined || entry.text_value) {
        entries.push(entry);
      }
    }
  }

  if (currentMarkerId && entries.length > 0) {
    const marker = MARKER_LIST.find(m => m.id === currentMarkerId);
    timelines.push({
      marker_id: currentMarkerId,
      marker_name: marker?.name || currentMarkerId,
      entries,
    });
  }

  return timelines;
}

// ---------------------------------------------------------------------------
// 4. Multi-Date Table Parser
// ---------------------------------------------------------------------------

/**
 * Parse tabela com múltiplas colunas de data no header.
 * Variação do evolution table, mas detectada por densidade de datas no header.
 */
function parseMultiDateTable(block: DetectedBlock): HistoricalMarkerTimeline[] {
  // Reuse evolution table parser — same structure
  return parseEvolutionTable(block);
}

// ---------------------------------------------------------------------------
// 5. Main extraction orchestrator
// ---------------------------------------------------------------------------

/**
 * Extrai dados históricos de todos os blocos detectados.
 * Retorna array consolidado de timelines por marcador.
 */
export function extractHistoricalData(
  pdfText: string,
  blocks: DetectedBlock[]
): HistoricalMarkerTimeline[] {
  const allTimelines: HistoricalMarkerTimeline[] = [];

  for (const block of blocks) {
    let parsed: HistoricalMarkerTimeline[] = [];

    switch (block.type) {
      case "evolution_page":
        parsed = parseEvolutionTable(block);
        console.log(`[HIST] Evolution page: ${parsed.length} markers, dates: ${block.dates.join(", ")}`);
        break;

      case "inline_history":
        parsed = parseInlineHistory(block);
        console.log(`[HIST] Inline history: ${parsed.length} markers`);
        break;

      case "multi_date_table":
        parsed = parseMultiDateTable(block);
        console.log(`[HIST] Multi-date table: ${parsed.length} markers, dates: ${block.dates.join(", ")}`);
        break;

      default:
        // current_result blocks are handled by the main pipeline
        break;
    }

    allTimelines.push(...parsed);
  }

  // Merge timelines for the same marker_id
  return mergeTimelines(allTimelines);
}

/**
 * Merge multiple timelines for the same marker_id into one.
 * Deduplicates entries by composite key: date + source_type + raw_value.
 * Allows same marker + same date from different sources (e.g., two labs).
 */
function mergeTimelines(timelines: HistoricalMarkerTimeline[]): HistoricalMarkerTimeline[] {
  const byMarker = new Map<string, HistoricalMarkerTimeline>();

  for (const tl of timelines) {
    const existing = byMarker.get(tl.marker_id);
    if (!existing) {
      byMarker.set(tl.marker_id, { ...tl, entries: [...tl.entries] });
    } else {
      // Composite dedup key: date + source_type + value (or text_value)
      const existingKeys = new Set(
        existing.entries.map(e => entryDedupKey(e))
      );
      for (const entry of tl.entries) {
        const key = entryDedupKey(entry);
        if (!existingKeys.has(key)) {
          existing.entries.push(entry);
          existingKeys.add(key);
        }
      }
      // Use reference_text if not already set
      if (!existing.reference_text && tl.reference_text) {
        existing.reference_text = tl.reference_text;
      }
    }
  }

  // Sort entries by date descending (most recent first)
  for (const tl of byMarker.values()) {
    tl.entries.sort((a, b) => b.date.localeCompare(a.date));
  }

  return Array.from(byMarker.values());
}

/**
 * Gera chave composta para deduplicação de entradas históricas.
 * Chave: marker_date|source_type|source_lab|source_document|raw_value_or_text
 */
function entryDedupKey(e: HistoricalEntry): string {
  const valueKey = e.value !== undefined ? String(e.value) : (e.text_value || "");
  return `${e.date}|${e.source_type}|${e.source_lab || ""}|${e.source_document || ""}|${valueKey}`;
}

/**
 * Remove do historicalResults qualquer entrada cuja data == examDate atual,
 * evitando duplicação com currentResults.
 */
export function filterOutCurrentDate(
  timelines: HistoricalMarkerTimeline[],
  currentExamDate: string | null
): HistoricalMarkerTimeline[] {
  if (!currentExamDate) return timelines;

  return timelines
    .map(tl => ({
      ...tl,
      entries: tl.entries.filter(e => e.date !== currentExamDate),
    }))
    .filter(tl => tl.entries.length > 0);
}
