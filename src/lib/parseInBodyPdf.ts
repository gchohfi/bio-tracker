/**
 * parseInBodyPdf.ts
 *
 * Client-side InBody PDF parser using pdfjs-dist.
 * Extracts text → applies regex patterns → returns structured fields.
 */

import * as pdfjsLib from "pdfjs-dist";

// Worker config — use CDN build matching installed version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// ── Result type ──

export interface InBodyParsedData {
  session_date: string | null;
  weight_kg: number | null;
  bmi: number | null;
  skeletal_muscle_kg: number | null;
  body_fat_kg: number | null;
  body_fat_pct: number | null;
  visceral_fat_level: number | null;
  total_body_water_l: number | null;
  ecw_tbw_ratio: number | null;
  bmr_kcal: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  waist_hip_ratio: number | null;
  device_model: string | null;
  notes: string | null;
}

// ── Helpers ──

/** Parse Brazilian/international number: "72,5" → 72.5, "1.234" → 1234 */
function parseNum(s: string): number | null {
  if (!s) return null;
  let c = s.trim().replace(/\s/g, "");
  // BR thousands: 1.234,5
  if (c.includes(",")) {
    c = c.replace(/\./g, "").replace(",", ".");
  } else {
    // pure thousands separator: 1.234 (no decimal)
    if (/^\d{1,3}(\.\d{3})+$/.test(c)) {
      c = c.replace(/\./g, "");
    }
  }
  const v = parseFloat(c);
  return isNaN(v) ? null : v;
}

/** Parse date from DD/MM/YYYY or YYYY-MM-DD patterns */
function parseDate(text: string): string | null {
  // DD/MM/YYYY
  const brMatch = text.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    const d = parseInt(dd), m = parseInt(mm);
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
      return `${yyyy}-${mm}-${dd}`;
    }
  }
  // YYYY-MM-DD
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];
  return null;
}

// ── Field extraction patterns ──
// Each pattern: [regex, capture group index for value]
// Patterns support both PT-BR and EN InBody reports

interface FieldPattern {
  key: keyof InBodyParsedData;
  patterns: RegExp[];
}

const FIELD_PATTERNS: FieldPattern[] = [
  {
    key: "weight_kg",
    patterns: [
      /(?:peso|weight)\s*(?:\(kg\))?\s*[:\s]\s*([\d.,]+)/i,
      /(?:body\s*weight|peso\s*corporal)\s*[:\s]\s*([\d.,]+)/i,
    ],
  },
  {
    key: "bmi",
    patterns: [
      /(?:IMC|BMI)\s*(?:\(kg\/m[²2]\))?\s*[:\s]\s*([\d.,]+)/i,
    ],
  },
  {
    key: "skeletal_muscle_kg",
    patterns: [
      /(?:massa\s*muscular\s*esquel[eé]tica|skeletal\s*muscle\s*mass|SMM)\s*(?:\(kg\))?\s*[:\s]\s*([\d.,]+)/i,
      /(?:m[úu]sculo\s*esquel[eé]tico)\s*[:\s]\s*([\d.,]+)/i,
    ],
  },
  {
    key: "body_fat_kg",
    patterns: [
      /(?:massa\s*de\s*gordura\s*corporal|body\s*fat\s*mass|BFM)\s*(?:\(kg\))?\s*[:\s]\s*([\d.,]+)/i,
      /(?:gordura\s*corporal)\s*(?:\(kg\))?\s*[:\s]\s*([\d.,]+)\s*kg/i,
    ],
  },
  {
    key: "body_fat_pct",
    patterns: [
      /(?:percent(?:ual)?\s*(?:de\s*)?gordura\s*corporal|percent\s*body\s*fat|PBF)\s*(?:\(%\))?\s*[:\s]\s*([\d.,]+)/i,
      /(?:body\s*fat\s*percentage|%\s*gordura)\s*[:\s]\s*([\d.,]+)/i,
      /(?:gordura\s*corporal)\s*(?:\(%\))?\s*[:\s]\s*([\d.,]+)\s*%/i,
    ],
  },
  {
    key: "visceral_fat_level",
    patterns: [
      /(?:gordura\s*visceral|visceral\s*fat\s*(?:level|area|n[ií]vel))\s*[:\s]\s*([\d.,]+)/i,
    ],
  },
  {
    key: "total_body_water_l",
    patterns: [
      /(?:[aá]gua\s*corporal\s*total|total\s*body\s*water|TBW)\s*(?:\((?:L|l|litros?)\))?\s*[:\s]\s*([\d.,]+)/i,
    ],
  },
  {
    key: "ecw_tbw_ratio",
    patterns: [
      /(?:ECW\s*[\/]\s*TBW|raz[aã]o\s*ECW\s*[\/]\s*TBW)\s*[:\s]\s*([\d.,]+)/i,
      /(?:extra\s*cellular\s*water\s*ratio)\s*[:\s]\s*([\d.,]+)/i,
    ],
  },
  {
    key: "bmr_kcal",
    patterns: [
      /(?:TMB|BMR|taxa\s*metab[oó]lica\s*basal|basal\s*metabolic\s*rate)\s*(?:\(kcal\))?\s*[:\s]\s*([\d.,]+)/i,
    ],
  },
  {
    key: "waist_cm",
    patterns: [
      /(?:cintura|waist)\s*(?:\(cm\))?\s*[:\s]\s*([\d.,]+)/i,
      /(?:circunfer[eê]ncia\s*(?:da\s*)?cintura)\s*[:\s]\s*([\d.,]+)/i,
    ],
  },
  {
    key: "hip_cm",
    patterns: [
      /(?:quadril|hip)\s*(?:\(cm\))?\s*[:\s]\s*([\d.,]+)/i,
      /(?:circunfer[eê]ncia\s*(?:do\s*)?quadril)\s*[:\s]\s*([\d.,]+)/i,
    ],
  },
  {
    key: "waist_hip_ratio",
    patterns: [
      /(?:rela[cç][aã]o\s*cintura\s*[\/]\s*quadril|waist[\s\-]*hip\s*ratio|WHR)\s*[:\s]\s*([\d.,]+)/i,
    ],
  },
];

