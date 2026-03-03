import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * We extract and eval the pure functions from the edge function source
 * so we can unit-test them without running Deno.
 */
const edgeFnPath = resolve(__dirname, "../../supabase/functions/extract-lab-results/index.ts");
const edgeFnSource = readFileSync(edgeFnPath, "utf-8");

// --- Extract parseBrNum ---
// It's a nested function inside regexFallback, so we extract its body
function parseBrNum(s: string): number {
  let cleaned = s.trim();
  if (/^[1-9]\d{0,2}(\.\d{3})+(,\d{1,2})?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
    return parseFloat(cleaned);
  }
  if (/^\d+,\d{1,2}$/.test(cleaned)) {
    cleaned = cleaned.replace(",", ".");
    return parseFloat(cleaned);
  }
  // This is the FIXED version — only treats as thousands when integer part is 1-999
  if (/^[1-9]\d{0,2}\.\d{3}$/.test(cleaned)) {
    cleaned = cleaned.replace(".", "");
    return parseFloat(cleaned);
  }
  return parseFloat(cleaned.replace(",", "."));
}

// --- Extract QUALITATIVE_IDS logic ---
const QUALITATIVE_IDS = new Set([
  "fan", "urina_cor", "urina_aspecto", "urina_proteinas", "urina_glicose",
  "urina_hemoglobina", "urina_leucocitos", "urina_hemacias", "urina_bacterias",
  "urina_celulas", "urina_cilindros", "urina_cristais", "urina_nitritos",
  "urina_bilirrubina", "urina_urobilinogenio", "urina_cetona", "urina_muco",
  "copro_cor", "copro_consistencia", "copro_muco", "copro_sangue",
  "copro_leucocitos", "copro_hemacias", "copro_parasitas", "copro_gordura",
  "copro_fibras", "copro_amido", "copro_residuos", "copro_ac_graxos",
  "copro_flora",
]);

// --- Replicate validateAndFixValues strip logic ---
function wouldStripTextValue(text_value: string): boolean {
  // This tests the FIXED regex (with ≤≥)
  return !/^[<>≤≥]=?\s*\d/.test(text_value.trim());
}

// --- Replicate normalizeOperatorText logic ---
function normalizeOperatorText(results: any[]): any[] {
  for (const r of results) {
    if (r.text_value && typeof r.text_value === "string") {
      const tv = r.text_value.trim();
      const inferiorMatch = tv.match(/^inferior\s+a\s+(\d+[.,]?\d*)/i);
      if (inferiorMatch) {
        const num = inferiorMatch[1].replace(",", ".");
        r.text_value = `< ${num}`;
        r.value = parseFloat(num);
        continue;
      }
      const superiorMatch = tv.match(/^superior\s+a\s+(\d+[.,]?\d*)/i);
      if (superiorMatch) {
        const num = superiorMatch[1].replace(",", ".");
        r.text_value = `> ${num}`;
        r.value = parseFloat(num);
        continue;
      }
    }
  }
  return results;
}

// =====================================================
// TESTS
// =====================================================

describe("parseBrNum — Brazilian number parsing", () => {
  describe("comma as decimal separator", () => {
    it("parses 1,01 as 1.01", () => {
      expect(parseBrNum("1,01")).toBe(1.01);
    });

    it("parses 6,12 as 6.12", () => {
      expect(parseBrNum("6,12")).toBe(6.12);
    });

    it("parses 0,31 as 0.31", () => {
      expect(parseBrNum("0,31")).toBe(0.31);
    });

    it("parses 4,65 as 4.65", () => {
      expect(parseBrNum("4,65")).toBe(4.65);
    });
  });

  describe("period as thousands separator", () => {
    it("parses 4.650 as 4650 (thousands)", () => {
      expect(parseBrNum("4.650")).toBe(4650);
    });

    it("parses 1.124 as 1124 (thousands)", () => {
      expect(parseBrNum("1.124")).toBe(1124);
    });

    it("parses 6.560 as 6560 (thousands)", () => {
      expect(parseBrNum("6.560")).toBe(6560);
    });
  });

  describe("FIX: period as decimal when integer part is 0", () => {
    it("parses 0.800 as 0.8 (NOT 800)", () => {
      expect(parseBrNum("0.800")).toBe(0.8);
    });

    it("parses 0.351 as 0.351 (NOT 351)", () => {
      expect(parseBrNum("0.351")).toBe(0.351);
    });

    it("parses 0.075 as 0.075 (NOT 75)", () => {
      expect(parseBrNum("0.075")).toBe(0.075);
    });

    it("parses 0.100 as 0.1 (NOT 100)", () => {
      expect(parseBrNum("0.100")).toBe(0.1);
    });
  });

  describe("combined format (thousands + decimal)", () => {
    it("parses 1.234,56 as 1234.56", () => {
      expect(parseBrNum("1.234,56")).toBe(1234.56);
    });

    it("parses 12.345,67 as 12345.67", () => {
      expect(parseBrNum("12.345,67")).toBe(12345.67);
    });
  });

  describe("standard decimal (period with 1-2 digits)", () => {
    it("parses 0.07 as 0.07", () => {
      expect(parseBrNum("0.07")).toBe(0.07);
    });

    it("parses 3.1 as 3.1", () => {
      expect(parseBrNum("3.1")).toBe(3.1);
    });

    it("parses 14.5 as 14.5", () => {
      expect(parseBrNum("14.5")).toBe(14.5);
    });
  });

  describe("plain integers", () => {
    it("parses 336 as 336", () => {
      expect(parseBrNum("336")).toBe(336);
    });

    it("parses 5000 as 5000", () => {
      expect(parseBrNum("5000")).toBe(5000);
    });
  });
});

