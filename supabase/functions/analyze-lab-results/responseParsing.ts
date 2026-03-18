/**
 * responseParsing.ts
 *
 * Robust fallback parsing for truncated/malformed JSON from the LLM.
 */

import type { AnalysisResponse } from "./types.ts";

export function extractPartialAnalysis(raw: string): AnalysisResponse {
  const result: AnalysisResponse = {
    summary: "",
    patterns: [],
    trends: [],
    suggestions: [],
    full_text: raw,
    protocol_recommendations: [],
  };

  const fixedJson = tryFixTruncatedJson(raw);
  if (fixedJson) {
    try {
      const parsed = JSON.parse(fixedJson);
      return {
        summary: parsed.summary ?? "",
        patterns: parsed.patterns ?? [],
        trends: parsed.trends ?? [],
        suggestions: parsed.suggestions ?? [],
        full_text: parsed.full_text ?? raw,
        technical_analysis: parsed.technical_analysis,
        patient_plan: parsed.patient_plan,
        prescription_table: parsed.prescription_table,
        protocol_recommendations: parsed.protocol_recommendations ?? [],
      };
    } catch { /* fall through to regex extraction */ }
  }

  const extractString = (key: string): string | undefined => {
    const regex = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`, "s");
    const match = raw.match(regex);
    return match?.[1]?.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  };

  const extractArray = (key: string): string[] => {
    const regex = new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)`, "s");
    const match = raw.match(regex);
    if (!match) return [];
    try {
      return JSON.parse(`[${match[1]}]`);
    } catch {
      const items: string[] = [];
      const strRegex = /"((?:[^"\\]|\\.)*)"/g;
      let m;
      while ((m = strRegex.exec(match[1])) !== null) items.push(m[1]);
      return items;
    }
  };

  const extractObjectArray = (key: string): any[] => {
    const regex = new RegExp(`"${key}"\\s*:\\s*\\[`, "s");
    const match = regex.exec(raw);
    if (!match) return [];
    let depth = 0;
    let start = match.index + match[0].length - 1;
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === "[") depth++;
      else if (raw[i] === "]") { depth--; if (depth === 0) { try { return JSON.parse(raw.slice(start, i + 1)); } catch { return []; } } }
    }
    return [];
  };

  result.summary = extractString("summary") ?? raw.slice(0, 300);
  result.technical_analysis = extractString("technical_analysis");
  result.patient_plan = extractString("patient_plan");
  result.prescription_table = extractObjectArray("prescription_table");
  result.patterns = extractArray("patterns");
  result.trends = extractArray("trends");
  result.suggestions = extractArray("suggestions");

  console.log(
    `Partial extraction: summary=${!!result.summary} technical=${!!result.technical_analysis} ` +
    `plan=${!!result.patient_plan} prescription=${(result.prescription_table ?? []).length} patterns=${result.patterns.length}`
  );

  return result;
}

export function tryFixTruncatedJson(raw: string): string | null {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
  }
  if (!s.startsWith("{")) return null;

  let braces = 0, brackets = 0, inString = false, escaped = false;
  for (const ch of s) {
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") braces++;
    if (ch === "}") braces--;
    if (ch === "[") brackets++;
    if (ch === "]") brackets--;
  }

  if (inString) s += '"';
  while (brackets > 0) { s += "]"; brackets--; }
  while (braces > 0) { s += "}"; braces--; }

  return s;
}
