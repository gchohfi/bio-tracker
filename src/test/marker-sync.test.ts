import { describe, it, expect } from "vitest";
import { MARKERS } from "@/lib/markers";
import fs from "fs";
import path from "path";

describe("Marker ID synchronization", () => {
  const frontendIds = new Set(MARKERS.map((m) => m.id));

  // Parse MARKER_LIST IDs from edge function source
  const edgeFnPath = path.resolve(__dirname, "../../supabase/functions/extract-lab-results/index.ts");
  const edgeFnSource = fs.readFileSync(edgeFnPath, "utf-8");

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

  it("frontend should have all edge function marker IDs", () => {
    const missingInFrontend = [...edgeIds].filter((id) => !frontendIds.has(id));
    expect(missingInFrontend, `Edge function markers missing in frontend: ${missingInFrontend.join(", ")}`).toEqual([]);
  });

  it("should have the same total count", () => {
    expect(frontendIds.size).toBe(edgeIds.size);
  });
});