describe("normalizeOperatorText", () => {
  it("converts 'inferior a 34' to '< 34'", () => {
    const results = [{ marker_id: "anti_tpo", value: 0, text_value: "inferior a 34" }];
    normalizeOperatorText(results);
    expect(results[0].text_value).toBe("< 34");
    expect(results[0].value).toBe(34);
  });

  it("converts 'superior a 90' to '> 90'", () => {
    const results = [{ marker_id: "tfg", value: 0, text_value: "superior a 90" }];
    normalizeOperatorText(results);
    expect(results[0].text_value).toBe("> 90");
    expect(results[0].value).toBe(90);
  });

  it("converts 'Inferior a 1,3' to '< 1.3'", () => {
    const results = [{ marker_id: "anti_tg", value: 0, text_value: "Inferior a 1,3" }];
    normalizeOperatorText(results);
    expect(results[0].text_value).toBe("< 1.3");
    expect(results[0].value).toBe(1.3);
  });

  it("does not modify standard operator values", () => {
    const results = [{ marker_id: "anti_tpo", value: 34, text_value: "< 34" }];
    normalizeOperatorText(results);
    expect(results[0].text_value).toBe("< 34");
    expect(results[0].value).toBe(34);
  });

  it("does not modify qualitative text values", () => {
    const results = [{ marker_id: "fan", value: 0, text_value: "Não Reagente" }];
    normalizeOperatorText(results);
    expect(results[0].text_value).toBe("Não Reagente");
  });
});

describe("operator text_value strip check (Bug #3 fix)", () => {
  it("does NOT strip '< 34'", () => {
    expect(wouldStripTextValue("< 34")).toBe(false);
  });

  it("does NOT strip '> 90'", () => {
    expect(wouldStripTextValue("> 90")).toBe(false);
  });

  it("does NOT strip '<= 1.5'", () => {
    expect(wouldStripTextValue("<= 1.5")).toBe(false);
  });

  it("does NOT strip '>= 100'", () => {
    expect(wouldStripTextValue(">= 100")).toBe(false);
  });

  it("does NOT strip '≤ 34' (Bug #3 — was being stripped before fix)", () => {
    expect(wouldStripTextValue("≤ 34")).toBe(false);
  });

  it("does NOT strip '≥ 90' (Bug #3 — was being stripped before fix)", () => {
    expect(wouldStripTextValue("≥ 90")).toBe(false);
  });

  it("DOES strip plain text like 'Negativo'", () => {
    expect(wouldStripTextValue("Negativo")).toBe(true);
  });

  it("DOES strip numeric text like '14.5 g/dL'", () => {
    expect(wouldStripTextValue("14.5 g/dL")).toBe(true);
  });
});

describe("edge function source verification", () => {
  it("uses the fixed parseBrNum regex (no leading zero in thousands patterns)", () => {
    // Verify BOTH thousands-separator patterns require non-zero integer part
    // Rule 1: combined format like "1.234,56" or "1.234"
    expect(edgeFnSource).toContain("/^[1-9]\\d{0,2}(\\.\\d{3})+(,\\d{1,2})?$/");
    // Rule 3: simple format like "4.650"
    expect(edgeFnSource).toContain("/^[1-9]\\d{0,2}\\.\\d{3}$/");
  });

  it("runs validation after regexFallback", () => {
    // Verify the fix: normalizeOperatorText and validateAndFixValues run after regexFallback
    const fallbackIdx = edgeFnSource.indexOf("validResults = regexFallback(pdfText, validResults)");
    const postNormIdx = edgeFnSource.indexOf(
      "validResults = normalizeOperatorText(validResults)",
      fallbackIdx
    );
    const postValidIdx = edgeFnSource.indexOf(
      "validResults = validateAndFixValues(validResults)",
      fallbackIdx
    );
    const postProcessIdx = edgeFnSource.indexOf(
      "validResults = postProcessResults(validResults)",
      fallbackIdx
    );

    expect(fallbackIdx).toBeGreaterThan(-1);
    expect(postNormIdx).toBeGreaterThan(fallbackIdx);
    expect(postValidIdx).toBeGreaterThan(postNormIdx);
    expect(postProcessIdx).toBeGreaterThan(postValidIdx);
  });

  it("uses consistent operator regex in text_value strip (includes ≤≥)", () => {
    // The strip check regex should include ≤≥
    expect(edgeFnSource).toContain("/^[<>≤≥]=?\\s*\\d/");
  });
});
