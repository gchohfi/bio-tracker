// Não edite as categorias ou cores aqui; edite em src/lib/categoryConfig.ts.
export {
  CATEGORIES,
  CATEGORY_CONFIG,
  type Category,
  getCategoryHsl as CATEGORY_COLORS_FN,
  getCategoryHsl,
  getCategoryRgb,
} from "@/lib/categoryConfig";
import { CATEGORY_CONFIG, type Category } from "@/lib/categoryConfig";
import { parseLabReference, type ParsedReference } from './parseLabReference';

// CATEGORY_COLORS mantido para compatibilidade retroativa com componentes existentes.
// Derivado automaticamente do CATEGORY_CONFIG — não precisa ser mantido manualmente.
export const CATEGORY_COLORS: Record<Category, string> = Object.fromEntries(
  Object.entries(CATEGORY_CONFIG).map(([k, v]) => [k, v.hsl])
) as Record<Category, string>;

export interface MarkerDef {
  id: string;
  name: string;
  unit: string;
  category: string;
  /**
   * labRange: referência laboratorial convencional (padrão SBPC/ML, SBC, SBD etc.)
   * Usada para calcular status (normal/baixo/alto), cores e alertas.
   */
  labRange: { M: [number, number]; F: [number, number] };
  /**
   * refRange: faixa funcional/ótima (medicina funcional e integrativa)
   * Exibida apenas como informação descritiva secundária para o médico.
   */
  refRange: { M: [number, number]; F: [number, number] };
  qualitative?: boolean; // true for text-only results (FAN, Urina, Coprológico)
  panel?: "Padrão" | "Adicional"; // Padrão = painel rotineiro da médica
}

