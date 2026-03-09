/**
 * evolutionReportBuilder.ts
 *
 * Busca lab_results + lab_historical_results do banco e monta uma estrutura
 * canônica (EvolutionReportData) para renderização na aba de evolução temporal
 * e futuro PDF evolutivo.
 *
 * Regras de consolidação:
 * 1. current result (lab_results) sempre prevalece sobre histórico se mesmo marker+date.
 * 2. Se houver múltiplos históricos no mesmo marker+date, mantém o com maior raw_value
 *    (determinístico e documentado).
 * 3. Datas ordenadas cronologicamente.
 * 4. Marcadores agrupados por categoria (CATEGORY_CONFIG) e estáveis dentro da categoria.
 * 5. Flags (high/low) são computados para todos os resultados usando labRange.
 * 6. reference_text usa lab_ref_text do banco; se vazio, gera a partir de MARKERS.labRange.
 */

import { supabase } from "@/integrations/supabase/client";
import { MARKERS, type MarkerDef, formatRefDisplay, resolveReference, getMarkerStatusFromRef } from "@/lib/markers";
import { CATEGORIES, type Category } from "@/lib/categoryConfig";

// ── Types ───────────────────────────────────────────────────────────────

export interface EvolutionCellValue {
  value: number | null;
  text_value: string | null;
  flag: string | null;
  source: "current" | "historical";
  source_lab?: string | null;
  source_document?: string | null;
}

export interface EvolutionMarkerRow {
  marker_id: string;
  marker_name: string;
  unit: string;
  reference_text: string | null;
  values_by_date: Record<string, EvolutionCellValue>;
}

export interface EvolutionSection {
  category: Category;
  markers: EvolutionMarkerRow[];
}

export interface EvolutionReportData {
  patient_id: string;
  dates: string[]; // sorted chronologically (YYYY-MM-DD)
  sections: EvolutionSection[];
}

// ── Derived / calculated markers ────────────────────────────────────────
const DERIVED_MARKERS = new Set([
  "glicemia_media_estimada", "vldl", "homa_ir",
  "relacao_ct_hdl", "relacao_tg_hdl", "relacao_apob_apoa1",
  "psa_ratio", "colesterol_nao_hdl",
]);

// ── Helpers ─────────────────────────────────────────────────────────────

/**
 * Compute flag (high/low/null) for a numeric value using resolveReference
 * (same logic as EvolutionTable) for consistency across all views.
 *
 * Uses resolveReference which includes sanity checking against labRange,
 * preventing incorrect flags when lab_ref values are in the wrong scale.
 */
function computeFlag(
  value: number | null,
  marker: MarkerDef | undefined,
  sex: "M" | "F",
  labRefText: string | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  if (!marker) return null;
  if (marker.qualitative) return null;

  const ref = resolveReference(marker, sex, labRefText || undefined);
  const status = getMarkerStatusFromRef(value, ref);
  return status === "normal" ? null : status;
}

/**
 * Build a display-friendly reference text from MARKERS labRange.
 * For derived markers, returns "calculado".
 */
function buildFallbackRef(markerId: string, marker: MarkerDef | undefined): string | null {
  if (DERIVED_MARKERS.has(markerId)) {
    // Still show labRange if it exists and is meaningful
    if (marker) {
      const [min, max] = marker.labRange.F;
      const isSentinel = (v: number) => /^9{3,}$/.test(String(v));
      if (min === 0 && max === 0) return "calculado";
      const ref = formatRefDisplay(
        { min, max, operator: "range" }, min, max
      );
      return ref;
    }
    return "calculado";
  }
  if (!marker) return null;
  const [min, max] = marker.labRange.F;
  if (min === 0 && max === 0) return null; // qualitative
  return formatRefDisplay({ min, max, operator: "range" }, min, max);
}

// ── Builder ─────────────────────────────────────────────────────────────

