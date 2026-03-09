/**
 * functionalMatcher.ts
 *
 * Régua de matching para preencher Ref. Funcional e Status Funcional
 * no Excel evolutivo. Camada secundária — NUNCA sobrescreve a referência
 * principal (laboratório) nem o status principal.
 *
 * Fluxo:
 *   1. Normalizar nome do analito
 *   2. Tentar match exato por marker_id
 *   3. Tentar match por nome normalizado
 *   4. Tentar match por aliases controlados
 *   5. Validar compatibilidade de unidade
 *   6. Validar sexo
 *   7. Calcular score de confiança
 *   8. Preencher somente quando score >= 90 (ou 85 com candidato único)
 */

import { MARKERS, type MarkerDef } from "@/lib/markers";
import {
  FUNCTIONAL_RANGES,
  type FunctionalRange,
  type FunctionalResult,
} from "@/lib/functionalRanges";

// ═══════════════════════════════════════════════════════════════════════════
// 1. Normalização de nome
// ═══════════════════════════════════════════════════════════════════════════

/** Remove acentos, lowercase, espaços duplos, pontuação desnecessária */
function normalizeAnalyteName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, " ") // remove parênteses explicativos
    .replace(/[.,;:!?]/g, "") // remove pontuação
    .replace(/\s+/g, " ") // espaços duplos
    .trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Mapas de lookup
// ═══════════════════════════════════════════════════════════════════════════

// Map: marker_id → marker name from MARKERS
const MARKER_NAME_BY_ID = new Map<string, string>();
for (const m of MARKERS) {
  MARKER_NAME_BY_ID.set(m.id, m.name);
}

// Map: normalized marker name → marker_id (from MARKERS)
const ID_BY_NORMALIZED_NAME = new Map<string, string>();
for (const m of MARKERS) {
  ID_BY_NORMALIZED_NAME.set(normalizeAnalyteName(m.name), m.id);
}

// Map: marker_id → FunctionalRange (from FUNCTIONAL_RANGES)
const FUNC_BY_ID = new Map<string, FunctionalRange>();
for (const fr of FUNCTIONAL_RANGES) {
  FUNC_BY_ID.set(fr.marker_id, fr);
}

