import { describe, it, expect } from "vitest";
import { MARKERS } from "@/lib/markers";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("Marker ID synchronization", () => {
  const frontendIds = new Set(MARKERS.map((m) => m.id));

  // IDs that exist only in the edge function for extraction purposes
  // (not rendered in frontend). Currently empty — neutrofilos/linfocitos
  // were promoted to full frontend markers with percentage display.
  const EXTRACTION_ONLY_IDS = new Set<string>([]);

  // Parse MARKER_LIST IDs from edge function source
  const edgeFnPath = resolve(__dirname, "../../supabase/functions/extract-lab-results/constants.ts");
  const edgeFnSource = readFileSync(edgeFnPath, "utf-8");

  // Extract all { id: "xxx" } from MARKER_LIST block
  const markerListMatch = edgeFnSource.match(/const MARKER_LIST\s*=\s*\[([\s\S]*?)\];/);
  if (!markerListMatch) throw new Error("Could not find MARKER_LIST in edge function");

  const edgeIds = new Set<string>();
  const idRegex = /id:\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = idRegex.exec(markerListMatch[1])) !== null) {
    edgeIds.add(match[1]);
  }

  it("edge function should have all frontend marker IDs", () => {
    const missingInEdge = [...frontendIds].filter((id) => !edgeIds.has(id));
    expect(missingInEdge, `Frontend markers missing in edge function: ${missingInEdge.join(", ")}`).toEqual([]);
  });

  it("frontend should have all edge function marker IDs (excluding extraction-only)", () => {
    const missingInFrontend = [...edgeIds].filter((id) => !frontendIds.has(id) && !EXTRACTION_ONLY_IDS.has(id));
    expect(missingInFrontend, `Edge function markers missing in frontend: ${missingInFrontend.join(", ")}`).toEqual([]);
  });

  it("should have the same total count (excluding extraction-only)", () => {
    expect(frontendIds.size).toBe(edgeIds.size - EXTRACTION_ONLY_IDS.size);
  });
});
