/**
 * goldenCases.fixtures.ts
 *
 * Fixtures de regressão baseadas em casos reais validados manualmente.
 * Cada fixture documenta: valor no laudo-fonte, unidade fonte, valor persistido
 * esperado, unidade canônica e referência esperada.
 *
 * NUNCA altere estes valores sem validação clínica manual.
 */

export interface GoldenCase {
  /** ID do paciente (nome para documentação, não usado no teste) */
  patient: string;
  marker_id: string;
  /** Data do laudo-fonte */
  source_date: string;
  /** Valor original do laudo-fonte */
  source_value: number;
  /** Unidade do laudo-fonte */
  source_unit: string;
  /** Valor esperado após conversão/normalização (persistido) */
  expected_value: number;
  /** Unidade canônica do sistema */
  expected_unit: string;
  /** Referência esperada no PDF (string formatada) */
  expected_ref_display: string;
  /** Sexo do paciente */
  sex: "M" | "F";
  /** Notas sobre a conversão aplicada */
  conversion_note: string;
}

// ── Barbara Pozitel ─────────────────────────────────────────────────────

export const BARBARA_CASES: GoldenCase[] = [
  {
    patient: "Barbara Pozitel",
    marker_id: "progesterona",
    source_date: "2025-11-10",
    source_value: 19,
    source_unit: "ng/dL",
    expected_value: 0.19,
    expected_unit: "ng/mL",
    expected_ref_display: "0.1–25",
    sex: "F",
    conversion_note: "Laudo manda dividir por 100 (ng/dL → ng/mL). 19 / 100 = 0.19",
  },
  {
    patient: "Barbara Pozitel",
    marker_id: "progesterona",
    source_date: "2026-02-07",
    source_value: 101,
    source_unit: "ng/dL",
    expected_value: 1.01,
    expected_unit: "ng/mL",
    expected_ref_display: "0.1–25",
    sex: "F",
    conversion_note: "Laudo manda dividir por 100 (ng/dL → ng/mL). 101 / 100 = 1.01",
  },
  {
    patient: "Barbara Pozitel",
    marker_id: "dihidrotestosterona",
    source_date: "2025-11-10",
    source_value: 7,
    source_unit: "ng/dL",
    expected_value: 7,
    expected_unit: "ng/dL",
    expected_ref_display: "5–46",
    sex: "F",
    conversion_note: "Sem conversão. Unidade fonte = unidade canônica (ng/dL).",
  },
  {
    patient: "Barbara Pozitel",
    marker_id: "dihidrotestosterona",
    source_date: "2026-02-07",
    source_value: 13,
    source_unit: "ng/dL",
    expected_value: 13,
    expected_unit: "ng/dL",
    expected_ref_display: "5–46",
    sex: "F",
    conversion_note: "Sem conversão. Unidade fonte = unidade canônica (ng/dL).",
  },
  {
    patient: "Barbara Pozitel",
    marker_id: "pcr",
    source_date: "2025-11-10",
    source_value: 0.07,
    source_unit: "mg/dL",
    expected_value: 0.7,
    expected_unit: "mg/L",
    expected_ref_display: "< 3",
    sex: "F",
    conversion_note: "mg/dL × 10 = mg/L. 0.07 × 10 = 0.7",
  },
  {
    patient: "Barbara Pozitel",
    marker_id: "pcr",
    source_date: "2026-02-07",
    source_value: 0.07,
    source_unit: "mg/dL",
    expected_value: 0.7,
    expected_unit: "mg/L",
    expected_ref_display: "< 3",
    sex: "F",
    conversion_note: "mg/dL × 10 = mg/L. 0.07 × 10 = 0.7",
  },
  {
    patient: "Barbara Pozitel",
    marker_id: "estradiol",
    source_date: "2025-11-10",
    source_value: 4.4,
    source_unit: "ng/dL",
    expected_value: 44,
    expected_unit: "pg/mL",
    expected_ref_display: "12–499",
    sex: "F",
    conversion_note: "ng/dL × 10 = pg/mL. 4.4 × 10 = 44",
  },
  {
    patient: "Barbara Pozitel",
    marker_id: "testosterona_livre",
    source_date: "2025-11-10",
    source_value: 0.26,
    source_unit: "ng/dL",
    expected_value: 0.26,
    expected_unit: "ng/dL",
    expected_ref_display: "0.1–0.85",
    sex: "F",
    conversion_note: "Sem conversão. Unidade fonte = unidade canônica.",
  },
  {
    patient: "Barbara Pozitel",
    marker_id: "t3_livre",
    source_date: "2025-11-10",
    source_value: 0.31,
    source_unit: "ng/dL",
    expected_value: 3.1,
    expected_unit: "pg/mL",
    expected_ref_display: "2.3–4.2",
    sex: "F",
    conversion_note: "ng/dL × 10 = pg/mL. 0.31 × 10 = 3.1",
  },
];

// ── Dener ────────────────────────────────────────────────────────────────

export const DENER_CASES: GoldenCase[] = [
  {
    patient: "Dener",
    marker_id: "t3_livre",
    source_date: "2025-10-15",
    source_value: 0.32,
    source_unit: "ng/dL",
    expected_value: 3.2,
    expected_unit: "pg/mL",
    expected_ref_display: "2.3–4.2",
    sex: "M",
    conversion_note: "ng/dL × 10 = pg/mL. 0.32 × 10 = 3.2",
  },
];

// ── Gustavo ──────────────────────────────────────────────────────────────

export const GUSTAVO_CASES: GoldenCase[] = [
  {
    patient: "Gustavo",
    marker_id: "t3_livre",
    source_date: "2025-09-20",
    source_value: 0.29,
    source_unit: "ng/dL",
    expected_value: 2.9,
    expected_unit: "pg/mL",
    expected_ref_display: "2.3–4.2",
    sex: "M",
    conversion_note: "ng/dL × 10 = pg/mL. 0.29 × 10 = 2.9",
  },
];

// ── Marcela ──────────────────────────────────────────────────────────────

export const MARCELA_CASES: GoldenCase[] = [
  {
    patient: "Marcela",
    marker_id: "t3_livre",
    source_date: "2025-11-01",
    source_value: 0.27,
    source_unit: "ng/dL",
    expected_value: 2.7,
    expected_unit: "pg/mL",
    expected_ref_display: "2.3–4.2",
    sex: "F",
    conversion_note: "ng/dL × 10 = pg/mL. 0.27 × 10 = 2.7",
  },
  {
    patient: "Marcela",
    marker_id: "progesterona",
    source_date: "2025-11-01",
    source_value: 150,
    source_unit: "ng/dL",
    expected_value: 1.5,
    expected_unit: "ng/mL",
    expected_ref_display: "0.1–25",
    sex: "F",
    conversion_note: "ng/dL ÷ 100 = ng/mL. 150 / 100 = 1.5",
  },
];

// ── Todos os golden cases ────────────────────────────────────────────────

export const ALL_GOLDEN_CASES: GoldenCase[] = [
  ...BARBARA_CASES,
  ...DENER_CASES,
  ...GUSTAVO_CASES,
  ...MARCELA_CASES,
];
