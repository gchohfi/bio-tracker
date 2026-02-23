export interface MarkerDef {
  id: string;
  name: string;
  unit: string;
  category: string;
  refRange: { M: [number, number]; F: [number, number] };
}

export const CATEGORIES = [
  "Hemograma",
  "Ferro",
  "Glicemia",
  "Lipídios",
  "Tireoide",
  "Hormônios",
  "Vitaminas",
  "Minerais",
  "Hepático",
  "Renal",
  "Eletrólitos",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<Category, string> = {
  Hemograma: "220 70% 55%",
  Ferro: "30 80% 50%",
  Glicemia: "280 60% 55%",
  Lipídios: "340 70% 55%",
  Tireoide: "170 60% 40%",
  Hormônios: "300 50% 50%",
  Vitaminas: "45 90% 50%",
  Minerais: "190 60% 45%",
  Hepático: "140 50% 40%",
  Renal: "200 50% 50%",
  Eletrólitos: "10 70% 55%",
};

// Functional medicine reference ranges (sex-specific)
export const MARKERS: MarkerDef[] = [
  // Hemograma
  { id: "hemoglobina", name: "Hemoglobina", unit: "g/dL", category: "Hemograma", refRange: { M: [14.0, 15.5], F: [13.0, 14.5] } },
  { id: "hematocrito", name: "Hematócrito", unit: "%", category: "Hemograma", refRange: { M: [42, 48], F: [38, 44] } },
  { id: "eritrocitos", name: "Eritrócitos", unit: "milhões/µL", category: "Hemograma", refRange: { M: [4.5, 5.5], F: [4.0, 5.0] } },
  { id: "vcm", name: "VCM", unit: "fL", category: "Hemograma", refRange: { M: [82, 95], F: [82, 95] } },
  { id: "hcm", name: "HCM", unit: "pg", category: "Hemograma", refRange: { M: [28, 32], F: [28, 32] } },
  { id: "chcm", name: "CHCM", unit: "g/dL", category: "Hemograma", refRange: { M: [32, 36], F: [32, 36] } },
  { id: "rdw", name: "RDW", unit: "%", category: "Hemograma", refRange: { M: [11.5, 13.0], F: [11.5, 13.0] } },
  { id: "leucocitos", name: "Leucócitos", unit: "/µL", category: "Hemograma", refRange: { M: [5000, 8000], F: [5000, 8000] } },
  { id: "neutrofilos", name: "Neutrófilos", unit: "%", category: "Hemograma", refRange: { M: [40, 60], F: [40, 60] } },
  { id: "linfocitos", name: "Linfócitos", unit: "%", category: "Hemograma", refRange: { M: [25, 40], F: [25, 40] } },
  { id: "monocitos", name: "Monócitos", unit: "%", category: "Hemograma", refRange: { M: [4, 8], F: [4, 8] } },
  { id: "eosinofilos", name: "Eosinófilos", unit: "%", category: "Hemograma", refRange: { M: [1, 3], F: [1, 3] } },
  { id: "basofilos", name: "Basófilos", unit: "%", category: "Hemograma", refRange: { M: [0, 1], F: [0, 1] } },
  { id: "plaquetas", name: "Plaquetas", unit: "mil/µL", category: "Hemograma", refRange: { M: [200, 300], F: [200, 300] } },
  // Ferro
  { id: "ferro_serico", name: "Ferro Sérico", unit: "µg/dL", category: "Ferro", refRange: { M: [85, 130], F: [75, 120] } },
  { id: "ferritina", name: "Ferritina", unit: "ng/mL", category: "Ferro", refRange: { M: [50, 150], F: [40, 100] } },
  { id: "transferrina", name: "Transferrina", unit: "mg/dL", category: "Ferro", refRange: { M: [200, 360], F: [200, 360] } },
  { id: "sat_transferrina", name: "Sat. Transferrina", unit: "%", category: "Ferro", refRange: { M: [25, 45], F: [25, 45] } },
  { id: "tibc", name: "TIBC", unit: "µg/dL", category: "Ferro", refRange: { M: [250, 370], F: [250, 370] } },
  // Glicemia
  { id: "glicose_jejum", name: "Glicose Jejum", unit: "mg/dL", category: "Glicemia", refRange: { M: [75, 86], F: [75, 86] } },
  { id: "hba1c", name: "HbA1c", unit: "%", category: "Glicemia", refRange: { M: [4.5, 5.3], F: [4.5, 5.3] } },
  { id: "insulina_jejum", name: "Insulina Jejum", unit: "µU/mL", category: "Glicemia", refRange: { M: [2.0, 5.0], F: [2.0, 5.0] } },
  { id: "homa_ir", name: "HOMA-IR", unit: "", category: "Glicemia", refRange: { M: [0.5, 1.5], F: [0.5, 1.5] } },
  // Lipídios
  { id: "colesterol_total", name: "Colesterol Total", unit: "mg/dL", category: "Lipídios", refRange: { M: [150, 200], F: [150, 200] } },
  { id: "hdl", name: "HDL", unit: "mg/dL", category: "Lipídios", refRange: { M: [55, 100], F: [60, 100] } },
  { id: "ldl", name: "LDL", unit: "mg/dL", category: "Lipídios", refRange: { M: [0, 100], F: [0, 100] } },
  { id: "vldl", name: "VLDL", unit: "mg/dL", category: "Lipídios", refRange: { M: [5, 20], F: [5, 20] } },
  { id: "triglicerides", name: "Triglicerídeos", unit: "mg/dL", category: "Lipídios", refRange: { M: [50, 100], F: [50, 100] } },
  { id: "relacao_ct_hdl", name: "CT/HDL", unit: "", category: "Lipídios", refRange: { M: [0, 3.5], F: [0, 3.5] } },
  { id: "relacao_tg_hdl", name: "TG/HDL", unit: "", category: "Lipídios", refRange: { M: [0, 2.0], F: [0, 2.0] } },
  // Tireoide
  { id: "tsh", name: "TSH", unit: "mUI/L", category: "Tireoide", refRange: { M: [1.0, 2.0], F: [1.0, 2.0] } },
  { id: "t4_livre", name: "T4 Livre", unit: "ng/dL", category: "Tireoide", refRange: { M: [1.0, 1.5], F: [1.0, 1.5] } },
  { id: "t3_livre", name: "T3 Livre", unit: "pg/mL", category: "Tireoide", refRange: { M: [3.0, 4.0], F: [3.0, 4.0] } },
  { id: "t3_reverso", name: "T3 Reverso", unit: "ng/dL", category: "Tireoide", refRange: { M: [10, 20], F: [10, 20] } },
  { id: "anti_tpo", name: "Anti-TPO", unit: "UI/mL", category: "Tireoide", refRange: { M: [0, 15], F: [0, 15] } },
  { id: "anti_tg", name: "Anti-TG", unit: "UI/mL", category: "Tireoide", refRange: { M: [0, 20], F: [0, 20] } },
  // Hormônios
  { id: "testosterona_total", name: "Testosterona Total", unit: "ng/dL", category: "Hormônios", refRange: { M: [500, 900], F: [15, 70] } },
  { id: "testosterona_livre", name: "Testosterona Livre", unit: "pg/mL", category: "Hormônios", refRange: { M: [15, 25], F: [1.0, 5.0] } },
  { id: "estradiol", name: "Estradiol", unit: "pg/mL", category: "Hormônios", refRange: { M: [20, 40], F: [50, 200] } },
  { id: "progesterona", name: "Progesterona", unit: "ng/mL", category: "Hormônios", refRange: { M: [0.2, 1.4], F: [5.0, 20.0] } },
  { id: "dhea_s", name: "DHEA-S", unit: "µg/dL", category: "Hormônios", refRange: { M: [200, 450], F: [150, 350] } },
  { id: "cortisol", name: "Cortisol (manhã)", unit: "µg/dL", category: "Hormônios", refRange: { M: [10, 18], F: [10, 18] } },
  { id: "shbg", name: "SHBG", unit: "nmol/L", category: "Hormônios", refRange: { M: [20, 50], F: [40, 120] } },
  { id: "fsh", name: "FSH", unit: "mUI/mL", category: "Hormônios", refRange: { M: [1.5, 12.4], F: [3.5, 12.5] } },
  { id: "lh", name: "LH", unit: "mUI/mL", category: "Hormônios", refRange: { M: [1.7, 8.6], F: [2.4, 12.6] } },
  { id: "prolactina", name: "Prolactina", unit: "ng/mL", category: "Hormônios", refRange: { M: [4.0, 15.2], F: [4.8, 23.3] } },
  // Vitaminas
  { id: "vitamina_d", name: "Vitamina D (25-OH)", unit: "ng/mL", category: "Vitaminas", refRange: { M: [50, 80], F: [50, 80] } },
  { id: "vitamina_b12", name: "Vitamina B12", unit: "pg/mL", category: "Vitaminas", refRange: { M: [500, 1000], F: [500, 1000] } },
  { id: "acido_folico", name: "Ácido Fólico", unit: "ng/mL", category: "Vitaminas", refRange: { M: [10, 25], F: [10, 25] } },
  { id: "vitamina_a", name: "Vitamina A", unit: "µg/dL", category: "Vitaminas", refRange: { M: [40, 80], F: [40, 80] } },
  { id: "vitamina_e", name: "Vitamina E", unit: "mg/L", category: "Vitaminas", refRange: { M: [8, 15], F: [8, 15] } },
  { id: "vitamina_c", name: "Vitamina C", unit: "mg/dL", category: "Vitaminas", refRange: { M: [0.6, 2.0], F: [0.6, 2.0] } },
  { id: "vitamina_b6", name: "Vitamina B6", unit: "ng/mL", category: "Vitaminas", refRange: { M: [5, 30], F: [5, 30] } },
  { id: "vitamina_b1", name: "Vitamina B1", unit: "µg/dL", category: "Vitaminas", refRange: { M: [2.5, 7.5], F: [2.5, 7.5] } },
  // Minerais
  { id: "magnesio", name: "Magnésio", unit: "mg/dL", category: "Minerais", refRange: { M: [2.0, 2.5], F: [2.0, 2.5] } },
  { id: "zinco", name: "Zinco", unit: "µg/dL", category: "Minerais", refRange: { M: [80, 120], F: [75, 110] } },
  { id: "selenio", name: "Selênio", unit: "µg/L", category: "Minerais", refRange: { M: [110, 160], F: [110, 160] } },
  { id: "cobre", name: "Cobre", unit: "µg/dL", category: "Minerais", refRange: { M: [70, 140], F: [80, 155] } },
  { id: "manganes", name: "Manganês", unit: "µg/L", category: "Minerais", refRange: { M: [4.7, 18.3], F: [4.7, 18.3] } },
  { id: "cromo", name: "Cromo", unit: "µg/L", category: "Minerais", refRange: { M: [0.5, 2.0], F: [0.5, 2.0] } },
  { id: "iodo_urinario", name: "Iodo Urinário", unit: "µg/L", category: "Minerais", refRange: { M: [100, 300], F: [100, 300] } },
  // Hepático
  { id: "tgo_ast", name: "TGO (AST)", unit: "U/L", category: "Hepático", refRange: { M: [10, 26], F: [10, 25] } },
  { id: "tgp_alt", name: "TGP (ALT)", unit: "U/L", category: "Hepático", refRange: { M: [10, 26], F: [10, 25] } },
  { id: "ggt", name: "GGT", unit: "U/L", category: "Hepático", refRange: { M: [10, 30], F: [7, 25] } },
  { id: "fosfatase_alcalina", name: "Fosfatase Alcalina", unit: "U/L", category: "Hepático", refRange: { M: [35, 85], F: [35, 85] } },
  { id: "bilirrubina_total", name: "Bilirrubina Total", unit: "mg/dL", category: "Hepático", refRange: { M: [0.2, 1.0], F: [0.2, 1.0] } },
  { id: "bilirrubina_direta", name: "Bilirrubina Direta", unit: "mg/dL", category: "Hepático", refRange: { M: [0.0, 0.3], F: [0.0, 0.3] } },
  { id: "albumina", name: "Albumina", unit: "g/dL", category: "Hepático", refRange: { M: [4.0, 5.0], F: [4.0, 5.0] } },
  { id: "proteinas_totais", name: "Proteínas Totais", unit: "g/dL", category: "Hepático", refRange: { M: [6.5, 7.5], F: [6.5, 7.5] } },
  { id: "ldh", name: "LDH", unit: "U/L", category: "Hepático", refRange: { M: [140, 200], F: [140, 200] } },
  // Renal
  { id: "creatinina", name: "Creatinina", unit: "mg/dL", category: "Renal", refRange: { M: [0.8, 1.1], F: [0.6, 0.9] } },
  { id: "ureia", name: "Ureia", unit: "mg/dL", category: "Renal", refRange: { M: [15, 25], F: [15, 25] } },
  { id: "acido_urico", name: "Ácido Úrico", unit: "mg/dL", category: "Renal", refRange: { M: [3.5, 5.9], F: [2.5, 5.0] } },
  { id: "tfg", name: "TFG (CKD-EPI)", unit: "mL/min", category: "Renal", refRange: { M: [90, 120], F: [90, 120] } },
  { id: "cistatina_c", name: "Cistatina C", unit: "mg/L", category: "Renal", refRange: { M: [0.53, 0.95], F: [0.53, 0.95] } },
  // Eletrólitos
  { id: "sodio", name: "Sódio", unit: "mEq/L", category: "Eletrólitos", refRange: { M: [138, 142], F: [138, 142] } },
  { id: "potassio", name: "Potássio", unit: "mEq/L", category: "Eletrólitos", refRange: { M: [4.0, 4.5], F: [4.0, 4.5] } },
  { id: "calcio_total", name: "Cálcio Total", unit: "mg/dL", category: "Eletrólitos", refRange: { M: [9.4, 10.2], F: [9.4, 10.2] } },
  { id: "calcio_ionico", name: "Cálcio Iônico", unit: "mg/dL", category: "Eletrólitos", refRange: { M: [4.6, 5.3], F: [4.6, 5.3] } },
  { id: "fosforo", name: "Fósforo", unit: "mg/dL", category: "Eletrólitos", refRange: { M: [3.0, 4.0], F: [3.0, 4.0] } },
  { id: "cloro", name: "Cloro", unit: "mEq/L", category: "Eletrólitos", refRange: { M: [100, 106], F: [100, 106] } },
  { id: "bicarbonato", name: "Bicarbonato", unit: "mEq/L", category: "Eletrólitos", refRange: { M: [22, 26], F: [22, 26] } },
  { id: "pth", name: "PTH", unit: "pg/mL", category: "Eletrólitos", refRange: { M: [15, 50], F: [15, 50] } },
  // Inflamatórios / Outros
  { id: "pcr", name: "PCR", unit: "mg/L", category: "Hemograma", refRange: { M: [0, 1.0], F: [0, 1.0] } },
  { id: "vhs", name: "VHS", unit: "mm/h", category: "Hemograma", refRange: { M: [0, 10], F: [0, 15] } },
  { id: "homocisteina", name: "Homocisteína", unit: "µmol/L", category: "Vitaminas", refRange: { M: [5, 8], F: [5, 8] } },
];

export function getMarkerStatus(value: number, marker: MarkerDef, sex: "M" | "F"): "normal" | "low" | "high" {
  const [min, max] = marker.refRange[sex];
  if (value < min) return "low";
  if (value > max) return "high";
  return "normal";
}

export function getMarkersByCategory(category: string): MarkerDef[] {
  return MARKERS.filter((m) => m.category === category);
}
