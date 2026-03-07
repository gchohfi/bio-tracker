/**
 * analysisV2Hash.ts
 *
 * Computes a deterministic hash of analysis_v2_data item IDs.
 * Used to detect when a re-generated analysis has different items,
 * making a previously saved review_state stale.
 *
 * Strategy: sort all item IDs → join → SHA-256 (via SubtleCrypto).
 * Fallback: simple string hash for environments without SubtleCrypto.
 */

import type { AnalysisV2Data } from "@/components/ClinicalReportV2";

/** Current schema version for review state */
export const REVIEW_SCHEMA_VERSION = 1;

/**
 * Extracts all reviewable item IDs from an AnalysisV2Data payload,
 * sorted deterministically.
 */
function extractSortedIds(data: AnalysisV2Data): string[] {
  const ids = [
    ...data.red_flags.map((f) => f.id),
    ...data.clinical_findings.map((f) => f.id),
    ...data.diagnostic_hypotheses.map((h) => h.id),
    ...data.suggested_actions.map((a) => a.id),
  ];
  return ids.sort();
}

/**
 * Simple djb2-based string hash (sync fallback).
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

/**
 * Computes a hash string from the analysis V2 item IDs.
 * Uses SubtleCrypto SHA-256 when available, djb2 as fallback.
 */
export async function computeAnalysisV2Hash(data: AnalysisV2Data): Promise<string> {
  const ids = extractSortedIds(data);
  const payload = ids.join("|");

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const encoder = new TextEncoder();
    const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(payload));
    const array = Array.from(new Uint8Array(buffer));
    return array.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  }

  return djb2Hash(payload);
}

/**
 * Synchronous hash (djb2) for cases where async is inconvenient.
 */
export function computeAnalysisV2HashSync(data: AnalysisV2Data): string {
  const ids = extractSortedIds(data);
  return djb2Hash(ids.join("|"));
}
