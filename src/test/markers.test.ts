import { describe, it, expect } from "vitest";
import { getMarkerStatus, parseOperatorValue, MARKERS } from "@/lib/markers";

// Helper to find a marker by ID
const marker = (id: string) => MARKERS.find((m) => m.id === id)!;

describe("parseOperatorValue", () => {
  it("parses < operator", () => {
    expect(parseOperatorValue("< 34")).toEqual({ operator: "<", numericValue: 34 });
  });

  it("parses > operator", () => {
    expect(parseOperatorValue("> 90")).toEqual({ operator: ">", numericValue: 90 });
  });

  it("parses <= operator", () => {
    expect(parseOperatorValue("<= 1.5")).toEqual({ operator: "<=", numericValue: 1.5 });
  });

  it("parses >= operator", () => {
    expect(parseOperatorValue(">= 100")).toEqual({ operator: ">=", numericValue: 100 });
  });

  it("parses ≤ operator", () => {
    expect(parseOperatorValue("≤ 34")).toEqual({ operator: "≤", numericValue: 34 });
  });

  it("parses ≥ operator", () => {
    expect(parseOperatorValue("≥ 90")).toEqual({ operator: "≥", numericValue: 90 });
  });

  it("parses Brazilian decimal format with comma", () => {
    expect(parseOperatorValue("< 1,3")).toEqual({ operator: "<", numericValue: 1.3 });
  });

  it("returns null for plain numbers", () => {
    expect(parseOperatorValue("34")).toBeNull();
  });

  it("returns null for text", () => {
    expect(parseOperatorValue("Negativo")).toBeNull();
  });
});

describe("getMarkerStatus", () => {
  describe("without operator", () => {
    it("returns normal when value is within range", () => {
      expect(getMarkerStatus(14.5, marker("hemoglobina"), "M")).toBe("normal");
    });

    it("returns low when value is below range", () => {
      expect(getMarkerStatus(12.0, marker("hemoglobina"), "M")).toBe("low");
    });

    it("returns high when value is above range", () => {
      expect(getMarkerStatus(17.0, marker("hemoglobina"), "M")).toBe("high");
    });

    it("uses sex-specific ranges (female)", () => {
      // Female hemoglobin range: 13.0-14.5
      expect(getMarkerStatus(13.5, marker("hemoglobina"), "F")).toBe("normal");
      expect(getMarkerStatus(12.0, marker("hemoglobina"), "F")).toBe("low");
    });

    it("returns normal at exact boundary (min)", () => {
      // Male hemoglobin range: 14.0-15.5
      expect(getMarkerStatus(14.0, marker("hemoglobina"), "M")).toBe("normal");
    });

    it("returns normal at exact boundary (max)", () => {
      expect(getMarkerStatus(15.5, marker("hemoglobina"), "M")).toBe("normal");
    });
  });

  describe("with < operator", () => {
    it("returns normal when value <= upper limit", () => {
      // Anti-TPO ref: 0-15, value "< 34" means real value is somewhere 0-34
      // Since 34 > 15, but we can't know the real value, default to normal
      expect(getMarkerStatus(34, marker("anti_tpo"), "M", "<")).toBe("normal");
    });

    it("returns normal for typical below-detection results", () => {
      // TRAb ref: 0-1.75, "< 1.0" → real value is 0-1.0, within range
      expect(getMarkerStatus(1.0, marker("trab"), "M", "<")).toBe("normal");
    });
  });

  describe("with <= operator", () => {
    it("returns normal (same as <)", () => {
      expect(getMarkerStatus(34, marker("anti_tpo"), "M", "<=")).toBe("normal");
    });
  });

  describe("with ≤ operator", () => {
    it("returns normal (same as <)", () => {
      expect(getMarkerStatus(34, marker("anti_tpo"), "M", "≤")).toBe("normal");
    });
  });

  describe("with > operator", () => {
    it("returns high when value >= lower limit", () => {
      // If value is "> 90" and min is some value, real value is above 90
      expect(getMarkerStatus(90, marker("glicose_jejum"), "M", ">")).toBe("high");
    });

    it("returns normal when value < lower limit", () => {
      // Glicose range: 75-86. "> 50" means real value is >50, could be in range
      expect(getMarkerStatus(50, marker("glicose_jejum"), "M", ">")).toBe("normal");
    });
  });

  describe("with >= operator", () => {
    it("returns high when value >= lower limit", () => {
      expect(getMarkerStatus(90, marker("glicose_jejum"), "M", ">=")).toBe("high");
    });
  });

  describe("with ≥ operator", () => {
    it("returns high when value >= lower limit", () => {
      expect(getMarkerStatus(90, marker("glicose_jejum"), "M", "≥")).toBe("high");
    });
  });
});
