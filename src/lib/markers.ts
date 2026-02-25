export interface MarkerDef {
  id: string;
  name: string;
  unit: string;
  category: string;
  refRange: { M: [number, number]; F: [number, number] };
  qualitative?: boolean; // true for text-only results (FAN, Urina, Coprológico)
  panel?: "Padrão" | "Adicional"; // Padrão = painel rotineiro da médica
}

export const CATEGORIES = [
  "Hemograma",
  "Ferro",
  "Glicemia",
  "Lipídios",
  "Tireoide",
  "Hormônios",
  "Eixo GH",
  "Eixo Adrenal",
  "Andrógenos",
  "Vitaminas",
  "Minerais",
  "Hepático",
  "Renal",
  "Eletrólitos",
  "Coagulação",
  "Pancreático",
  "Imunologia",
  "Sorologia",
  "Proteínas",
  "Marcadores Tumorais",
  "Toxicologia",
  "Urina",
  "Fezes",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_COLORS: Record<Category, string> = {
  Hemograma: "220 70% 55%",
  Ferro: "30 80% 50%",
  Glicemia: "280 60% 55%",
  Lipídios: "340 70% 55%",
  Tireoide: "170 60% 40%",
  Hormônios: "300 50% 50%",
  "Eixo GH": "260 55% 55%",
  "Eixo Adrenal": "25 65% 50%",
  Andrógenos: "320 55% 50%",
  Vitaminas: "45 90% 50%",
  Minerais: "190 60% 45%",
  Hepático: "140 50% 40%",
  Renal: "200 50% 50%",
  Eletrólitos: "10 70% 55%",
  Coagulação: "0 60% 50%",
  Pancreático: "50 70% 45%",
  Imunologia: "270 50% 55%",
  Sorologia: "200 65% 45%",
  Proteínas: "180 50% 45%",
  "Marcadores Tumorais": "350 65% 50%",
  Toxicologia: "15 80% 45%",
  Urina: "55 70% 50%",
  Fezes: "35 60% 45%",
};

// Functional medicine reference ranges (sex-specific)
export const MARKERS: MarkerDef[] = [
  // Hemograma
  { id: "hemoglobina", name: "Hemoglobina", unit: "g/dL", category: "Hemograma", refRange: { M: [14.0, 15.5], F: [13.0, 14.5] } , panel: "Padrão" },
  { id: "hematocrito", name: "Hematócrito", unit: "%", category: "Hemograma", refRange: { M: [42, 48], F: [38, 44] } , panel: "Padrão" },
  { id: "eritrocitos", name: "Eritrócitos", unit: "milhões/µL", category: "Hemograma", refRange: { M: [4.5, 5.5], F: [4.0, 5.0] } , panel: "Adicional" },
  { id: "vcm", name: "VCM", unit: "fL", category: "Hemograma", refRange: { M: [82, 95], F: [82, 95] } , panel: "Padrão" },
  { id: "hcm", name: "HCM", unit: "pg", category: "Hemograma", refRange: { M: [28, 32], F: [28, 32] } , panel: "Padrão" },
  { id: "chcm", name: "CHCM", unit: "g/dL", category: "Hemograma", refRange: { M: [32, 36], F: [32, 36] } , panel: "Padrão" },
  { id: "rdw", name: "RDW", unit: "%", category: "Hemograma", refRange: { M: [11.5, 13.0], F: [11.5, 13.0] } , panel: "Padrão" },
  { id: "leucocitos", name: "Leucócitos", unit: "/µL", category: "Hemograma", refRange: { M: [5000, 8000], F: [5000, 8000] } , panel: "Padrão" },
  { id: "neutrofilos", name: "Neutrófilos", unit: "%", category: "Hemograma", refRange: { M: [40, 60], F: [40, 60] } , panel: "Adicional" },
  { id: "bastonetes", name: "Bastonetes", unit: "%", category: "Hemograma", refRange: { M: [0, 5], F: [0, 5] } , panel: "Adicional" },
  { id: "segmentados", name: "Segmentados", unit: "%", category: "Hemograma", refRange: { M: [45, 70], F: [45, 70] } , panel: "Adicional" },
  { id: "linfocitos", name: "Linfócitos", unit: "%", category: "Hemograma", refRange: { M: [25, 40], F: [25, 40] } , panel: "Adicional" },
  { id: "monocitos", name: "Monócitos", unit: "%", category: "Hemograma", refRange: { M: [4, 8], F: [4, 8] } , panel: "Adicional" },
  { id: "eosinofilos", name: "Eosinófilos", unit: "%", category: "Hemograma", refRange: { M: [1, 3], F: [1, 3] } , panel: "Padrão" },
  { id: "basofilos", name: "Basófilos", unit: "%", category: "Hemograma", refRange: { M: [0, 1], F: [0, 1] } , panel: "Adicional" },
  { id: "plaquetas", name: "Plaquetas", unit: "mil/µL", category: "Hemograma", refRange: { M: [200, 300], F: [200, 300] } , panel: "Padrão" },
  { id: "vpm", name: "VPM", unit: "fL", category: "Hemograma", refRange: { M: [9.2, 12.6], F: [9.2, 12.6] } , panel: "Adicional" },
  { id: "pcr", name: "PCR", unit: "mg/L", category: "Hemograma", refRange: { M: [0, 1.0], F: [0, 1.0] } , panel: "Padrão" },
  { id: "vhs", name: "VHS", unit: "mm/h", category: "Hemograma", refRange: { M: [0, 10], F: [0, 15] } , panel: "Padrão" },
  // Ferro
  { id: "ferro_serico", name: "Ferro Sérico", unit: "µg/dL", category: "Ferro", refRange: { M: [85, 130], F: [75, 120] } , panel: "Padrão" },
  { id: "ferritina", name: "Ferritina", unit: "ng/mL", category: "Ferro", refRange: { M: [50, 150], F: [40, 100] } , panel: "Padrão" },
  { id: "transferrina", name: "Transferrina", unit: "mg/dL", category: "Ferro", refRange: { M: [200, 360], F: [200, 360] } , panel: "Adicional" },
  { id: "sat_transferrina", name: "Sat. Transferrina", unit: "%", category: "Ferro", refRange: { M: [25, 45], F: [25, 45] } , panel: "Padrão" },
  { id: "tibc", name: "TIBC", unit: "µg/dL", category: "Ferro", refRange: { M: [250, 370], F: [250, 370] } , panel: "Adicional" },
  // Glicemia
  { id: "glicose_jejum", name: "Glicose Jejum", unit: "mg/dL", category: "Glicemia", refRange: { M: [75, 86], F: [75, 86] } , panel: "Padrão" },
  { id: "hba1c", name: "HbA1c", unit: "%", category: "Glicemia", refRange: { M: [4.5, 5.3], F: [4.5, 5.3] } , panel: "Padrão" },
  { id: "insulina_jejum", name: "Insulina Jejum", unit: "µU/mL", category: "Glicemia", refRange: { M: [2.0, 5.0], F: [2.0, 5.0] } , panel: "Padrão" },
  { id: "homa_ir", name: "HOMA-IR", unit: "", category: "Glicemia", refRange: { M: [0.5, 1.5], F: [0.5, 1.5] } , panel: "Padrão" },
  // Lipídios
  { id: "colesterol_total", name: "Colesterol Total", unit: "mg/dL", category: "Lipídios", refRange: { M: [150, 200], F: [150, 200] } , panel: "Adicional" },
  { id: "hdl", name: "HDL", unit: "mg/dL", category: "Lipídios", refRange: { M: [55, 100], F: [60, 100] } , panel: "Padrão" },
  { id: "ldl", name: "LDL", unit: "mg/dL", category: "Lipídios", refRange: { M: [0, 100], F: [0, 100] } , panel: "Padrão" },
  { id: "vldl", name: "VLDL", unit: "mg/dL", category: "Lipídios", refRange: { M: [5, 20], F: [5, 20] } , panel: "Padrão" },
  { id: "triglicerides", name: "Triglicerídeos", unit: "mg/dL", category: "Lipídios", refRange: { M: [50, 100], F: [50, 100] } , panel: "Padrão" },
  { id: "colesterol_nao_hdl", name: "Colesterol Não-HDL", unit: "mg/dL", category: "Lipídios", refRange: { M: [0, 130], F: [0, 130] } , panel: "Adicional" },
  { id: "apo_a1", name: "Apolipoproteína A-1", unit: "mg/dL", category: "Lipídios", refRange: { M: [104, 202], F: [108, 225] } , panel: "Padrão" },
  { id: "apo_b", name: "Apolipoproteína B", unit: "mg/dL", category: "Lipídios", refRange: { M: [0, 90], F: [0, 90] } , panel: "Padrão" },
  { id: "lipoproteina_a", name: "Lipoproteína (a)", unit: "nmol/L", category: "Lipídios", refRange: { M: [0, 75], F: [0, 75] } , panel: "Padrão" },
  { id: "relacao_ct_hdl", name: "CT/HDL", unit: "", category: "Lipídios", refRange: { M: [0, 3.5], F: [0, 3.5] } , panel: "Adicional" },
  { id: "relacao_tg_hdl", name: "TG/HDL", unit: "", category: "Lipídios", refRange: { M: [0, 2.0], F: [0, 2.0] } , panel: "Adicional" },
  { id: "relacao_apob_apoa1", name: "ApoB/ApoA1", unit: "", category: "Lipídios", refRange: { M: [0, 0.70], F: [0, 0.70] } , panel: "Adicional" },
  // Tireoide
  { id: "tsh", name: "TSH", unit: "mUI/L", category: "Tireoide", refRange: { M: [1.0, 2.0], F: [1.0, 2.0] } , panel: "Padrão" },
  { id: "t4_livre", name: "T4 Livre", unit: "ng/dL", category: "Tireoide", refRange: { M: [1.0, 1.5], F: [1.0, 1.5] } , panel: "Padrão" },
  { id: "t4_total", name: "T4 Total", unit: "µg/dL", category: "Tireoide", refRange: { M: [6.0, 10.0], F: [6.0, 10.0] } , panel: "Adicional" },
  { id: "t3_livre", name: "T3 Livre", unit: "ng/dL", category: "Tireoide", refRange: { M: [0.27, 0.42], F: [0.27, 0.42] } , panel: "Padrão" },
  { id: "t3_total", name: "T3 Total", unit: "ng/dL", category: "Tireoide", refRange: { M: [80, 180], F: [80, 180] } , panel: "Padrão" },
  { id: "t3_reverso", name: "T3 Reverso", unit: "ng/dL", category: "Tireoide", refRange: { M: [10, 20], F: [10, 20] } , panel: "Padrão" },
  { id: "anti_tpo", name: "Anti-TPO", unit: "UI/mL", category: "Tireoide", refRange: { M: [0, 15], F: [0, 15] } , panel: "Padrão" },
  { id: "anti_tg", name: "Anti-TG", unit: "UI/mL", category: "Tireoide", refRange: { M: [0, 20], F: [0, 20] } , panel: "Padrão" },
  { id: "trab", name: "TRAb", unit: "UI/L", category: "Tireoide", refRange: { M: [0, 1.75], F: [0, 1.75] } , panel: "Padrão" },
  // Hormônios
  { id: "testosterona_total", name: "Testosterona Total", unit: "ng/dL", category: "Hormônios", refRange: { M: [500, 900], F: [15, 70] } , panel: "Padrão" },
  { id: "testosterona_livre", name: "Testosterona Livre", unit: "pg/mL", category: "Hormônios", refRange: { M: [15, 25], F: [1.0, 5.0] } , panel: "Padrão" },
  { id: "estradiol", name: "Estradiol", unit: "pg/mL", category: "Hormônios", refRange: { M: [20, 40], F: [50, 200] } , panel: "Padrão" },
  { id: "estrona", name: "Estrona (E1)", unit: "pg/mL", category: "Hormônios", refRange: { M: [10, 60], F: [17, 200] } , panel: "Padrão" },
  { id: "progesterona", name: "Progesterona", unit: "ng/mL", category: "Hormônios", refRange: { M: [0.2, 1.4], F: [5.0, 20.0] } , panel: "Padrão" },
  { id: "dhea_s", name: "DHEA-S", unit: "µg/dL", category: "Hormônios", refRange: { M: [200, 450], F: [150, 350] } , panel: "Padrão" },
  { id: "cortisol", name: "Cortisol (manhã)", unit: "µg/dL", category: "Hormônios", refRange: { M: [10, 18], F: [10, 18] } , panel: "Padrão" },
  { id: "shbg", name: "SHBG", unit: "nmol/L", category: "Hormônios", refRange: { M: [20, 50], F: [40, 120] } , panel: "Padrão" },
  { id: "fsh", name: "FSH", unit: "mUI/mL", category: "Hormônios", refRange: { M: [1.5, 12.4], F: [3.5, 12.5] } , panel: "Padrão" },
  { id: "lh", name: "LH", unit: "mUI/mL", category: "Hormônios", refRange: { M: [1.7, 8.6], F: [2.4, 12.6] } , panel: "Padrão" },
  { id: "prolactina", name: "Prolactina", unit: "ng/mL", category: "Hormônios", refRange: { M: [4.0, 15.2], F: [4.8, 23.3] } , panel: "Padrão" },
  { id: "amh", name: "AMH", unit: "ng/mL", category: "Hormônios", refRange: { M: [0.7, 19.0], F: [0.5, 6.0] } , panel: "Padrão" },
  // Eixo GH
  { id: "igf1", name: "IGF-1 (Somatomedina C)", unit: "ng/mL", category: "Eixo GH", refRange: { M: [115, 355], F: [115, 355] } , panel: "Padrão" },
  { id: "igfbp3", name: "IGFBP-3", unit: "µg/mL", category: "Eixo GH", refRange: { M: [3.5, 7.6], F: [3.5, 7.6] } , panel: "Adicional" },
  // Eixo Adrenal
  { id: "acth", name: "ACTH", unit: "pg/mL", category: "Eixo Adrenal", refRange: { M: [4.7, 48.8], F: [4.7, 48.8] } , panel: "Padrão" },
  { id: "cortisol_livre_urina", name: "Cortisol Livre (urina 24h)", unit: "µg/24h", category: "Eixo Adrenal", refRange: { M: [13, 85], F: [13, 85] } , panel: "Adicional" },
  { id: "aldosterona", name: "Aldosterona", unit: "ng/dL", category: "Eixo Adrenal", refRange: { M: [2.5, 39.2], F: [2.5, 39.2] } , panel: "Adicional" },
  // Andrógenos
  { id: "dihidrotestosterona", name: "Dihidrotestosterona", unit: "pg/mL", category: "Andrógenos", refRange: { M: [160, 790], F: [0, 460] } , panel: "Padrão" },
  { id: "androstenediona", name: "Androstenediona", unit: "ng/dL", category: "Andrógenos", refRange: { M: [45, 157], F: [39, 165] } , panel: "Padrão" },
  // Vitaminas
  { id: "vitamina_d", name: "Vitamina D (25-OH)", unit: "ng/mL", category: "Vitaminas", refRange: { M: [50, 80], F: [50, 80] } , panel: "Padrão" },
  { id: "vitamina_d_125", name: "1,25-Dihidroxi Vitamina D", unit: "pg/mL", category: "Vitaminas", refRange: { M: [19.9, 79.3], F: [19.9, 79.3] } , panel: "Padrão" },
  { id: "vitamina_b12", name: "Vitamina B12", unit: "pg/mL", category: "Vitaminas", refRange: { M: [500, 1000], F: [500, 1000] } , panel: "Padrão" },
  { id: "acido_folico", name: "Ácido Fólico", unit: "ng/mL", category: "Vitaminas", refRange: { M: [10, 25], F: [10, 25] } , panel: "Padrão" },
  { id: "vitamina_a", name: "Vitamina A", unit: "mg/L", category: "Vitaminas", refRange: { M: [0.3, 0.7], F: [0.3, 0.7] } , panel: "Padrão" },
  { id: "vitamina_e", name: "Vitamina E", unit: "mg/L", category: "Vitaminas", refRange: { M: [8, 15], F: [8, 15] } , panel: "Adicional" },
  { id: "vitamina_c", name: "Vitamina C", unit: "mg/dL", category: "Vitaminas", refRange: { M: [0.6, 2.0], F: [0.6, 2.0] } , panel: "Padrão" },
  { id: "vitamina_b6", name: "Vitamina B6", unit: "ng/mL", category: "Vitaminas", refRange: { M: [5, 30], F: [5, 30] } , panel: "Adicional" },
  { id: "vitamina_b1", name: "Vitamina B1", unit: "µg/dL", category: "Vitaminas", refRange: { M: [2.5, 7.5], F: [2.5, 7.5] } , panel: "Adicional" },
  { id: "homocisteina", name: "Homocisteína", unit: "µmol/L", category: "Vitaminas", refRange: { M: [5, 8], F: [5, 8] } , panel: "Padrão" },
  // Minerais
  { id: "magnesio", name: "Magnésio", unit: "mg/dL", category: "Minerais", refRange: { M: [2.0, 2.5], F: [2.0, 2.5] } , panel: "Adicional" },
  { id: "zinco", name: "Zinco", unit: "µg/dL", category: "Minerais", refRange: { M: [80, 120], F: [75, 110] } , panel: "Padrão" },
  { id: "selenio", name: "Selênio", unit: "µg/L", category: "Minerais", refRange: { M: [110, 160], F: [110, 160] } , panel: "Padrão" },
  { id: "cobre", name: "Cobre", unit: "µg/dL", category: "Minerais", refRange: { M: [70, 140], F: [80, 155] } , panel: "Padrão" },
  { id: "manganes", name: "Manganês", unit: "µg/L", category: "Minerais", refRange: { M: [4.7, 18.3], F: [4.7, 18.3] } , panel: "Adicional" },
  { id: "cromo", name: "Cromo", unit: "µg/L", category: "Minerais", refRange: { M: [0.5, 2.0], F: [0.5, 2.0] } , panel: "Adicional" },
  { id: "iodo_urinario", name: "Iodo Urinário", unit: "µg/L", category: "Minerais", refRange: { M: [100, 300], F: [100, 300] } , panel: "Adicional" },
  { id: "chumbo", name: "Chumbo", unit: "µg/dL", category: "Toxicologia", refRange: { M: [0, 5], F: [0, 5] } , panel: "Padrão" },
  { id: "mercurio", name: "Mercúrio", unit: "µg/L", category: "Toxicologia", refRange: { M: [0, 5.9], F: [0, 5.9] } , panel: "Padrão" },
  { id: "cadmio", name: "Cádmio", unit: "µg/L", category: "Toxicologia", refRange: { M: [0, 1.2], F: [0, 1.2] } , panel: "Adicional" },
  { id: "aluminio", name: "Alumínio", unit: "µg/L", category: "Toxicologia", refRange: { M: [0, 10], F: [0, 10] } , panel: "Padrão" },
  // Hepático
  { id: "tgo_ast", name: "TGO (AST)", unit: "U/L", category: "Hepático", refRange: { M: [10, 26], F: [10, 25] } , panel: "Padrão" },
  { id: "tgp_alt", name: "TGP (ALT)", unit: "U/L", category: "Hepático", refRange: { M: [10, 26], F: [10, 25] } , panel: "Padrão" },
  { id: "ggt", name: "GGT", unit: "U/L", category: "Hepático", refRange: { M: [10, 30], F: [7, 25] } , panel: "Padrão" },
  { id: "fosfatase_alcalina", name: "Fosfatase Alcalina", unit: "U/L", category: "Hepático", refRange: { M: [35, 85], F: [35, 85] } , panel: "Padrão" },
  { id: "bilirrubina_total", name: "Bilirrubina Total", unit: "mg/dL", category: "Hepático", refRange: { M: [0.2, 1.0], F: [0.2, 1.0] } , panel: "Adicional" },
  { id: "bilirrubina_direta", name: "Bilirrubina Direta", unit: "mg/dL", category: "Hepático", refRange: { M: [0.0, 0.3], F: [0.0, 0.3] } , panel: "Adicional" },
  { id: "bilirrubina_indireta", name: "Bilirrubina Indireta", unit: "mg/dL", category: "Hepático", refRange: { M: [0.0, 0.8], F: [0.0, 0.8] } , panel: "Adicional" },
  { id: "albumina", name: "Albumina", unit: "g/dL", category: "Hepático", refRange: { M: [4.0, 5.0], F: [4.0, 5.0] } , panel: "Padrão" },
  { id: "proteinas_totais", name: "Proteínas Totais", unit: "g/dL", category: "Hepático", refRange: { M: [6.5, 7.5], F: [6.5, 7.5] } , panel: "Adicional" },
  { id: "ldh", name: "LDH", unit: "U/L", category: "Hepático", refRange: { M: [140, 200], F: [140, 200] } , panel: "Adicional" },
  // Renal
  { id: "creatinina", name: "Creatinina", unit: "mg/dL", category: "Renal", refRange: { M: [0.8, 1.1], F: [0.6, 0.9] } , panel: "Padrão" },
  { id: "ureia", name: "Ureia", unit: "mg/dL", category: "Renal", refRange: { M: [15, 25], F: [15, 25] } , panel: "Padrão" },
  { id: "acido_urico", name: "Ácido Úrico", unit: "mg/dL", category: "Renal", refRange: { M: [3.5, 5.9], F: [2.5, 5.0] } , panel: "Padrão" },
  { id: "tfg", name: "TFG (CKD-EPI)", unit: "mL/min", category: "Renal", refRange: { M: [90, 120], F: [90, 120] } , panel: "Adicional" },
  { id: "cistatina_c", name: "Cistatina C", unit: "mg/L", category: "Renal", refRange: { M: [0.53, 0.95], F: [0.53, 0.95] } , panel: "Adicional" },
  // Eletrólitos
  { id: "sodio", name: "Sódio", unit: "mEq/L", category: "Eletrólitos", refRange: { M: [138, 142], F: [138, 142] } , panel: "Padrão" },
  { id: "potassio", name: "Potássio", unit: "mEq/L", category: "Eletrólitos", refRange: { M: [4.0, 4.5], F: [4.0, 4.5] } , panel: "Padrão" },
  { id: "calcio_total", name: "Cálcio Total", unit: "mg/dL", category: "Eletrólitos", refRange: { M: [9.4, 10.2], F: [9.4, 10.2] } , panel: "Padrão" },
  { id: "calcio_ionico", name: "Cálcio Iônico", unit: "mmol/L", category: "Eletrólitos", refRange: { M: [1.10, 1.35], F: [1.10, 1.35] } , panel: "Padrão" },
  { id: "fosforo", name: "Fósforo", unit: "mg/dL", category: "Eletrólitos", refRange: { M: [3.0, 4.0], F: [3.0, 4.0] } , panel: "Adicional" },
  { id: "cloro", name: "Cloro", unit: "mEq/L", category: "Eletrólitos", refRange: { M: [100, 106], F: [100, 106] } , panel: "Adicional" },
  { id: "bicarbonato", name: "Bicarbonato", unit: "mEq/L", category: "Eletrólitos", refRange: { M: [22, 26], F: [22, 26] } , panel: "Adicional" },
  { id: "pth", name: "PTH", unit: "pg/mL", category: "Eletrólitos", refRange: { M: [15, 50], F: [15, 50] } , panel: "Padrão" },
  { id: "calcitonina", name: "Calcitonina", unit: "pg/mL", category: "Eletrólitos", refRange: { M: [0, 8.4], F: [0, 5.0] } , panel: "Adicional" },
  // Coagulação
  { id: "fibrinogenio", name: "Fibrinogênio", unit: "mg/dL", category: "Coagulação", refRange: { M: [200, 400], F: [200, 400] } , panel: "Padrão" },
  { id: "dimeros_d", name: "Dímeros D", unit: "ng/mL", category: "Coagulação", refRange: { M: [0, 500], F: [0, 500] } , panel: "Adicional" },
  // Pancreático
  { id: "amilase", name: "Amilase", unit: "U/L", category: "Pancreático", refRange: { M: [28, 100], F: [28, 100] } , panel: "Padrão" },
  { id: "lipase", name: "Lipase", unit: "U/L", category: "Pancreático", refRange: { M: [13, 60], F: [13, 60] } , panel: "Padrão" },
  // Imunologia
  { id: "fan", name: "FAN (Fator Anti-Núcleo)", unit: "", category: "Imunologia", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "fator_reumatoide", name: "Fator Reumatoide", unit: "UI/mL", category: "Imunologia", refRange: { M: [0, 14], F: [0, 14] } , panel: "Adicional" },
  { id: "anti_endomisio_iga", name: "Anti-Endomísio IgA", unit: "", category: "Imunologia", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "anti_transglutaminase_iga", name: "Anti-Transglutaminase IgA", unit: "U", category: "Imunologia", refRange: { M: [0, 20], F: [0, 20] } , panel: "Padrão" },
  { id: "g6pd", name: "G6PD (Glicose-6-Fosfato Desidrogenase)", unit: "U/g Hb", category: "Imunologia", refRange: { M: [6.7, 999], F: [6.7, 999] } , panel: "Adicional" },
  // Sorologia Infecciosa
  { id: "hiv", name: "HIV 1/2 (Anticorpos e Antígeno)", unit: "", category: "Sorologia", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "hbsag", name: "HBsAg (Antígeno Austrália)", unit: "", category: "Sorologia", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "anti_hbs", name: "Anti-HBs (Hepatite B)", unit: "UI/L", category: "Sorologia", refRange: { M: [10, 999], F: [10, 999] } , panel: "Adicional" },
  { id: "anti_hbc_total", name: "Anti-HBc Total (Hepatite B)", unit: "", category: "Sorologia", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "anti_hcv", name: "Anti-HCV (Hepatite C)", unit: "", category: "Sorologia", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "sifilis_treponemico", name: "Sífilis (Anti-T. Pallidum)", unit: "", category: "Sorologia", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "sifilis_vdrl", name: "Sífilis VDRL (Cardiolipina)", unit: "", category: "Sorologia", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "toxoplasma_igg", name: "Toxoplasma IgG", unit: "UI/mL", category: "Sorologia", refRange: { M: [0, 1.6], F: [0, 1.6] } , panel: "Adicional" },
  { id: "toxoplasma_igm", name: "Toxoplasma IgM", unit: "", category: "Sorologia", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "vzv_igg", name: "Varicella-Zoster IgG", unit: "mIU/mL", category: "Sorologia", refRange: { M: [165, 999999], F: [165, 999999] } , panel: "Adicional" },
  { id: "vzv_igm", name: "Varicella-Zoster IgM", unit: "", category: "Sorologia", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "hsv_igm", name: "Herpes Simplex 1+2 IgM", unit: "", category: "Sorologia", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "hsv1_igg", name: "Herpes Simplex 1 IgG", unit: "", category: "Sorologia", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "hsv2_igg", name: "Herpes Simplex 2 IgG", unit: "", category: "Sorologia", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  // Proteínas (Eletroforese)
  { id: "eletroforese_albumina", name: "Albumina (eletroforese)", unit: "%", category: "Proteínas", refRange: { M: [55.1, 65.7], F: [55.1, 65.7] } , panel: "Adicional" },
  { id: "eletroforese_alfa1", name: "Alfa 1", unit: "%", category: "Proteínas", refRange: { M: [3.1, 5.6], F: [3.1, 5.6] } , panel: "Adicional" },
  { id: "eletroforese_alfa2", name: "Alfa 2", unit: "%", category: "Proteínas", refRange: { M: [8.0, 12.7], F: [8.0, 12.7] } , panel: "Adicional" },
  { id: "eletroforese_beta1", name: "Beta 1", unit: "%", category: "Proteínas", refRange: { M: [4.9, 7.2], F: [4.9, 7.2] } , panel: "Adicional" },
  { id: "eletroforese_beta2", name: "Beta 2", unit: "%", category: "Proteínas", refRange: { M: [3.1, 6.1], F: [3.1, 6.1] } , panel: "Adicional" },
  { id: "eletroforese_gama", name: "Gama", unit: "%", category: "Proteínas", refRange: { M: [10.3, 18.2], F: [10.3, 18.2] } , panel: "Adicional" },
  { id: "relacao_ag", name: "Relação A/G", unit: "", category: "Proteínas", refRange: { M: [1.5, 2.5], F: [1.5, 2.5] } , panel: "Adicional" },
  // Marcadores Tumorais
  { id: "ca_19_9", name: "CA 19-9", unit: "U/mL", category: "Marcadores Tumorais", refRange: { M: [0, 37], F: [0, 37] } , panel: "Adicional" },
  { id: "ca_125", name: "CA-125", unit: "U/mL", category: "Marcadores Tumorais", refRange: { M: [0, 35], F: [0, 35] } , panel: "Adicional" },
  { id: "ca_72_4", name: "CA 72-4", unit: "U/mL", category: "Marcadores Tumorais", refRange: { M: [0, 6.9], F: [0, 6.9] } , panel: "Adicional" },
  { id: "ca_15_3", name: "CA 15-3", unit: "U/mL", category: "Marcadores Tumorais", refRange: { M: [0, 25], F: [0, 25] } , panel: "Adicional" },
  { id: "afp", name: "AFP", unit: "ng/mL", category: "Marcadores Tumorais", refRange: { M: [0, 7.0], F: [0, 7.0] } , panel: "Adicional" },
  { id: "cea", name: "CEA", unit: "ng/mL", category: "Marcadores Tumorais", refRange: { M: [0, 3.0], F: [0, 3.0] } , panel: "Adicional" },
  // Urina Tipo 1
  { id: "urina_cor", name: "Cor", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "urina_aspecto", name: "Aspecto", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "urina_densidade", name: "Densidade", unit: "", category: "Urina", refRange: { M: [1.005, 1.030], F: [1.005, 1.030] } , panel: "Padrão" },
  { id: "urina_ph", name: "pH Urinário", unit: "", category: "Urina", refRange: { M: [5.0, 7.0], F: [5.0, 7.0] } , panel: "Padrão" },
  { id: "urina_proteinas", name: "Proteínas (urina)", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "urina_glicose", name: "Glicose (urina)", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "urina_hemoglobina", name: "Hemoglobina (urina)", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "urina_leucocitos", name: "Leucócitos (urina)", unit: "/campo", category: "Urina", refRange: { M: [0, 5], F: [0, 5] }, qualitative: true , panel: "Padrão" },
  { id: "urina_hemacias", name: "Hemácias (urina)", unit: "/campo", category: "Urina", refRange: { M: [0, 3], F: [0, 3] }, qualitative: true , panel: "Padrão" },
  { id: "urina_bacterias", name: "Bactérias (urina)", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "urina_celulas", name: "Células Epiteliais", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "urina_cilindros", name: "Cilindros", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "urina_cristais", name: "Cristais", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "urina_nitritos", name: "Nitritos", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "urina_bilirrubina", name: "Bilirrubina (urina)", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "urina_urobilinogenio", name: "Urobilinogênio", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "urina_cetona", name: "Cetonas", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "urina_muco", name: "Muco/Filamentos (urina)", unit: "", category: "Urina", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  // Coprológico Funcional
  { id: "copro_cor", name: "Cor (fezes)", unit: "", category: "Fezes", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "copro_consistencia", name: "Consistência", unit: "", category: "Fezes", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "copro_muco", name: "Muco", unit: "", category: "Fezes", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "copro_sangue", name: "Sangue Oculto", unit: "", category: "Fezes", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "copro_leucocitos", name: "Leucócitos (fezes)", unit: "", category: "Fezes", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "copro_hemacias", name: "Hemácias (fezes)", unit: "", category: "Fezes", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "copro_parasitas", name: "Parasitas", unit: "", category: "Fezes", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "copro_gordura", name: "Gordura Fecal", unit: "", category: "Fezes", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "copro_fibras", name: "Fibras Musculares", unit: "", category: "Fezes", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "copro_amido", name: "Amido", unit: "", category: "Fezes", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Padrão" },
  { id: "copro_residuos", name: "Resíduos Alimentares", unit: "", category: "Fezes", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "copro_ac_graxos", name: "Ácidos Graxos", unit: "", category: "Fezes", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "copro_flora", name: "Flora Bacteriana", unit: "", category: "Fezes", refRange: { M: [0, 0], F: [0, 0] }, qualitative: true , panel: "Adicional" },
  { id: "copro_ph", name: "pH Fecal", unit: "", category: "Fezes", refRange: { M: [6.0, 7.5], F: [6.0, 7.5] } , panel: "Adicional" },
];

/**
 * Determine marker status, with optional operator support for "<" / ">" values.
 * - operator "<": if the numeric value <= upper ref limit, classify as "normal" (below detection limit but within range)
 * - operator ">": if the numeric value >= lower ref limit, classify as "high"
 */
export function getMarkerStatus(value: number, marker: MarkerDef, sex: "M" | "F", operator?: string): "normal" | "low" | "high" {
  const [min, max] = marker.refRange[sex];
  if (operator === "<" || operator === "<=") {
    // Value is "< X" — the real value is somewhere between 0 and X
    // If X <= upper limit, it's within range (or below detection)
    if (value <= max) return "normal";
    // If X > upper limit, we can't determine — but the real value could still be in range
    return "normal"; // indeterminate, default to normal
  }
  if (operator === ">" || operator === ">=") {
    if (value >= min) return "high";
    return "normal";
  }
  if (value < min) return "low";
  if (value > max) return "high";
  return "normal";
}

export function getMarkersByCategory(category: string): MarkerDef[] {
  return MARKERS.filter((m) => m.category === category);
}

/**
 * Parse operator from a text_value like "< 34" or "> 100"
 * Returns { operator, numericValue } or null if no operator found
 */
export function parseOperatorValue(textValue: string): { operator: string; numericValue: number } | null {
  const match = textValue.match(/^([<>]=?)\s*(\d+[.,]?\d*)/);
  if (!match) return null;
  return {
    operator: match[1],
    numericValue: parseFloat(match[2].replace(",", ".")),
  };
}