const DEVICE_PATTERNS = [
  /(?:InBody\s*\d+\w*)/i,
  /(?:modelo|model|device)\s*[:\s]\s*([^\n\r]+)/i,
];

const DATE_PATTERNS = [
  /(?:data\s*(?:da\s*)?(?:avalia[cç][aã]o|teste|exame|test)|date\s*(?:of\s*)?(?:test|exam))\s*[:\s]\s*([^\n\r]{8,12})/i,
  /(?:data|date)\s*[:\s]\s*(\d{2}[\/\-]\d{2}[\/\-]\d{4})/i,
];

// ── Main parse function ──

export async function parseInBodyPdf(file: File): Promise<InBodyParsedData> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Extract all text from all pages
  const textParts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => item.str)
      .join(" ");
    textParts.push(pageText);
  }
  const fullText = textParts.join("\n");

  const result: InBodyParsedData = {
    session_date: null,
    weight_kg: null,
    bmi: null,
    skeletal_muscle_kg: null,
    body_fat_kg: null,
    body_fat_pct: null,
    visceral_fat_level: null,
    total_body_water_l: null,
    ecw_tbw_ratio: null,
    bmr_kcal: null,
    waist_cm: null,
    hip_cm: null,
    waist_hip_ratio: null,
    device_model: null,
    notes: null,
  };

  // Extract date
  for (const pat of DATE_PATTERNS) {
    const m = fullText.match(pat);
    if (m) {
      const d = parseDate(m[1] || m[0]);
      if (d) { result.session_date = d; break; }
    }
  }
  // Fallback: any date in the text
  if (!result.session_date) {
    const anyDate = fullText.match(/(\d{2}[\/\-]\d{2}[\/\-]\d{4})/);
    if (anyDate) {
      const d = parseDate(anyDate[1]);
      if (d) result.session_date = d;
    }
  }

  // Extract numeric fields
  for (const fp of FIELD_PATTERNS) {
    for (const pat of fp.patterns) {
      const m = fullText.match(pat);
      if (m && m[1]) {
        const val = parseNum(m[1]);
        if (val !== null) {
          (result as any)[fp.key] = val;
          break;
        }
      }
    }
  }

  // Sanity guards — leave blank if implausible
  if (result.weight_kg !== null && (result.weight_kg < 20 || result.weight_kg > 300)) result.weight_kg = null;
  if (result.bmi !== null && (result.bmi < 10 || result.bmi > 70)) result.bmi = null;
  if (result.body_fat_pct !== null && (result.body_fat_pct < 1 || result.body_fat_pct > 70)) result.body_fat_pct = null;
  if (result.visceral_fat_level !== null && (result.visceral_fat_level < 1 || result.visceral_fat_level > 30)) result.visceral_fat_level = null;
  if (result.ecw_tbw_ratio !== null && (result.ecw_tbw_ratio < 0.2 || result.ecw_tbw_ratio > 0.6)) result.ecw_tbw_ratio = null;
  if (result.bmr_kcal !== null && (result.bmr_kcal < 500 || result.bmr_kcal > 5000)) result.bmr_kcal = null;

  // Extract device model
  for (const pat of DEVICE_PATTERNS) {
    const m = fullText.match(pat);
    if (m) {
      result.device_model = (m[1] || m[0]).trim().slice(0, 60);
      break;
    }
  }

  return result;
}