export async function buildEvolutionReport(patientId: string): Promise<EvolutionReportData> {
  // 1. Fetch patient sex + all sessions in parallel
  const [patientRes, sessionsRes] = await Promise.all([
    supabase.from("patients").select("sex").eq("id", patientId).single(),
    supabase.from("lab_sessions").select("id, session_date").eq("patient_id", patientId),
  ]);

  const patientSex: "M" | "F" = (patientRes.data?.sex === "M" ? "M" : "F");
  const sessions = sessionsRes.data;

  if (!sessions || sessions.length === 0) {
    return { patient_id: patientId, dates: [], sections: [] };
  }

  const sessionIds = sessions.map((s) => s.id);
  const sessionDateMap: Record<string, string> = {};
  sessions.forEach((s) => { sessionDateMap[s.id] = s.session_date; });


  const [currentRes, historicalRes] = await Promise.all([
    supabase.from("lab_results").select("*").in("session_id", sessionIds),
    (supabase as any)
      .from("lab_historical_results")
      .select("*")
      .in("session_id", sessionIds),
  ]);

  const currentResults: any[] = currentRes.data || [];
  const historicalResults: any[] = historicalRes.data || [];

  // 3. Build unified cell map: cellMap[marker_id][date] = EvolutionCellValue
  const cellMap: Record<string, Record<string, EvolutionCellValue>> = {};
  const referenceMap: Record<string, string | null> = {};
  const markerNameMap: Record<string, string> = {};
  const allDates = new Set<string>();

  // Build marker def lookup
  const markerDefMap = new Map<string, MarkerDef>();
  MARKERS.forEach((m) => markerDefMap.set(m.id, m));

  // Helper to ensure marker entry exists
  const ensureMarker = (markerId: string) => {
    if (!cellMap[markerId]) cellMap[markerId] = {};
  };

  // 3a. Insert historical results first (lower priority)
  for (const h of historicalResults) {
    const markerId = h.marker_id;
    const date = h.result_date;
    if (!markerId || !date) continue;

    ensureMarker(markerId);
    allDates.add(date);

    if (h.marker_name) markerNameMap[markerId] = h.marker_name;
    if (h.reference_text && !referenceMap[markerId]) referenceMap[markerId] = h.reference_text;

    const existing = cellMap[markerId][date];
    if (existing && existing.source === "current") continue; // current always wins

    // If duplicate historical on same marker+date, keep the one with larger raw_value
    if (existing && existing.source === "historical") {
      const existingVal = existing.value ?? -Infinity;
      const newVal = h.value ?? -Infinity;
      if (newVal <= existingVal) continue;
    }

    // Recompute flag at display time using resolveReference (consistent with current results)
    const markerDef = markerDefMap.get(markerId);
    const recomputedFlag = computeFlag(h.value ?? null, markerDef, patientSex, h.reference_text || null);

    cellMap[markerId][date] = {
      value: h.value ?? null,
      text_value: h.text_value || null,
      flag: recomputedFlag,
      source: "historical",
      source_lab: h.source_lab || null,
      source_document: h.source_document || null,
    };
  }

  // 3b. Insert current results (higher priority — overwrites historical)
  for (const r of currentResults) {
    const markerId = r.marker_id;
    const sessionDate = sessionDateMap[r.session_id];
    if (!markerId || !sessionDate) continue;

    ensureMarker(markerId);
    allDates.add(sessionDate);

    // Build reference from lab_ref_text
    const labRefText = (r as any).lab_ref_text;
    if (labRefText && !referenceMap[markerId]) referenceMap[markerId] = labRefText;

    // Compute flag using resolveReference (with sanity checking + correct sex)
    // For DERIVED markers, ignore stored lab_ref_text and use labRange directly
    // to stay consistent with the displayed reference (buildFallbackRef uses labRange)
    const markerDef = markerDefMap.get(markerId);
    const flagLabRef = DERIVED_MARKERS.has(markerId) ? undefined : labRefText;
    const flag = computeFlag(
      r.value ?? null,
      markerDef,
      patientSex,
      flagLabRef,
    );

    cellMap[markerId][sessionDate] = {
      value: r.value ?? null,
      text_value: r.text_value || null,
      flag,
      source: "current",
    };
  }

  // 4. Sort dates chronologically
  const sortedDates = Array.from(allDates).sort();

  // 5. Collect all marker_ids that have data
  const activeMarkerIds = Object.keys(cellMap);

  // Group by category
  const sectionMap = new Map<Category, EvolutionMarkerRow[]>();

  for (const markerId of activeMarkerIds) {
    const def = markerDefMap.get(markerId);
    const category = (def?.category as Category) || ("Outros" as any);
    const markerName = def?.name || markerNameMap[markerId] || markerId;
    const unit = def?.unit || "";

    if (!sectionMap.has(category)) sectionMap.set(category, []);

    // Resolve reference text
    // For derived/calculated markers, ALWAYS use fallback to prevent echoed values
    let refText: string | null;
    if (DERIVED_MARKERS.has(markerId)) {
      refText = buildFallbackRef(markerId, def);
    } else {
      refText = referenceMap[markerId] || null;
      if (!refText || refText.trim() === "") {
        refText = buildFallbackRef(markerId, def);
      }
    }

    sectionMap.get(category)!.push({
      marker_id: markerId,
      marker_name: markerName,
      unit,
      reference_text: refText,
      values_by_date: cellMap[markerId],
    });
  }

  // Sort markers within each category stably (by MARKERS order, then alphabetical)
  const markerOrder = new Map<string, number>();
  MARKERS.forEach((m, i) => markerOrder.set(m.id, i));

  for (const markers of sectionMap.values()) {
    markers.sort((a, b) => {
      const oa = markerOrder.get(a.marker_id) ?? 9999;
      const ob = markerOrder.get(b.marker_id) ?? 9999;
      return oa - ob || a.marker_name.localeCompare(b.marker_name);
    });
  }

  // Build sections in CATEGORIES order
  const sections: EvolutionSection[] = [];
  for (const cat of CATEGORIES) {
    const markers = sectionMap.get(cat);
    if (markers && markers.length > 0) {
      sections.push({ category: cat, markers });
    }
  }
  // Add uncategorized markers (from historical that aren't in MARKERS)
  for (const [cat, markers] of sectionMap.entries()) {
    if (!CATEGORIES.includes(cat) && markers.length > 0) {
      sections.push({ category: cat, markers });
    }
  }

  return {
    patient_id: patientId,
    dates: sortedDates,
    sections,
  };
}