// Map: normalized name → FunctionalRange (built from MARKERS names for functional entries)
const FUNC_BY_NORMALIZED_NAME = new Map<string, FunctionalRange>();
for (const fr of FUNCTIONAL_RANGES) {
  const markerName = MARKER_NAME_BY_ID.get(fr.marker_id);
  if (markerName) {
    FUNC_BY_NORMALIZED_NAME.set(normalizeAnalyteName(markerName), fr);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Aliases controlados: nome alternativo normalizado → marker_id funcional
// ═══════════════════════════════════════════════════════════════════════════

const NAME_ALIASES: Record<string, string> = {
  // Lipoproteínas
  "apolipoproteina a-1": "apo_a1",
  "apolipoproteina a1": "apo_a1",
  "apoa1": "apo_a1",
  "apo a1": "apo_a1",
  "apo a-1": "apo_a1",

  // Ferro — painel metabólico como alias do sérico
  "ferro": "ferro_serico",
  "ferro painel metabolismo do ferro": "ferro_serico",
  "apolipoproteina b": "apo_b",
  "apob": "apo_b",
  "apo b": "apo_b",
  "lipoproteina": "lipoproteina_a",
  "lp": "lipoproteina_a",

  // Hormônios
  "sdhea": "dhea_s",
  "s-dhea": "dhea_s",
  "sulfato de dhea": "dhea_s",
  "dehidroepiandrosterona": "dhea_s",

  // Tireoide
  "anti-tireoglobulina": "anti_tg",
  "antitireoglobulina": "anti_tg",

  // Inflamação
  "pcr-hs": "pcr",
  "pcr ultrassensivel": "pcr",
  "proteina c reativa": "pcr",
  "proteina c reativa ultrassensivel": "pcr",

  // Hepático
  "gama gt": "ggt",
  "gama-gt": "ggt",
  "gama glutamil transferase": "ggt",
  "tgo": "tgo_ast",
  "ast": "tgo_ast",
  "aspartato aminotransferase": "tgo_ast",
  "tgp": "tgp_alt",
  "alt": "tgp_alt",
  "alanina aminotransferase": "tgp_alt",
  "fa": "fosfatase_alcalina",
  "fosfatase alcalina": "fosfatase_alcalina",

  // Eixo GH
  "igf 1": "igf1",
  "igf-1": "igf1",
  "somatomedina c": "igf1",
  "somatomedina": "igf1",
  "igfbp-3": "igfbp3",
  "igfbp 3": "igfbp3",

  // Relações lipídicas
  "colesterol total / hdl": "relacao_ct_hdl",
  "ct/hdl": "relacao_ct_hdl",
  "ct / hdl": "relacao_ct_hdl",
  "triglicerideos / hdl": "relacao_tg_hdl",
  "tg/hdl": "relacao_tg_hdl",
  "tg / hdl": "relacao_tg_hdl",
  "apob/apoa1": "relacao_apob_apoa1",
  "apob / apoa1": "relacao_apob_apoa1",

  // Urina
  "ph urinario": "urina_ph",
  "ph": "copro_ph", // ambíguo, mas no contexto de fezes
  "ph fecal": "copro_ph",

  // Vitaminas
  "acido folico": "acido_folico",
  "folato": "acido_folico",
  "vitamina b12": "vitamina_b12",
  "b12": "vitamina_b12",
  "vitamina d": "vitamina_d",
  "25-oh vitamina d": "vitamina_d",
  "25-hidroxi vitamina d": "vitamina_d",
  "vitamina a": "vitamina_a",
  "retinol": "vitamina_a",
  "vitamina c": "vitamina_c",

  // Minerais
  "selenio": "selenio",
  "zinco": "zinco",
  "cobre": "cobre",
  "magnesio": "magnesio",

  // Renal
  "acido urico": "acido_urico",
  "calcio total": "calcio_total",
  "calcio serico": "calcio_total",

  // Eixo Adrenal
  "aldosterona": "aldosterona",
  "aldosterona supina": "aldosterona",

  // Hormônios
  "hormonio anti-mulleriano": "amh",
  "anti-mulleriano": "amh",

  // Pancreático
  "amilase": "amilase",
  "lipase": "lipase",

  // Coagulação
  "fibrinogenio": "fibrinogenio",

  // Proteínas
  "proteinas totais": "proteinas_totais",

  // CK
  "cpk": "ck",
  "ck total": "ck",
  "creatinoquinase": "ck",
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. Compatibilidade de unidade
// ═══════════════════════════════════════════════════════════════════════════

/** Grupos de unidades consideradas compatíveis (equivalentes numéricas) */
const UNIT_COMPAT_GROUPS: string[][] = [
  ["/mm³", "/µl", "/ul", "/mm3"],
  ["mcg/dl", "µg/dl", "ug/dl"],
  ["mui/l", "µiu/ml", "uiu/ml", "miu/ml"],
  ["mil/µl", "mil/ul", "x10³/µl", "x10^3/µl"],
  ["meq/l", "mmol/l"], // for Na, K, Cl (monovalent ions)
  ["µg/ml", "mg/l"],
  ["µg/l", "mcg/l"],
];

function normalizeUnitForCompat(u: string): string {
  return u
    .toLowerCase()
    .replace(/\s/g, "")
    .replace(/μ/g, "µ")
    .replace(/³/g, "3")
    .replace(/×/g, "x");
}

function areUnitsCompatible(unitA: string, unitB: string): boolean {
  if (!unitA || !unitB) return true; // empty unit = no constraint
  const a = normalizeUnitForCompat(unitA);
  const b = normalizeUnitForCompat(unitB);
  if (a === b) return true;

  for (const group of UNIT_COMPAT_GROUPS) {
    if (group.includes(a) && group.includes(b)) return true;
  }
  return false;
}

/**
 * Check if units are INCOMPATIBLE and would require numeric conversion.
 * Returns true if the units are fundamentally different scales.
 */
function areUnitsIncompatible(unitA: string, unitB: string): boolean {
  if (!unitA || !unitB) return false;
  const a = normalizeUnitForCompat(unitA);
  const b = normalizeUnitForCompat(unitB);
  if (a === b) return false;
  if (areUnitsCompatible(unitA, unitB)) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Score de confiança
// ═══════════════════════════════════════════════════════════════════════════

type MatchType = "exact_id" | "exact_name" | "alias" | "none";

function computeScore(
  matchType: MatchType,
  unitCompat: boolean,
  unitEmpty: boolean,
): number {
  if (matchType === "none") return 0;

  const isExact = matchType === "exact_id" || matchType === "exact_name";

  if (isExact && unitCompat && !unitEmpty) return 100;
  if (!isExact && unitCompat && !unitEmpty) return 90; // alias
  if (isExact && unitEmpty) return 85;
  if (!isExact && unitEmpty) return 75;
  // incompatible unit
  if (isExact) return 50;
  return 40;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Log de matching
// ═══════════════════════════════════════════════════════════════════════════

export interface FunctionalMatchLog {
  originalName: string;
  normalizedName: string;
  markerId: string;
  context: string; // "sérico" | "não-sérico" | "derivado"
  matchType: MatchType;
  matchedFuncId: string | null;
  score: number;
  reason: string;
  unitMarker: string;
  unitFunc: string;
  filled: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Resultado do matching
// ═══════════════════════════════════════════════════════════════════════════

export interface FunctionalMatchResult {
  result: FunctionalResult | null;
  score: number;
  log: FunctionalMatchLog;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. Resolução funcional (com conversão de unidade integrada)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve a functional reference using the matched FunctionalRange.
 * Handles unit conversion of the functional range to the marker's canonical unit.
 * Reuses the conversion logic from functionalRanges.ts.
 */
import { resolveFunctionalRef } from "@/lib/functionalRanges";

// ═══════════════════════════════════════════════════════════════════════════
// 9. API principal
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Match a marker against the functional reference table.
 *
 * @param markerId - marker_id from evolution data
 * @param markerName - display name of the marker
 * @param value - numeric value (for status calculation)
 * @param sex - patient sex
 * @param canonicalUnit - marker's canonical unit
 * @returns FunctionalMatchResult with result, score, and log
 */
export function matchFunctionalRef(
  markerId: string,
  markerName: string,
  value: number | null,
  sex: "M" | "F",
  canonicalUnit: string,
): FunctionalMatchResult {
  const normalizedName = normalizeAnalyteName(markerName);

  const makeLog = (
    matchType: MatchType,
    matchedFuncId: string | null,
    score: number,
    reason: string,
    unitFunc: string,
    filled: boolean,
  ): FunctionalMatchLog => ({
    originalName: markerName,
    normalizedName,
    markerId,
    context: "sérico", // default; overridden by blocker
    matchType,
    matchedFuncId,
    score,
    reason,
    unitMarker: canonicalUnit,
    unitFunc,
    filled,
  });

  // ── Step 0: Context blocker — skip non-serum markers ──
  // Markers whose name or ID contain specimen-specific terms must NOT match
  // generic serum/blood functional references.
  const CONTEXT_BLOCK_TERMS = [
    "urina", "fezes", "fecal", "saliva", "24h",
    "liquido", "liquor", "abs", "quantitativo",
  ];
  const EXCLUDED_PREFIXES = ["urina_", "copro_"];
  const nameLower = markerName
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const blockedByPrefix = EXCLUDED_PREFIXES.some((p) => markerId.startsWith(p));
  const blockedByTerm = CONTEXT_BLOCK_TERMS.some((term) => {
    // Match as whole word or in parentheses to avoid false positives
    // e.g. "urina" matches "(urina)" and "Hemoglobina (urina)" but not "urinase"
    const re = new RegExp(`(\\b${term}\\b|\\(${term}\\))`, "i");
    return re.test(nameLower);
  });

  if (blockedByPrefix || blockedByTerm) {
    const ctxDetail = blockedByPrefix
      ? `prefixo bloqueado: ${markerId}`
      : `termo bloqueado detectado no nome: "${markerName}"`;
    const log = makeLog("none", null, 0, `contexto não-sérico — ${ctxDetail}`, "", false);
    log.context = "não-sérico";
    return { result: null, score: 0, log };
  }

  // ── Step 1: Try exact marker_id match ──
  const byId = FUNC_BY_ID.get(markerId);
  if (byId) {
    const unitCompat = areUnitsCompatible(canonicalUnit, byId.unit);
    const unitEmpty = !canonicalUnit || !byId.unit;
    const score = computeScore("exact_id", unitCompat, unitEmpty);

    if (areUnitsIncompatible(canonicalUnit, byId.unit)) {
      // Units incompatible — try resolveFunctionalRef which has built-in conversion
      const converted = resolveFunctionalRef(markerId, value, sex, canonicalUnit);
      if (converted) {
        const log = makeLog("exact_id", markerId, 100, "match exato por id + conversão de unidade", byId.unit, true);
        return { result: converted, score: 100, log };
      }
      const log = makeLog("exact_id", markerId, score, `unidade incompatível sem conversão: ${canonicalUnit} vs ${byId.unit}`, byId.unit, false);
      return { result: null, score, log };
    }

    if (score >= 85) {
      const result = resolveFunctionalRef(markerId, value, sex, canonicalUnit);
      if (result) {
        const log = makeLog("exact_id", markerId, score, "match exato por marker_id", byId.unit, true);
        return { result, score, log };
      }
    }

    const log = makeLog("exact_id", markerId, score, `match por id mas score insuficiente (${score})`, byId.unit, false);
    return { result: null, score, log };
  }

  // ── Step 2: Try normalized name match ──
  const byName = FUNC_BY_NORMALIZED_NAME.get(normalizedName);
  if (byName) {
    const unitCompat = areUnitsCompatible(canonicalUnit, byName.unit);
    const unitEmpty = !canonicalUnit || !byName.unit;
    const score = computeScore("exact_name", unitCompat, unitEmpty);

    if (areUnitsIncompatible(canonicalUnit, byName.unit)) {
      const converted = resolveFunctionalRef(byName.marker_id, value, sex, canonicalUnit);
      if (converted) {
        const log = makeLog("exact_name", byName.marker_id, 100, `match por nome normalizado "${normalizedName}" + conversão`, byName.unit, true);
        return { result: converted, score: 100, log };
      }
      const log = makeLog("exact_name", byName.marker_id, score, `match por nome mas unidade incompatível: ${canonicalUnit} vs ${byName.unit}`, byName.unit, false);
      return { result: null, score, log };
    }

    if (score >= 85) {
      const result = resolveFunctionalRef(byName.marker_id, value, sex, canonicalUnit);
      if (result) {
        const log = makeLog("exact_name", byName.marker_id, score, `match por nome normalizado "${normalizedName}"`, byName.unit, true);
        return { result, score, log };
      }
    }

    const log = makeLog("exact_name", byName.marker_id, score, `match por nome mas score insuficiente (${score})`, byName.unit, false);
    return { result: null, score, log };
  }

  // ── Step 3: Try alias match ──
  const aliasId = NAME_ALIASES[normalizedName];
  if (aliasId) {
    const byAlias = FUNC_BY_ID.get(aliasId);
    if (byAlias) {
      const unitCompat = areUnitsCompatible(canonicalUnit, byAlias.unit);
      const unitEmpty = !canonicalUnit || !byAlias.unit;
      const score = computeScore("alias", unitCompat, unitEmpty);

      if (areUnitsIncompatible(canonicalUnit, byAlias.unit)) {
        const converted = resolveFunctionalRef(aliasId, value, sex, canonicalUnit);
        if (converted) {
          const log = makeLog("alias", aliasId, 90, `match por alias "${normalizedName}" → ${aliasId} + conversão`, byAlias.unit, true);
          return { result: converted, score: 90, log };
        }
        const log = makeLog("alias", aliasId, score, `alias match mas unidade incompatível: ${canonicalUnit} vs ${byAlias.unit}`, byAlias.unit, false);
        return { result: null, score, log };
      }

      if (score >= 90) {
        const result = resolveFunctionalRef(aliasId, value, sex, canonicalUnit);
        if (result) {
          const log = makeLog("alias", aliasId, score, `match por alias "${normalizedName}" → ${aliasId}`, byAlias.unit, true);
          return { result, score, log };
        }
      }

      const log = makeLog("alias", aliasId, score, `alias match mas score insuficiente (${score})`, byAlias.unit, false);
      return { result: null, score, log };
    }
  }

  // ── Step 4: No match ──
  const log = makeLog("none", null, 0, "sem correspondência funcional", "", false);
  return { result: null, score: 0, log };
}

// ═══════════════════════════════════════════════════════════════════════════
// 10. Batch matching com logs consolidados
// ═══════════════════════════════════════════════════════════════════════════

export interface BatchMatchResult {
  results: Map<string, FunctionalMatchResult>;
  logs: FunctionalMatchLog[];
  summary: {
    total: number;
    filled: number;
    noMatch: number;
    lowScore: number;
    incompatibleUnit: number;
  };
}

/**
 * Run matching for multiple markers and produce consolidated logs.
 * Logs are printed to console in a structured format for debugging.
 */
export function batchMatchFunctionalRefs(
  markers: Array<{
    markerId: string;
    markerName: string;
    value: number | null;
    unit: string;
  }>,
  sex: "M" | "F",
  enableLogs = false,
): BatchMatchResult {
  const results = new Map<string, FunctionalMatchResult>();
  const logs: FunctionalMatchLog[] = [];
  let filled = 0;
  let noMatch = 0;
  let lowScore = 0;
  let incompatibleUnit = 0;

  for (const m of markers) {
    const result = matchFunctionalRef(m.markerId, m.markerName, m.value, sex, m.unit);
    results.set(m.markerId, result);
    logs.push(result.log);

    if (result.log.filled) {
      filled++;
    } else if (result.log.matchType === "none") {
      noMatch++;
    } else if (result.log.reason.includes("incompatível")) {
      incompatibleUnit++;
    } else {
      lowScore++;
    }
  }

  if (enableLogs) {
    console.group("[FunctionalMatcher] Relatório de matching");
    console.log(`Total: ${markers.length} | Preenchidos: ${filled} | Sem match: ${noMatch} | Score baixo: ${lowScore} | Unidade incomp.: ${incompatibleUnit}`);

    for (const log of logs) {
      const icon = log.filled ? "✅" : log.matchType === "none" ? "⬜" : "⚠️";
      console.log(
        `${icon} ${log.originalName} → norm:"${log.normalizedName}" | ` +
        `ctx:${log.context} | type:${log.matchType} | func:${log.matchedFuncId ?? "—"} | ` +
        `score:${log.score} | ${log.reason}`
      );
    }
    console.groupEnd();
  }

  return {
    results,
    logs,
    summary: {
      total: markers.length,
      filled,
      noMatch,
      lowScore,
      incompatibleUnit,
    },
  };
}