// Referências laboratoriais convencionais (labRange) + faixas funcionais (refRange)
export const MARKERS: MarkerDef[] = [
  // ── Hemograma ─────────────────────────────────────────────────────────────
  { id: "hemoglobina",     name: "Hemoglobina",     unit: "g/dL",         category: "Hemograma",
    labRange: { M: [13.5, 17.5], F: [12.0, 16.0] },
    refRange: { M: [14.0, 15.5], F: [13.0, 14.5] }, panel: "Padrão" },

  { id: "hematocrito",     name: "Hematócrito",     unit: "%",            category: "Hemograma",
    labRange: { M: [39, 50], F: [35, 45] },
    refRange: { M: [42, 48], F: [38, 44] }, panel: "Padrão" },

  { id: "eritrocitos",     name: "Eritrócitos",     unit: "milhões/µL",   category: "Hemograma",
    labRange: { M: [4.5, 5.9], F: [4.0, 5.2] },
    refRange: { M: [4.5, 5.5], F: [4.0, 5.0] }, panel: "Adicional" },

  { id: "vcm",             name: "VCM",             unit: "fL",           category: "Hemograma",
    labRange: { M: [80, 100], F: [80, 100] },
    refRange: { M: [82, 95],  F: [82, 95]  }, panel: "Padrão" },

  { id: "hcm",             name: "HCM",             unit: "pg",           category: "Hemograma",
    labRange: { M: [27, 32], F: [27, 32] },
    refRange: { M: [28, 32], F: [28, 32] }, panel: "Padrão" },

  { id: "chcm",            name: "CHCM",            unit: "g/dL",         category: "Hemograma",
    labRange: { M: [32, 36], F: [32, 36] },
    refRange: { M: [32, 36], F: [32, 36] }, panel: "Padrão" },

  { id: "rdw",             name: "RDW",             unit: "%",            category: "Hemograma",
    labRange: { M: [11.5, 14.5], F: [11.5, 14.5] },
    refRange: { M: [11.5, 13.0], F: [11.5, 13.0] }, panel: "Padrão" },

  { id: "leucocitos",      name: "Leucócitos",      unit: "/µL",          category: "Hemograma",
    labRange: { M: [4000, 11000], F: [4000, 11000] },
    refRange: { M: [5000, 8000],  F: [5000, 8000]  }, panel: "Padrão" },

  { id: "neutrofilos",     name: "Neutrófilos",     unit: "%",            category: "Hemograma",
    labRange: { M: [45, 70], F: [45, 70] },
    refRange: { M: [40, 60], F: [40, 60] }, panel: "Adicional" },

  { id: "bastonetes",      name: "Bastonetes",      unit: "%",            category: "Hemograma",
    labRange: { M: [0, 5], F: [0, 5] },
    refRange: { M: [0, 5], F: [0, 5] }, panel: "Adicional" },

  { id: "segmentados",     name: "Segmentados",     unit: "%",            category: "Hemograma",
    labRange: { M: [45, 70], F: [45, 70] },
    refRange: { M: [45, 70], F: [45, 70] }, panel: "Adicional" },

  { id: "linfocitos",      name: "Linfócitos",      unit: "%",            category: "Hemograma",
    labRange: { M: [20, 45], F: [20, 45] },
    refRange: { M: [25, 40], F: [25, 40] }, panel: "Adicional" },

  { id: "linfocitos_abs",  name: "Linfócitos (abs)", unit: "/mm³",         category: "Hemograma",
    labRange: { M: [1120, 2950], F: [1120, 2950] },
    refRange: { M: [1500, 2800], F: [1500, 2800] }, panel: "Adicional" },

  { id: "monocitos",       name: "Monócitos",       unit: "%",            category: "Hemograma",
    labRange: { M: [2, 10], F: [2, 10] },
    refRange: { M: [4, 8],  F: [4, 8]  }, panel: "Adicional" },

  { id: "eosinofilos",     name: "Eosinófilos",     unit: "%",            category: "Hemograma",
    labRange: { M: [1, 5], F: [1, 5] },
    refRange: { M: [1, 3], F: [1, 3] }, panel: "Padrão" },

  { id: "basofilos",       name: "Basófilos",       unit: "%",            category: "Hemograma",
    labRange: { M: [0, 2], F: [0, 2] },
    refRange: { M: [0, 1], F: [0, 1] }, panel: "Adicional" },

  { id: "plaquetas",       name: "Plaquetas",       unit: "mil/µL",       category: "Hemograma",
    labRange: { M: [150, 400], F: [150, 400] },
    refRange: { M: [200, 300], F: [200, 300] }, panel: "Padrão" },

  { id: "vpm",             name: "VPM",             unit: "fL",           category: "Hemograma",
    labRange: { M: [7.5, 12.5], F: [7.5, 12.5] },
    refRange: { M: [9.2, 12.6], F: [9.2, 12.6] }, panel: "Adicional" },

  { id: "pcr",             name: "PCR",             unit: "mg/L",         category: "Inflamação",
    labRange: { M: [0, 5.0], F: [0, 5.0] },
    refRange: { M: [0, 1.0], F: [0, 1.0] }, panel: "Padrão" },

  { id: "vhs",             name: "VHS",             unit: "mm/h",         category: "Inflamação",
    labRange: { M: [0, 15], F: [0, 20] },
    refRange: { M: [0, 10], F: [0, 15] }, panel: "Padrão" },

  // ── Ferro ─────────────────────────────────────────────────────────────────
  { id: "ferro_serico",    name: "Ferro Sérico",    unit: "µg/dL",        category: "Ferro",
    labRange: { M: [65, 175], F: [50, 170] },
    refRange: { M: [85, 130], F: [75, 120] }, panel: "Padrão" },

  { id: "ferritina",       name: "Ferritina",       unit: "ng/mL",        category: "Ferro",
    labRange: { M: [22, 322], F: [10, 291] },
    refRange: { M: [50, 150], F: [40, 100] }, panel: "Padrão" },

  { id: "transferrina",    name: "Transferrina",    unit: "mg/dL",        category: "Ferro",
    labRange: { M: [200, 360], F: [200, 360] },
    refRange: { M: [200, 360], F: [200, 360] }, panel: "Adicional" },

  { id: "sat_transferrina", name: "Sat. Transferrina", unit: "%",         category: "Ferro",
    labRange: { M: [20, 50], F: [15, 50] },
    refRange: { M: [25, 45], F: [25, 45] }, panel: "Padrão" },

  { id: "tibc",            name: "TIBC",            unit: "µg/dL",        category: "Ferro",
    labRange: { M: [250, 370], F: [250, 370] },
    refRange: { M: [250, 370], F: [250, 370] }, panel: "Adicional" },

  { id: "ferro_metabolismo", name: "Ferro (painel Metabolismo do Ferro)", unit: "µg/dL", category: "Ferro",
    labRange: { M: [50, 170], F: [50, 170] },
    refRange: { M: [50, 170], F: [50, 170] }, panel: "Padrão" },

  { id: "fixacao_latente_ferro", name: "Capacidade de Fixação Latente do Ferro", unit: "µg/dL", category: "Ferro",
    labRange: { M: [130, 280], F: [130, 280] },
    refRange: { M: [130, 280], F: [130, 280] }, panel: "Adicional" },

  // ── Glicemia ──────────────────────────────────────────────────────────────
  { id: "glicose_jejum",   name: "Glicose Jejum",   unit: "mg/dL",        category: "Glicemia",
    labRange: { M: [70, 99], F: [70, 99] },
    refRange: { M: [75, 86], F: [75, 86] }, panel: "Padrão" },

  { id: "hba1c",           name: "HbA1c",           unit: "%",            category: "Glicemia",
    labRange: { M: [4.0, 5.6], F: [4.0, 5.6] },
    refRange: { M: [4.5, 5.3], F: [4.5, 5.3] }, panel: "Padrão" },

  { id: "insulina_jejum",  name: "Insulina Jejum",  unit: "µU/mL",        category: "Glicemia",
    labRange: { M: [2.0, 25.0], F: [2.0, 25.0] },
    refRange: { M: [2.0, 5.0],  F: [2.0, 5.0]  }, panel: "Padrão" },

  { id: "homa_ir",         name: "HOMA-IR",         unit: "",             category: "Glicemia",
    labRange: { M: [0, 2.7], F: [0, 2.7] },
    refRange: { M: [0.5, 1.5], F: [0.5, 1.5] }, panel: "Padrão" },

  { id: "glicemia_media_estimada", name: "Glicemia Média Estimada", unit: "mg/dL", category: "Glicemia",
    labRange: { M: [70, 115], F: [70, 115] },
    refRange: { M: [70, 100], F: [70, 100] }, panel: "Padrão" },

  // ── Lipídios ──────────────────────────────────────────────────────────────
  { id: "colesterol_total", name: "Colesterol Total", unit: "mg/dL",      category: "Lipídios",
    labRange: { M: [0, 200], F: [0, 200] },
    refRange: { M: [150, 200], F: [150, 200] }, panel: "Adicional" },

  { id: "hdl",             name: "HDL",             unit: "mg/dL",        category: "Lipídios",
    labRange: { M: [40, 999], F: [50, 999] },
    refRange: { M: [55, 100], F: [60, 100] }, panel: "Padrão" },

  { id: "ldl",             name: "LDL",             unit: "mg/dL",        category: "Lipídios",
    labRange: { M: [0, 130], F: [0, 130] },
    refRange: { M: [0, 100], F: [0, 100] }, panel: "Padrão" },

  { id: "vldl",            name: "VLDL",            unit: "mg/dL",        category: "Lipídios",
    labRange: { M: [5, 40], F: [5, 40] },
    refRange: { M: [5, 20], F: [5, 20] }, panel: "Padrão" },

  { id: "triglicerides",   name: "Triglicerídeos",  unit: "mg/dL",        category: "Lipídios",
    labRange: { M: [0, 150], F: [0, 150] },
    refRange: { M: [50, 100], F: [50, 100] }, panel: "Padrão" },

  { id: "colesterol_nao_hdl", name: "Colesterol Não-HDL", unit: "mg/dL",  category: "Lipídios",
    labRange: { M: [0, 160], F: [0, 160] },
    refRange: { M: [0, 130], F: [0, 130] }, panel: "Adicional" },

  { id: "apo_a1",          name: "Apolipoproteína A-1", unit: "mg/dL",    category: "Lipídios",
    labRange: { M: [104, 202], F: [108, 225] },
    refRange: { M: [104, 202], F: [108, 225] }, panel: "Padrão" },

  { id: "apo_b",           name: "Apolipoproteína B", unit: "mg/dL",      category: "Lipídios",
    labRange: { M: [0, 100], F: [0, 100] },
    refRange: { M: [0, 90],  F: [0, 90]  }, panel: "Padrão" },

  { id: "lipoproteina_a",  name: "Lipoproteína (a)", unit: "nmol/L",      category: "Lipídios",
    labRange: { M: [0, 125], F: [0, 125] },
    refRange: { M: [0, 75],  F: [0, 75]  }, panel: "Padrão" },

  { id: "relacao_ct_hdl",  name: "CT/HDL",          unit: "",             category: "Lipídios",
    labRange: { M: [0, 5.0], F: [0, 4.5] },
    refRange: { M: [0, 3.5], F: [0, 3.5] }, panel: "Adicional" },

  { id: "relacao_tg_hdl",  name: "TG/HDL",          unit: "",             category: "Lipídios",
    labRange: { M: [0, 3.0], F: [0, 3.0] },
    refRange: { M: [0, 2.0], F: [0, 2.0] }, panel: "Adicional" },

  { id: "relacao_apob_apoa1", name: "ApoB/ApoA1",   unit: "",             category: "Lipídios",
    labRange: { M: [0, 0.90], F: [0, 0.80] },
    refRange: { M: [0, 0.70], F: [0, 0.70] }, panel: "Adicional" },

  // ── Tireoide ──────────────────────────────────────────────────────────────
  { id: "tsh",             name: "TSH",             unit: "mUI/L",        category: "Tireoide",
    labRange: { M: [0.27, 4.20], F: [0.27, 4.20] },
    refRange: { M: [1.0, 2.0],   F: [1.0, 2.0]   }, panel: "Padrão" },

  { id: "t4_livre",        name: "T4 Livre",        unit: "ng/dL",        category: "Tireoide",
    labRange: { M: [0.70, 1.80], F: [0.70, 1.80] },
    refRange: { M: [1.0, 1.5],   F: [1.0, 1.5]   }, panel: "Padrão" },

  { id: "t4_total",        name: "T4 Total",        unit: "µg/dL",        category: "Tireoide",
    labRange: { M: [5.1, 14.1], F: [5.1, 14.1] },
    refRange: { M: [6.0, 10.0], F: [6.0, 10.0] }, panel: "Adicional" },

  { id: "t3_livre",        name: "T3 Livre",        unit: "ng/dL",        category: "Tireoide",
    labRange: { M: [0.20, 0.44], F: [0.20, 0.44] },
    refRange: { M: [0.27, 0.42], F: [0.27, 0.42] }, panel: "Padrão" },

  { id: "t3_total",        name: "T3 Total",        unit: "ng/dL",        category: "Tireoide",
    labRange: { M: [80, 200], F: [80, 200] },
    refRange: { M: [80, 180], F: [80, 180] }, panel: "Padrão" },

  { id: "t3_reverso",      name: "T3 Reverso",      unit: "ng/dL",        category: "Tireoide",
    labRange: { M: [9, 27], F: [9, 27] },
    refRange: { M: [10, 20], F: [10, 20] }, panel: "Padrão" },

  { id: "anti_tpo",        name: "Anti-TPO",        unit: "UI/mL",        category: "Tireoide",
    labRange: { M: [0, 34], F: [0, 34] },
    refRange: { M: [0, 34], F: [0, 34] }, panel: "Padrão" },

  { id: "anti_tg",         name: "Anti-TG",         unit: "UI/mL",        category: "Tireoide",
    labRange: { M: [0, 1.3], F: [0, 1.3] },
    refRange: { M: [0, 1.3], F: [0, 1.3] }, panel: "Padrão" },

  { id: "trab",            name: "TRAb",            unit: "UI/L",         category: "Tireoide",
    labRange: { M: [0, 1.0], F: [0, 1.0] },
    refRange: { M: [0, 1.0], F: [0, 1.0] }, panel: "Padrão" },

  { id: "tiroglobulina",   name: "Tiroglobulina",   unit: "ng/mL",        category: "Tireoide",
    labRange: { M: [1.1, 130], F: [1.1, 130] },
    refRange: { M: [1.1, 130], F: [1.1, 130] }, panel: "Padrão" },

  // ── Hormônios ─────────────────────────────────────────────────────────────
  { id: "testosterona_total", name: "Testosterona Total", unit: "ng/dL",  category: "Hormônios",
    labRange: { M: [241, 827], F: [15, 70] },
    refRange: { M: [500, 900], F: [15, 70] }, panel: "Padrão" },

  { id: "testosterona_livre", name: "Testosterona Livre", unit: "ng/dL",  category: "Hormônios",
    labRange: { M: [3.0, 24.0], F: [0.06, 0.68] },
    refRange: { M: [5.0, 21.0], F: [0.10, 0.50] }, panel: "Padrão" },

  { id: "testosterona_biodisponivel", name: "Testosterona Biodisponível", unit: "ng/dL", category: "Hormônios",
    labRange: { M: [70, 250], F: [0.5, 8.5] },
    refRange: { M: [70, 250], F: [0.5, 8.5] }, panel: "Padrão" },

  { id: "estradiol",       name: "Estradiol",       unit: "pg/mL",        category: "Hormônios",
    labRange: { M: [10, 40], F: [12, 499] },
    refRange: { M: [20, 40], F: [12, 233] }, panel: "Padrão" },

  { id: "estrona",         name: "Estrona (E1)",    unit: "pg/mL",        category: "Hormônios",
    labRange: { M: [10, 60], F: [17, 200] },
    refRange: { M: [10, 60], F: [17, 200] }, panel: "Padrão" },

  { id: "progesterona",    name: "Progesterona",    unit: "ng/mL",        category: "Hormônios",
    labRange: { M: [0.1, 1.2], F: [0.1, 25.0] },
    refRange: { M: [0.2, 1.4], F: [5.0, 20.0] }, panel: "Padrão" },

  { id: "dhea_s",          name: "DHEA-S",          unit: "µg/dL",        category: "Hormônios",
    labRange: { M: [80, 560], F: [35, 430] },
    refRange: { M: [200, 450], F: [150, 350] }, panel: "Padrão" },

  { id: "cortisol",        name: "Cortisol (manhã)", unit: "µg/dL",       category: "Hormônios",
    labRange: { M: [6.2, 19.4], F: [6.2, 19.4] },
    refRange: { M: [10, 18],    F: [10, 18]    }, panel: "Padrão" },

  { id: "shbg",            name: "SHBG",            unit: "nmol/L",       category: "Hormônios",
    labRange: { M: [10, 57], F: [18, 144] },
    refRange: { M: [20, 50], F: [40, 120] }, panel: "Padrão" },

  { id: "fsh",             name: "FSH",             unit: "mUI/mL",       category: "Hormônios",
    labRange: { M: [1.5, 12.4], F: [3.5, 12.5] },
    refRange: { M: [1.5, 12.4], F: [3.5, 12.5] }, panel: "Padrão" },

  { id: "lh",              name: "LH",              unit: "mUI/mL",       category: "Hormônios",
    labRange: { M: [1.7, 8.6], F: [2.4, 12.6] },
    refRange: { M: [1.7, 8.6], F: [2.4, 12.6] }, panel: "Padrão" },

  { id: "prolactina",      name: "Prolactina",      unit: "ng/mL",        category: "Hormônios",
    labRange: { M: [2.1, 17.7], F: [2.8, 29.2] },
    refRange: { M: [4.0, 15.2], F: [4.8, 23.3] }, panel: "Padrão" },

  { id: "amh",             name: "AMH",             unit: "ng/mL",        category: "Hormônios",
    labRange: { M: [0.7, 19.0], F: [0.5, 6.0] },
    refRange: { M: [0.7, 19.0], F: [0.5, 6.0] }, panel: "Padrão" },

  // ── Eixo GH ───────────────────────────────────────────────────────────────
  { id: "igf1",            name: "IGF-1 (Somatomedina C)", unit: "ng/mL", category: "Eixo GH",
    labRange: { M: [88, 246], F: [88, 246] },
    refRange: { M: [115, 355], F: [115, 355] }, panel: "Padrão" },

  { id: "igfbp3",          name: "IGFBP-3",         unit: "µg/mL",        category: "Eixo GH",
    labRange: { M: [3.5, 7.6], F: [3.5, 7.6] },
    refRange: { M: [3.5, 7.6], F: [3.5, 7.6] }, panel: "Adicional" },

  // ── Eixo Adrenal ──────────────────────────────────────────────────────────
  { id: "acth",            name: "ACTH",            unit: "pg/mL",        category: "Eixo Adrenal",
    labRange: { M: [4.7, 48.8], F: [4.7, 48.8] },
    refRange: { M: [4.7, 48.8], F: [4.7, 48.8] }, panel: "Padrão" },

  { id: "cortisol_livre_urina", name: "Cortisol Livre (urina 24h)", unit: "µg/24h", category: "Eixo Adrenal",
    labRange: { M: [13, 85], F: [13, 85] },
    refRange: { M: [13, 85], F: [13, 85] }, panel: "Adicional" },

  { id: "aldosterona",     name: "Aldosterona",     unit: "ng/dL",        category: "Eixo Adrenal",
    labRange: { M: [2.5, 39.2], F: [2.5, 39.2] },
    refRange: { M: [2.5, 39.2], F: [2.5, 39.2] }, panel: "Adicional" },

  // ── Andrógenos ────────────────────────────────────────────────────────────
  { id: "dihidrotestosterona", name: "Dihidrotestosterona", unit: "pg/mL", category: "Andrógenos",
    labRange: { M: [250, 990], F: [16, 79] },
    refRange: { M: [160, 790], F: [0, 80]  }, panel: "Padrão" },

  { id: "androstenediona", name: "Androstenediona",  unit: "ng/dL",        category: "Andrógenos",
    labRange: { M: [45, 157], F: [39, 165] },
    refRange: { M: [45, 157], F: [39, 165] }, panel: "Padrão" },

  // ── Vitaminas ─────────────────────────────────────────────────────────────
  { id: "vitamina_d",      name: "Vitamina D (25-OH)", unit: "ng/mL",     category: "Vitaminas",
    labRange: { M: [20, 100], F: [20, 100] },
    refRange: { M: [50, 80],  F: [50, 80]  }, panel: "Padrão" },

  { id: "vitamina_d_125",  name: "1,25-Dihidroxi Vitamina D", unit: "pg/mL", category: "Vitaminas",
    labRange: { M: [19.9, 79.3], F: [19.9, 79.3] },
    refRange: { M: [19.9, 79.3], F: [19.9, 79.3] }, panel: "Padrão" },

  { id: "vitamina_b12",    name: "Vitamina B12",     unit: "pg/mL",        category: "Vitaminas",
    labRange: { M: [300, 9999], F: [300, 9999] },  // Ref. Lab.: "Normal: maior que 300 pg/mL" (sem limite superior)
    refRange: { M: [500, 1000], F: [500, 1000] }, panel: "Padrão" },

  { id: "acido_folico",    name: "Ácido Fólico",     unit: "ng/mL",        category: "Vitaminas",
    labRange: { M: [3.9, 9999], F: [3.9, 9999] },  // Ref. Lab.: "> 3,9 ng/mL" (sem limite superior)
    refRange: { M: [10, 25],    F: [10, 25]    }, panel: "Padrão" },

  { id: "vitamina_a",      name: "Vitamina A",       unit: "mg/L",         category: "Vitaminas",
    labRange: { M: [0.3, 0.7], F: [0.3, 0.7] },
    refRange: { M: [0.3, 0.7], F: [0.3, 0.7] }, panel: "Padrão" },

  { id: "vitamina_e",      name: "Vitamina E",       unit: "mg/L",         category: "Vitaminas",
    labRange: { M: [5, 20], F: [5, 20] },
    refRange: { M: [8, 15], F: [8, 15] }, panel: "Adicional" },

  { id: "vitamina_c",      name: "Vitamina C",       unit: "mg/dL",        category: "Vitaminas",
    labRange: { M: [0.4, 2.0], F: [0.4, 2.0] },
    refRange: { M: [0.6, 2.0], F: [0.6, 2.0] }, panel: "Padrão" },

  { id: "vitamina_b6",     name: "Vitamina B6",      unit: "ng/mL",        category: "Vitaminas",
    labRange: { M: [5, 50], F: [5, 50] },
    refRange: { M: [5, 30], F: [5, 30] }, panel: "Adicional" },

  { id: "vitamina_b1",     name: "Vitamina B1",      unit: "µg/dL",        category: "Vitaminas",
    labRange: { M: [2.5, 7.5], F: [2.5, 7.5] },
    refRange: { M: [2.5, 7.5], F: [2.5, 7.5] }, panel: "Adicional" },

  { id: "homocisteina",    name: "Homocisteína",     unit: "µmol/L",       category: "Vitaminas",
    labRange: { M: [5, 15], F: [5, 12] },
    refRange: { M: [5, 8],  F: [5, 8]  }, panel: "Padrão" },

  // ── Minerais ──────────────────────────────────────────────────────────────
  { id: "magnesio",        name: "Magnésio",         unit: "mg/dL",        category: "Minerais",
    labRange: { M: [1.6, 2.6], F: [1.6, 2.6] },
    refRange: { M: [2.0, 2.5], F: [2.0, 2.5] }, panel: "Adicional" },

  { id: "zinco",           name: "Zinco",            unit: "µg/dL",        category: "Minerais",
    labRange: { M: [60, 130], F: [60, 120] },
    refRange: { M: [80, 120], F: [75, 110] }, panel: "Padrão" },

  { id: "selenio",         name: "Selênio",          unit: "µg/L",         category: "Minerais",
    labRange: { M: [40, 160], F: [40, 160] },
    refRange: { M: [40, 160], F: [40, 160] }, panel: "Padrão" },

  { id: "cobre",           name: "Cobre",            unit: "µg/dL",        category: "Minerais",
    labRange: { M: [70, 140], F: [80, 155] },
    refRange: { M: [70, 140], F: [80, 155] }, panel: "Padrão" },

  { id: "manganes",        name: "Manganês",         unit: "µg/L",         category: "Minerais",
    labRange: { M: [4.7, 18.3], F: [4.7, 18.3] },
    refRange: { M: [4.7, 18.3], F: [4.7, 18.3] }, panel: "Adicional" },

  { id: "cromo",           name: "Cromo",            unit: "µg/L",         category: "Minerais",
    labRange: { M: [0.5, 2.0], F: [0.5, 2.0] },
    refRange: { M: [0.5, 2.0], F: [0.5, 2.0] }, panel: "Adicional" },

  { id: "iodo_urinario",   name: "Iodo Urinário",    unit: "µg/L",         category: "Minerais",
    labRange: { M: [100, 300], F: [100, 300] },
    refRange: { M: [100, 300], F: [100, 300] }, panel: "Adicional" },

  // ── Toxicologia ───────────────────────────────────────────────────────────
  { id: "chumbo",          name: "Chumbo",           unit: "µg/dL",        category: "Toxicologia",
    labRange: { M: [0, 5], F: [0, 5] },
    refRange: { M: [0, 5], F: [0, 5] }, panel: "Padrão" },

  { id: "mercurio",        name: "Mercúrio",         unit: "µg/L",         category: "Toxicologia",
    labRange: { M: [0, 5.9], F: [0, 5.9] },
    refRange: { M: [0, 5.9], F: [0, 5.9] }, panel: "Padrão" },

  { id: "cadmio",          name: "Cádmio",           unit: "µg/L",         category: "Toxicologia",
    labRange: { M: [0, 1.2], F: [0, 1.2] },
    refRange: { M: [0, 1.2], F: [0, 1.2] }, panel: "Adicional" },

  { id: "aluminio",        name: "Alumínio",         unit: "µg/L",         category: "Toxicologia",
    labRange: { M: [0, 10], F: [0, 10] },
    refRange: { M: [0, 10], F: [0, 10] }, panel: "Padrão" },

  { id: "cobalto",         name: "Cobalto",          unit: "µg/L",         category: "Toxicologia",
    labRange: { M: [0, 0.9], F: [0, 0.9] },
    refRange: { M: [0, 0.9], F: [0, 0.9] }, panel: "Adicional" },

  { id: "arsenico",        name: "Arsênico",         unit: "mcg/L",        category: "Toxicologia",
    labRange: { M: [0, 10], F: [0, 10] },
    refRange: { M: [0, 10], F: [0, 10] }, panel: "Adicional" },

  { id: "niquel",          name: "Níquel",           unit: "µg/L",         category: "Toxicologia",
    labRange: { M: [0, 2.5], F: [0, 2.5] },
    refRange: { M: [0, 2.5], F: [0, 2.5] }, panel: "Adicional" },

  // ── Hepático ──────────────────────────────────────────────────────────────
  { id: "tgo_ast",         name: "TGO (AST)",        unit: "U/L",          category: "Hepático",
    labRange: { M: [10, 40], F: [10, 32] },
    refRange: { M: [10, 26], F: [10, 25] }, panel: "Padrão" },

  { id: "tgp_alt",         name: "TGP (ALT)",        unit: "U/L",          category: "Hepático",
    labRange: { M: [7, 56], F: [7, 40] },
    refRange: { M: [10, 26], F: [10, 25] }, panel: "Padrão" },

  { id: "ggt",             name: "GGT",              unit: "U/L",          category: "Hepático",
    labRange: { M: [10, 71], F: [6, 42] },
    refRange: { M: [10, 30], F: [7, 25] }, panel: "Padrão" },

  { id: "fosfatase_alcalina", name: "Fosfatase Alcalina", unit: "U/L",     category: "Hepático",
    labRange: { M: [40, 130], F: [35, 105] },
    refRange: { M: [35, 85],  F: [35, 85]  }, panel: "Padrão" },

  { id: "bilirrubina_total", name: "Bilirrubina Total", unit: "mg/dL",     category: "Hepático",
    labRange: { M: [0.2, 1.1], F: [0.2, 1.1] },
    refRange: { M: [0.2, 1.0], F: [0.2, 1.0] }, panel: "Adicional" },

  { id: "bilirrubina_direta", name: "Bilirrubina Direta", unit: "mg/dL",   category: "Hepático",
    labRange: { M: [0.0, 0.3], F: [0.0, 0.3] },
    refRange: { M: [0.0, 0.3], F: [0.0, 0.3] }, panel: "Adicional" },

  { id: "bilirrubina_indireta", name: "Bilirrubina Indireta", unit: "mg/dL", category: "Hepático",
    labRange: { M: [0.0, 0.9], F: [0.0, 0.9] },
    refRange: { M: [0.0, 0.8], F: [0.0, 0.8] }, panel: "Adicional" },

  { id: "albumina",        name: "Albumina",         unit: "g/dL",         category: "Hepático",
    labRange: { M: [3.5, 5.2], F: [3.5, 5.2] },
    refRange: { M: [4.0, 5.0], F: [4.0, 5.0] }, panel: "Padrão" },

  { id: "proteinas_totais", name: "Proteínas Totais", unit: "g/dL",        category: "Hepático",
    labRange: { M: [6.0, 8.3], F: [6.0, 8.3] },
    refRange: { M: [6.5, 7.5], F: [6.5, 7.5] }, panel: "Adicional" },

  { id: "ldh",             name: "LDH",              unit: "U/L",          category: "Hepático",
    labRange: { M: [120, 246], F: [120, 246] },
    refRange: { M: [140, 200], F: [140, 200] }, panel: "Adicional" },

  // ── Renal ─────────────────────────────────────────────────────────────────
  { id: "creatinina",      name: "Creatinina",       unit: "mg/dL",        category: "Renal",
    labRange: { M: [0.7, 1.3], F: [0.5, 1.1] },
    refRange: { M: [0.8, 1.1], F: [0.6, 0.9] }, panel: "Padrão" },

  { id: "ureia",           name: "Ureia",            unit: "mg/dL",        category: "Renal",
    labRange: { M: [15, 40], F: [15, 40] },
    refRange: { M: [15, 25], F: [15, 25] }, panel: "Padrão" },

  { id: "acido_urico",     name: "Ácido Úrico",      unit: "mg/dL",        category: "Renal",
    labRange: { M: [3.4, 7.0], F: [2.4, 6.0] },
    refRange: { M: [3.5, 5.9], F: [2.5, 5.0] }, panel: "Padrão" },

  { id: "tfg",             name: "TFG (CKD-EPI)",   unit: "mL/min",       category: "Renal",
    labRange: { M: [60, 120], F: [60, 120] },
    refRange: { M: [90, 120], F: [90, 120] }, panel: "Adicional" },

  { id: "cistatina_c",     name: "Cistatina C",      unit: "mg/L",         category: "Renal",
    labRange: { M: [0.53, 0.95], F: [0.53, 0.95] },
    refRange: { M: [0.53, 0.95], F: [0.53, 0.95] }, panel: "Adicional" },

  // ── Eletrólitos ───────────────────────────────────────────────────────────
  { id: "sodio",           name: "Sódio",            unit: "mEq/L",        category: "Eletrólitos",
    labRange: { M: [136, 145], F: [136, 145] },
    refRange: { M: [138, 142], F: [138, 142] }, panel: "Padrão" },

  { id: "potassio",        name: "Potássio",         unit: "mEq/L",        category: "Eletrólitos",
    labRange: { M: [3.5, 5.1], F: [3.5, 5.1] },
    refRange: { M: [4.0, 4.5], F: [4.0, 4.5] }, panel: "Padrão" },

  { id: "calcio_total",    name: "Cálcio Total",     unit: "mg/dL",        category: "Eletrólitos",
    labRange: { M: [8.6, 10.3], F: [8.6, 10.3] },
    refRange: { M: [9.4, 10.2], F: [9.4, 10.2] }, panel: "Padrão" },

  { id: "calcio_ionico",   name: "Cálcio Iônico",   unit: "mmol/L",       category: "Eletrólitos",
    labRange: { M: [1.10, 1.40], F: [1.10, 1.40] },
    refRange: { M: [1.10, 1.35], F: [1.10, 1.35] }, panel: "Padrão" },

  { id: "fosforo",         name: "Fósforo",          unit: "mg/dL",        category: "Eletrólitos",
    labRange: { M: [2.5, 4.5], F: [2.5, 4.5] },
    refRange: { M: [3.0, 4.0], F: [3.0, 4.0] }, panel: "Adicional" },

  { id: "cloro",           name: "Cloro",            unit: "mEq/L",        category: "Eletrólitos",
    labRange: { M: [98, 107], F: [98, 107] },
    refRange: { M: [100, 106], F: [100, 106] }, panel: "Adicional" },

  { id: "bicarbonato",     name: "Bicarbonato",      unit: "mEq/L",        category: "Eletrólitos",
    labRange: { M: [22, 29], F: [22, 29] },
    refRange: { M: [22, 26], F: [22, 26] }, panel: "Adicional" },

  { id: "pth",             name: "PTH",              unit: "pg/mL",        category: "Eletrólitos",
    labRange: { M: [15, 65], F: [15, 65] },
    refRange: { M: [15, 50], F: [15, 50] }, panel: "Padrão" },

  { id: "calcitonina",     name: "Calcitonina",      unit: "pg/mL",        category: "Eletrólitos",
    labRange: { M: [0, 11.5], F: [0, 4.6] },
    refRange: { M: [0, 8.4],  F: [0, 5.0]  }, panel: "Adicional" },

  // ── Coagulação ────────────────────────────────────────────────────────────
  { id: "fibrinogenio",    name: "Fibrinogênio",     unit: "mg/dL",        category: "Coagulação",
    labRange: { M: [200, 400], F: [200, 400] },
    refRange: { M: [200, 400], F: [200, 400] }, panel: "Padrão" },

  { id: "dimeros_d",       name: "Dímeros D",        unit: "ng/mL",        category: "Coagulação",
    labRange: { M: [0, 500], F: [0, 500] },
    refRange: { M: [0, 500], F: [0, 500] }, panel: "Adicional" },

  // ── Pancreático ───────────────────────────────────────────────────────────
  { id: "amilase",         name: "Amilase",          unit: "U/L",          category: "Pancreático",
    labRange: { M: [28, 100], F: [28, 100] },
    refRange: { M: [28, 100], F: [28, 100] }, panel: "Padrão" },

  { id: "lipase",          name: "Lipase",           unit: "U/L",          category: "Pancreático",
    labRange: { M: [13, 60], F: [13, 60] },
    refRange: { M: [13, 60], F: [13, 60] }, panel: "Padrão" },

  // ── Imunologia ────────────────────────────────────────────────────────────
  { id: "fan",             name: "FAN (Fator Anti-Núcleo)", unit: "",      category: "Imunologia",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "fator_reumatoide", name: "Fator Reumatoide", unit: "UI/mL",      category: "Imunologia",
    labRange: { M: [0, 14], F: [0, 14] },
    refRange: { M: [0, 14], F: [0, 14] }, panel: "Adicional" },

  { id: "anti_endomisio_iga", name: "Anti-Endomísio IgA", unit: "",       category: "Imunologia",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "anti_transglutaminase_iga", name: "Anti-Transglutaminase IgA", unit: "U", category: "Imunologia",
    labRange: { M: [0, 20], F: [0, 20] },
    refRange: { M: [0, 20], F: [0, 20] }, panel: "Padrão" },

  { id: "g6pd",            name: "G6PD (Glicose-6-Fosfato Desidrogenase)", unit: "U/g Hb", category: "Imunologia",
    labRange: { M: [6.7, 999], F: [6.7, 999] },
    refRange: { M: [6.7, 999], F: [6.7, 999] }, panel: "Adicional" },

  // ── Sorologia Infecciosa ──────────────────────────────────────────────────
  { id: "hiv",             name: "HIV 1/2 (Anticorpos e Antígeno)", unit: "", category: "Sorologia",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "hbsag",           name: "HBsAg (Antígeno Austrália)", unit: "",  category: "Sorologia",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "anti_hbs",        name: "Anti-HBs (Hepatite B)", unit: "UI/L",  category: "Sorologia",
    labRange: { M: [10, 999], F: [10, 999] },
    refRange: { M: [10, 999], F: [10, 999] }, panel: "Adicional" },

  { id: "anti_hbc_total",  name: "Anti-HBc Total (Hepatite B)", unit: "", category: "Sorologia",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "anti_hcv",        name: "Anti-HCV (Hepatite C)", unit: "",       category: "Sorologia",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "sifilis_treponemico", name: "Sífilis (Anti-T. Pallidum)", unit: "", category: "Sorologia",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "sifilis_vdrl",    name: "Sífilis VDRL (Cardiolipina)", unit: "", category: "Sorologia",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "toxoplasma_igg",  name: "Toxoplasma IgG",  unit: "UI/mL",        category: "Sorologia",
    labRange: { M: [0, 1.6], F: [0, 1.6] },
    refRange: { M: [0, 1.6], F: [0, 1.6] }, panel: "Adicional" },

  { id: "toxoplasma_igm",  name: "Toxoplasma IgM",  unit: "",             category: "Sorologia",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "vzv_igg",         name: "Varicella-Zoster IgG", unit: "mIU/mL", category: "Sorologia",
    labRange: { M: [165, 999999], F: [165, 999999] },
    refRange: { M: [165, 999999], F: [165, 999999] }, panel: "Adicional" },

  { id: "vzv_igm",         name: "Varicella-Zoster IgM", unit: "",        category: "Sorologia",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "hsv_igm",         name: "Herpes Simplex 1+2 IgM", unit: "",      category: "Sorologia",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "hsv1_igg",        name: "Herpes Simplex 1 IgG", unit: "",        category: "Sorologia",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "hsv2_igg",        name: "Herpes Simplex 2 IgG", unit: "",        category: "Sorologia",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  // ── Proteínas (Eletroforese) ──────────────────────────────────────────────
  { id: "eletroforese_albumina", name: "Albumina (eletroforese)", unit: "%", category: "Proteínas",
    labRange: { M: [55.1, 65.7], F: [55.1, 65.7] },
    refRange: { M: [55.1, 65.7], F: [55.1, 65.7] }, panel: "Adicional" },

  { id: "eletroforese_alfa1", name: "Alfa 1", unit: "%",                  category: "Proteínas",
    labRange: { M: [3.1, 5.6], F: [3.1, 5.6] },
    refRange: { M: [3.1, 5.6], F: [3.1, 5.6] }, panel: "Adicional" },

  { id: "eletroforese_alfa2", name: "Alfa 2", unit: "%",                  category: "Proteínas",
    labRange: { M: [8.0, 12.7], F: [8.0, 12.7] },
    refRange: { M: [8.0, 12.7], F: [8.0, 12.7] }, panel: "Adicional" },

  { id: "eletroforese_beta1", name: "Beta 1", unit: "%",                  category: "Proteínas",
    labRange: { M: [4.9, 7.2], F: [4.9, 7.2] },
    refRange: { M: [4.9, 7.2], F: [4.9, 7.2] }, panel: "Adicional" },

  { id: "eletroforese_beta2", name: "Beta 2", unit: "%",                  category: "Proteínas",
    labRange: { M: [3.1, 6.1], F: [3.1, 6.1] },
    refRange: { M: [3.1, 6.1], F: [3.1, 6.1] }, panel: "Adicional" },

  { id: "eletroforese_gama", name: "Gama", unit: "%",                     category: "Proteínas",
    labRange: { M: [10.3, 18.2], F: [10.3, 18.2] },
    refRange: { M: [10.3, 18.2], F: [10.3, 18.2] }, panel: "Adicional" },

  { id: "relacao_ag",      name: "Relação A/G",      unit: "",             category: "Proteínas",
    labRange: { M: [1.2, 2.5], F: [1.2, 2.5] },
    refRange: { M: [1.5, 2.5], F: [1.5, 2.5] }, panel: "Adicional" },

  // ── Marcadores Tumorais ───────────────────────────────────────────────────
  { id: "ca_19_9",         name: "CA 19-9",          unit: "U/mL",         category: "Marcadores Tumorais",
    labRange: { M: [0, 37], F: [0, 37] },
    refRange: { M: [0, 37], F: [0, 37] }, panel: "Adicional" },

  { id: "ca_125",          name: "CA-125",           unit: "U/mL",         category: "Marcadores Tumorais",
    labRange: { M: [0, 35], F: [0, 35] },
    refRange: { M: [0, 35], F: [0, 35] }, panel: "Adicional" },

  { id: "ca_72_4",         name: "CA 72-4",          unit: "U/mL",         category: "Marcadores Tumorais",
    labRange: { M: [0, 6.9], F: [0, 6.9] },
    refRange: { M: [0, 6.9], F: [0, 6.9] }, panel: "Adicional" },

  { id: "ca_15_3",         name: "CA 15-3",          unit: "U/mL",         category: "Marcadores Tumorais",
    labRange: { M: [0, 25], F: [0, 25] },
    refRange: { M: [0, 25], F: [0, 25] }, panel: "Adicional" },

  { id: "afp",             name: "AFP",              unit: "ng/mL",        category: "Marcadores Tumorais",
    labRange: { M: [0, 7.0], F: [0, 7.0] },
    refRange: { M: [0, 7.0], F: [0, 7.0] }, panel: "Adicional" },

  { id: "cea",             name: "CEA",              unit: "ng/mL",        category: "Marcadores Tumorais",
    labRange: { M: [0, 3.0], F: [0, 3.0] },
    refRange: { M: [0, 3.0], F: [0, 3.0] }, panel: "Adicional" },

  // ── Urina Tipo 1 ──────────────────────────────────────────────────────────
  { id: "urina_cor",       name: "Cor",              unit: "",             category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "urina_aspecto",   name: "Aspecto",          unit: "",             category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "urina_densidade", name: "Densidade",        unit: "",             category: "Urina",
    labRange: { M: [1.005, 1.030], F: [1.005, 1.030] },
    refRange: { M: [1.005, 1.030], F: [1.005, 1.030] }, panel: "Padrão" },

  { id: "urina_ph",        name: "pH Urinário",      unit: "",             category: "Urina",
    labRange: { M: [5.0, 8.0], F: [5.0, 8.0] },
    refRange: { M: [5.0, 7.0], F: [5.0, 7.0] }, panel: "Padrão" },

  { id: "urina_proteinas", name: "Proteínas (urina)", unit: "",            category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "urina_glicose",   name: "Glicose (urina)",  unit: "",             category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "urina_hemoglobina", name: "Hemoglobina (urina)", unit: "",        category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "urina_leucocitos", name: "Leucócitos (urina)", unit: "/campo",    category: "Urina",
    labRange: { M: [0, 5], F: [0, 5] }, refRange: { M: [0, 5], F: [0, 5] }, qualitative: true, panel: "Padrão" },

  { id: "urina_leucocitos_quant", name: "Leucócitos (urina quantitativo)", unit: "/mL", category: "Urina",
    labRange: { M: [0, 10000], F: [0, 10000] },
    refRange: { M: [0, 10000], F: [0, 10000] }, panel: "Padrão" },

  { id: "urina_hemacias",  name: "Hemácias (urina)", unit: "/campo",       category: "Urina",
    labRange: { M: [0, 3], F: [0, 3] }, refRange: { M: [0, 3], F: [0, 3] }, qualitative: true, panel: "Padrão" },

  { id: "urina_hemacias_quant", name: "Hemácias (urina quantitativo)", unit: "/mL", category: "Urina",
    labRange: { M: [0, 10000], F: [0, 10000] },
    refRange: { M: [0, 10000], F: [0, 10000] }, panel: "Padrão" },

  { id: "urina_bacterias", name: "Bactérias (urina)", unit: "",            category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "urina_celulas",   name: "Células Epiteliais", unit: "",           category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "urina_cilindros", name: "Cilindros",         unit: "",             category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "urina_cristais",  name: "Cristais",          unit: "",             category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "urina_nitritos",  name: "Nitritos",          unit: "",             category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "urina_bilirrubina", name: "Bilirrubina (urina)", unit: "",        category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "urina_urobilinogenio", name: "Urobilinogênio", unit: "",          category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "urina_cetona",    name: "Cetonas",           unit: "",             category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "urina_muco",      name: "Muco/Filamentos (urina)", unit: "",      category: "Urina",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "urina_albumina",  name: "Albumina (urina)", unit: "mg/L",         category: "Urina",
    labRange: { M: [0, 20], F: [0, 20] },
    refRange: { M: [0, 20], F: [0, 20] }, panel: "Padrão" },

  { id: "urina_creatinina", name: "Creatinina (urina)", unit: "mg/dL",    category: "Urina",
    labRange: { M: [50, 300], F: [50, 300] },
    refRange: { M: [50, 300], F: [50, 300] }, panel: "Padrão" },

  { id: "urina_acr",       name: "Razão Albumina/Creatinina", unit: "mg/g", category: "Urina",
    labRange: { M: [0, 30], F: [0, 30] },
    refRange: { M: [0, 30], F: [0, 30] }, panel: "Padrão" },

  // ── Coprológico Funcional ─────────────────────────────────────────────────
  { id: "copro_cor",       name: "Cor (fezes)",       unit: "",             category: "Fezes",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "copro_consistencia", name: "Consistência",   unit: "",             category: "Fezes",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "copro_muco",      name: "Muco",              unit: "",             category: "Fezes",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "copro_sangue",    name: "Sangue Oculto",     unit: "",             category: "Fezes",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "copro_leucocitos", name: "Leucócitos (fezes)", unit: "",           category: "Fezes",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "copro_hemacias",  name: "Hemácias (fezes)",  unit: "",             category: "Fezes",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "copro_parasitas", name: "Parasitas",         unit: "",             category: "Fezes",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "copro_gordura",   name: "Gordura Fecal",     unit: "",             category: "Fezes",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "copro_gordura_quant", name: "Gordura Fecal (%)", unit: "%",        category: "Fezes",
    labRange: { M: [0, 5], F: [0, 5] },
    refRange: { M: [0, 5], F: [0, 5] }, panel: "Padrão" },

  { id: "copro_fibras",    name: "Fibras Musculares", unit: "",             category: "Fezes",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "copro_amido",     name: "Amido",             unit: "",             category: "Fezes",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Padrão" },

  { id: "copro_residuos",  name: "Resíduos Alimentares", unit: "",          category: "Fezes",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "copro_ac_graxos", name: "Ácidos Graxos",     unit: "",             category: "Fezes",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "copro_flora",     name: "Flora Bacteriana",  unit: "",             category: "Fezes",
    labRange: { M: [0, 0], F: [0, 0] }, refRange: { M: [0, 0], F: [0, 0] }, qualitative: true, panel: "Adicional" },

  { id: "copro_ph",        name: "pH Fecal",          unit: "",             category: "Fezes",
    labRange: { M: [6.0, 7.5], F: [6.0, 7.5] },
    refRange: { M: [6.0, 7.5], F: [6.0, 7.5] }, panel: "Adicional" },

  // ── PSA ───────────────────────────────────────────────────────────────────
  { id: "psa_total",       name: "PSA Total",         unit: "ng/mL",        category: "Hormônios",
    labRange: { M: [0, 4.0], F: [0, 0] },
    refRange: { M: [0, 2.5], F: [0, 0] }, panel: "Padrão" },

  { id: "psa_livre",       name: "PSA Livre",         unit: "ng/mL",        category: "Hormônios",
    labRange: { M: [0, 0.5], F: [0, 0] },
    refRange: { M: [0, 0.5], F: [0, 0] }, panel: "Adicional" },

  { id: "psa_relacao",     name: "PSA Livre/Total (%)", unit: "%",          category: "Hormônios",
    labRange: { M: [25, 100], F: [0, 0] },
    refRange: { M: [25, 100], F: [0, 0] }, panel: "Adicional" },
];

/**
 * Determine marker status using the CONVENTIONAL LAB reference range (labRange).
 * The functional range (refRange) is only used as descriptive information.
 *
 * - operator "<": if the numeric value <= upper lab limit, classify as "normal"
 * - operator ">": if the numeric value >= lower lab limit, classify as "high"
 */
export function getMarkerStatus(value: number, marker: MarkerDef, sex: "M" | "F", operator?: string): "normal" | "low" | "high" {
  const [min, max] = marker.labRange[sex];
  if (operator === "<" || operator === "<=") {
    if (value <= max) return "normal";
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
  const match = textValue.match(/^([<>≤≥]=?)\s*(\d+[.,]?\d*)/);
  if (!match) return null;
  // Normalize Unicode operators to ASCII
  let op = match[1];
  if (op === "≤") op = "<=";
  else if (op === "≥") op = ">=";
  return {
    operator: op,
    numericValue: parseFloat(match[2].replace(",", ".")),
  };
}

// ─── Re-export do parser para uso externo ────────────────────────────
export { parseLabReference, type ParsedReference };

/**
 * Resolve qual referência usar para cálculo de status.
 *
 * Regra (pedido médico):
 *   1. Se há lab_ref_text do laudo, parse e usa como referência laboratorial específica.
 *      Porém, valida sanity bounds: se o range extraído for incompatível com labRange
 *      (diferença > 20x), descarta e usa labRange como fallback seguro.
 *   2. Caso contrário, usa labRange (referência laboratorial convencional SBPC/ML).
 *   3. refRange (funcional) é apenas informativo — nunca usado para status/cores.
 */
export function resolveReference(
  marker: MarkerDef,
  sex: 'M' | 'F',
  labRefText?: string,
  _labUnit?: string,
): { min: number | null; max: number | null; operator: string; source: 'functional' | 'lab' } {
  // Se há texto de referência do laudo, usar ele (mais específico)
  if (labRefText) {
    // Descartar textos descritivos que contêm referências etárias/contextuais
    // (ex: "Maior ou igual a 20 anos:", "Mulheres: até 63 ng/dL", "Fase Folicular: até 12,0")
    // Esses textos não representam o range do valor do exame, mas sim contexto clínico
    const isAgeOrContextualText = /\banos\b|\bidade\b/i.test(labRefText);
    if (isAgeOrContextualText) {
      const [labMin, labMax] = marker.labRange[sex];
      return { min: labMin, max: labMax, operator: 'range', source: 'lab' };
    }
    const labParsed = parseLabReference(labRefText, sex);
    if (labParsed.min !== null || labParsed.max !== null) {
      // Validação de sanity bounds: comparar com labRange esperado
      const [labMin, labMax] = marker.labRange[sex];
      const parsedMin = labParsed.min ?? labParsed.max ?? 0;
      const parsedMax = labParsed.max ?? labParsed.min ?? 0;
      const expectedMid = (labMin + labMax) / 2;
      const parsedMid = (parsedMin + parsedMax) / 2;
      // Se o valor médio parseado for mais de 20x diferente do labRange esperado, descartar
      const ratio = expectedMid > 0 && parsedMid > 0
        ? Math.max(expectedMid / parsedMid, parsedMid / expectedMid)
        : 1;
      if (ratio <= 20) {
        return {
          min: labParsed.min,
          max: labParsed.max,
          operator: labParsed.operator,
          source: 'lab',
        };
      }
      // Sanity check falhou: lab_ref_text incompatível com unidade esperada, usar labRange
      console.warn(
        `[resolveReference] Descartando lab_ref_text "${labRefText}" para ${marker.id}: ` +
        `ratio=${ratio.toFixed(1)}x vs labRange [${labMin}, ${labMax}]. Usando labRange padrão.`
      );
    }
  }

  // Padrão: usar labRange (referência laboratorial convencional)
  const [labMin, labMax] = marker.labRange[sex];
  return { min: labMin, max: labMax, operator: 'range', source: 'lab' };
}

/**
 * Calcula status a partir de uma referência resolvida (com suporte a operadores).
 * Complementa getMarkerStatus para contextos com dados de referência laboratorial.
 */
export function getMarkerStatusFromRef(
  value: number,
  ref: { min: number | null; max: number | null; operator: string },
): 'normal' | 'low' | 'high' {
  const { min, max, operator } = ref;

  if (operator === '<' || operator === '<=') {
    // When a lab report says "< X" or "<= X", the stored numeric value equals the detection
    // limit (e.g. "< 34" is stored as 34). Use inclusive comparison so that a value equal
    // to the limit is still classified as normal.
    return value <= (max ?? Infinity) ? 'normal' : 'high';
  }
  if (operator === '>' || operator === '>=') {
    // Similarly, "> X" or ">= X" stored as X should be normal.
    return value >= (min ?? -Infinity) ? 'normal' : 'low';
  }

  // operator === 'range' ou qualquer outro
  if (min !== null && value < min) return 'low';
  if (max !== null && value > max) return 'high';
  return 'normal';
}
