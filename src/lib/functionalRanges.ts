/**
 * functionalRanges.ts
 *
 * Referências funcionais (medicina funcional / integrativa) para marcadores laboratoriais.
 * Camada paralela — NÃO sobrescreve labRange, lab_ref_text, lab_ref_min ou lab_ref_max.
 * Usada exclusivamente na exportação Excel evolutivo.
 *
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║  FONTE DE VERDADE ÚNICA:                                           ║
 * ║  IFM_final_2.xlsx                                                  ║
 * ║  Planilhas anteriores são apenas referência histórica.             ║
 * ║  Se o XLSX deixa um campo em branco, ele fica em branco aqui.      ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 *
 * Estrutura:
 *   - marker_id: deve coincidir com MARKERS[].id
 *   - range: { M: [min, max], F: [min, max] }
 *   - unit: unidade da faixa funcional (pode diferir da canônica do marcador)
 *
 * Sentinel [0, 9999] = "sem referência para este sexo" → resolveFunctionalRef retorna null.
 *
 * Baseline congelada: .lovable/functional-ranges-baseline.md
 */

/**
 * Versão da baseline de referências funcionais.
 * Alterar SOMENTE quando o XLSX canônico for atualizado.
 * Documentar a mudança em .lovable/functional-ranges-baseline.md e CHANGELOG.md.
 */
export const FUNCTIONAL_RANGES_VERSION = "FUNC_REF_V3_IFM_FINAL2_2026_03_16";

export interface FunctionalRange {
  marker_id: string;
  range: { M: [number, number]; F: [number, number] };
  /** Unidade em que a faixa funcional está expressa */
  unit: string;
}

/**
 * Tabela de referências funcionais.
 * Fonte ÚNICA: IFM_final_2.xlsx
 */
export const FUNCTIONAL_RANGES: FunctionalRange[] = [
  // ═══════════════════════════════════════════════════════════════════
  // HEMOGRAMA  (IFM_final_2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "hemoglobina",     range: { M: [13.5, 17.5], F: [12, 15.5] },     unit: "g/dL" },
  { marker_id: "hematocrito",     range: { M: [40, 50], F: [35, 45] },           unit: "%" },
  { marker_id: "vcm",             range: { M: [85, 95], F: [85, 95] },           unit: "fL" },
  { marker_id: "hcm",             range: { M: [26, 34], F: [26, 34] },           unit: "pg" },
  { marker_id: "chcm",            range: { M: [31, 36], F: [31, 36] },           unit: "g/dL" },
  { marker_id: "rdw",             range: { M: [10, 14], F: [10, 14] },           unit: "%" },  // IFM: was 13
  { marker_id: "leucocitos",      range: { M: [3500, 6500], F: [3500, 6500] },   unit: "/mm³" },
  { marker_id: "neutrofilos",     range: { M: [45, 55], F: [45, 55] },           unit: "%" },
  { marker_id: "linfocitos",      range: { M: [25, 35], F: [25, 35] },           unit: "%" },
  { marker_id: "monocitos",       range: { M: [3, 8], F: [3, 8] },               unit: "%" },
  { marker_id: "eosinofilos",     range: { M: [0, 3], F: [0, 3] },               unit: "%" },
  { marker_id: "basofilos",       range: { M: [0, 1], F: [0, 1] },               unit: "%" },
  { marker_id: "plaquetas",       range: { M: [150000, 300000], F: [150000, 300000] }, unit: "/mm³" },

  // ═══════════════════════════════════════════════════════════════════
  // FERRO E METABOLISMO  (IFM_final_2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "ferritina",       range: { M: [70, 200], F: [50, 150] },         unit: "ng/mL" },
  { marker_id: "ferro_serico",    range: { M: [80, 120], F: [80, 120] },         unit: "mcg/dL" },
  { marker_id: "sat_transferrina", range: { M: [20, 50], F: [20, 50] },          unit: "%" },
  { marker_id: "tibc",            range: { M: [300, 400], F: [300, 400] },       unit: "mcg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // GLICEMIA E METABOLISMO  (IFM_final_2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "glicose_jejum",   range: { M: [75, 90], F: [75, 90] },           unit: "mg/dL" },
  { marker_id: "hba1c",           range: { M: [0, 5.5], F: [0, 5.5] },           unit: "%" },  // IFM: <5,5
  { marker_id: "insulina_jejum",  range: { M: [0, 7], F: [0, 7] },               unit: "µIU/mL" },
  { marker_id: "homa_ir",         range: { M: [0, 1.5], F: [0, 1.5] },           unit: "" },
  { marker_id: "homa_beta",       range: { M: [167, 175], F: [167, 175] },       unit: "%" },
  { marker_id: "peptideo_c",      range: { M: [1.5, 3.0], F: [1.5, 3.0] },       unit: "ng/mL" },

  // ═══════════════════════════════════════════════════════════════════
  // PERFIL LIPÍDICO  (IFM_final_2)
  // ═══════════════════════════════════════════════════════════════════
  // colesterol_total: removido intencionalmente — sem referência funcional por decisão clínica (Blank is Blank)
  { marker_id: "hdl",             range: { M: [40, 9999], F: [46, 9999] },       unit: "mg/dL" },
  { marker_id: "ldl",             range: { M: [0, 115], F: [0, 115] },           unit: "mg/dL" },
  { marker_id: "vldl",            range: { M: [0, 15], F: [0, 15] },             unit: "mg/dL" },
  { marker_id: "triglicerides",   range: { M: [0, 100], F: [0, 100] },           unit: "mg/dL" },
  { marker_id: "apo_a1",          range: { M: [120, 9999], F: [120, 9999] },     unit: "mg/dL" },
  { marker_id: "apo_b",           range: { M: [0, 100], F: [0, 100] },           unit: "mg/dL" },
  { marker_id: "lipoproteina_a",  range: { M: [0, 30], F: [0, 30] },             unit: "nmol/L" },
  { marker_id: "amilase",         range: { M: [28, 110], F: [28, 110] },         unit: "U/L" },  // IFM: was 30
  { marker_id: "lipase",          range: { M: [0, 80], F: [0, 80] },             unit: "U/L" },

  // ── Relações lipídicas (IFM_final_2) ──
  { marker_id: "relacao_ct_hdl",  range: { M: [0, 3.5], F: [0, 3.5] },           unit: "" },
  { marker_id: "relacao_tg_hdl",  range: { M: [0, 2.0], F: [0, 2.0] },           unit: "" },
  { marker_id: "relacao_apob_apoa1", range: { M: [0, 0.89], F: [0, 0.99] },      unit: "" },  // IFM: F<0.99, M<0.89

  // ═══════════════════════════════════════════════════════════════════
  // INFLAMAÇÃO E RISCO CARDIOVASCULAR  (IFM_final_2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "homocisteina",    range: { M: [0, 8], F: [0, 8] },               unit: "µmol/L" },  // IFM: was 7
  { marker_id: "pcr",             range: { M: [0, 1.1], F: [0, 1.1] },           unit: "mg/L" },    // IFM: was 1.0
  { marker_id: "fibrinogenio",    range: { M: [0, 300], F: [0, 300] },           unit: "mg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // FUNÇÃO HEPÁTICA  (IFM_final_2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "ggt",             range: { M: [0, 35], F: [0, 35] },             unit: "U/L" },
  { marker_id: "tgp_alt",         range: { M: [0, 35], F: [0, 31] },             unit: "U/L" },  // IFM: M<35, F<31
  { marker_id: "tgo_ast",         range: { M: [0, 36], F: [0, 36] },             unit: "U/L" },
  { marker_id: "fosfatase_alcalina", range: { M: [40, 129], F: [40, 129] },      unit: "U/L" },
  { marker_id: "albumina",        range: { M: [4.0, 5.0], F: [4.0, 5.0] },       unit: "g/dL" },
  { marker_id: "proteinas_totais", range: { M: [6.9, 7.4], F: [6.9, 7.4] },     unit: "g/dL" },
  // TGO/TGP ratio: IFM diz ">0.8 e <2" — é calculada, não referência contínua simples
  // Implementada como relacao_tgo_tgp
  { marker_id: "relacao_tgo_tgp", range: { M: [0.8, 2.0], F: [0.8, 2.0] },       unit: "" },

  // ═══════════════════════════════════════════════════════════════════
  // FUNÇÃO RENAL  (IFM_final_2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "ureia",           range: { M: [13, 25], F: [13, 25] },           unit: "mg/dL" },
  { marker_id: "creatinina",      range: { M: [0.7, 1.1], F: [0.7, 1.1] },       unit: "mg/dL" },
  { marker_id: "acido_urico",     range: { M: [0, 5.5], F: [0, 5.5] },           unit: "mg/dL" },
  { marker_id: "relacao_ureia_creatinina", range: { M: [10, 20], F: [10, 20] },   unit: "" },

  // ═══════════════════════════════════════════════════════════════════
  // TIREOIDE  (IFM_final_2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "tsh",             range: { M: [0.3, 2.5], F: [0.3, 2.5] },       unit: "µIU/mL" },
  { marker_id: "t4_livre",        range: { M: [0.9, 1.5], F: [0.9, 1.5] },       unit: "ng/dL" },
  { marker_id: "t3_livre",        range: { M: [2.3, 4.2], F: [2.3, 4.2] },       unit: "pg/mL" },
  { marker_id: "t3_reverso",      range: { M: [8, 25], F: [8, 25] },             unit: "ng/dL" },  // IFM_final_2: "8-25 ng/dL ou 0,06-0,26 ng/mL"
  // IFM agora traz cutoffs numéricos para Anti-TPO, Anti-TG e TRAb:
  { marker_id: "anti_tpo",        range: { M: [0, 35], F: [0, 35] },             unit: "IU/mL" },  // IFM: <35
  { marker_id: "anti_tg",         range: { M: [0, 40], F: [0, 40] },             unit: "IU/mL" },  // IFM: <40
  { marker_id: "trab",            range: { M: [0, 1.75], F: [0, 1.75] },         unit: "IU/L" },   // IFM: <1.75
  { marker_id: "relacao_t3t_t3r", range: { M: [0, 0.6], F: [0, 0.6] },           unit: "" },
  { marker_id: "relacao_t3l_t4l", range: { M: [0.33, 9999], F: [0.33, 9999] },   unit: "" },  // IFM: >0.33
  { marker_id: "tireoglobulina",  range: { M: [10, 15], F: [10, 15] },           unit: "ng/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // HORMÔNIOS FEMININOS  (IFM_final_2)
  // Marcadores com "—" na coluna masculina → sentinel [0, 9999] para M
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "testosterona_total", range: { M: [600, 1000], F: [25, 50] },     unit: "ng/dL" },  // IFM M: was 900
  { marker_id: "testosterona_livre", range: { M: [6.6, 19.1], F: [1.1, 2.2] },   unit: "pg/mL" },  // IFM M: ">470 ou 6.6-19.1" — mantém range
  { marker_id: "shbg",            range: { M: [10, 57], F: [50, 120] },           unit: "nmol/L" },  // IFM: M agora tem ref; F atualizado
  { marker_id: "dhea_s",          range: { M: [0, 9999], F: [0, 9999] },         unit: "µg/dL" },  // IFM: ambos em branco
  // Estradiol: F em branco (sem fase); M=1.1–4.3 ng/dL
  { marker_id: "estradiol",       range: { M: [1.1, 4.3], F: [0, 9999] },         unit: "ng/dL" },
  { marker_id: "prolactina",      range: { M: [0, 30], F: [0, 30] },             unit: "ng/mL" },
  // DHT: IFM traz F<46 ng/dL, M 25-99 ng/dL (ou 250-990 pg/mL)
  { marker_id: "dihidrotestosterona", range: { M: [25, 99], F: [0, 46] },         unit: "ng/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // HORMÔNIOS MASCULINOS  (IFM_final_2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "fsh",             range: { M: [0, 10], F: [0, 9999] },           unit: "mUI/mL" },  // IFM F: sem ref (fase-dependente)
  { marker_id: "lh",              range: { M: [0, 9], F: [0, 9999] },             unit: "mUI/mL" },  // IFM F: sem ref
  { marker_id: "psa_total",       range: { M: [0, 2.5], F: [0, 9999] },           unit: "ng/mL" },
  { marker_id: "psa_livre_total", range: { M: [0, 25], F: [0, 9999] },           unit: "%" },

  // ═══════════════════════════════════════════════════════════════════
  // VITAMINAS  (IFM_final_2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "vitamina_d",      range: { M: [45, 100], F: [45, 100] },         unit: "ng/mL" },  // IFM: was 40
  { marker_id: "vitamina_b12",    range: { M: [650, 9999], F: [650, 9999] },     unit: "pg/mL" },
  { marker_id: "acido_folico",    range: { M: [15, 9999], F: [15, 9999] },       unit: "ng/mL" },
  { marker_id: "vitamina_a",      range: { M: [0.5, 0.7], F: [0.5, 0.7] },       unit: "mg/L" },  // IFM diz mcg/L mas valor 0.5–0.7 só faz sentido em mg/L (retinol)
  { marker_id: "vitamina_c",      range: { M: [1.0, 9999], F: [1.0, 9999] },     unit: "mg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // MINERAIS  (IFM_final_2)
  // NOTA: IFM usa "mcg/L" para Zinco e Cobre mas os valores (90–120, 90–130)
  // só fazem sentido clínico em µg/dL. É um erro tipográfico conhecido.
  // Selênio em mcg/L (= µg/L) está correto.
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "selenio",         range: { M: [90, 150], F: [90, 150] },         unit: "µg/L" },
  { marker_id: "zinco",           range: { M: [90, 120], F: [90, 120] },         unit: "µg/dL" },
  { marker_id: "cobre",           range: { M: [90, 130], F: [90, 130] },         unit: "µg/dL" },
  { marker_id: "magnesio",        range: { M: [2.1, 9999], F: [2.1, 9999] },     unit: "mg/dL" },
  { marker_id: "calcio_total",    range: { M: [8.6, 10.3], F: [8.6, 10.3] },     unit: "mg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // ADRENAIS E OUTROS  (IFM_final_2)
  // Nota: Eletrólitos (Na, K, Cl, Ca iônico) removidos — ausentes no XLSX (Blank is Blank)
  // PTH mantido — presente no XLSX (linha 116)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "pth",             range: { M: [15, 50], F: [15, 50] },           unit: "pg/mL" },
  { marker_id: "cortisol",        range: { M: [10, 15], F: [10, 15] },           unit: "µg/dL" },  // IFM: "Cortisol Salivar" sem unidade, mantém µg/dL
  { marker_id: "aldosterona",     range: { M: [5, 15], F: [5, 15] },             unit: "ng/dL" },  // IFM: "Aldosterona Supina"
  { marker_id: "acth",            range: { M: [10, 46], F: [10, 46] },           unit: "pg/mL" },
  { marker_id: "igfbp3",          range: { M: [3.0, 5.0], F: [3.0, 5.0] },       unit: "mg/L" },

  // ═══════════════════════════════════════════════════════════════════
  // OUTROS MARCADORES  (IFM_final_2)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "ck",              range: { M: [0, 200], F: [0, 150] },           unit: "U/L" },  // IFM: was F<100,M<150
  { marker_id: "ldh",             range: { M: [135, 180], F: [135, 180] },       unit: "U/L" },

  // ═══════════════════════════════════════════════════════════════════
  // BILIRRUBINAS  (IFM_final_2 — NOVO)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "bilirrubina_direta",  range: { M: [0, 0.3], F: [0, 0.3] },       unit: "mg/dL" },
  { marker_id: "bilirrubina_indireta", range: { M: [0.2, 0.8], F: [0.2, 0.8] },  unit: "mg/dL" },
  { marker_id: "bilirrubina_total",   range: { M: [0.2, 1.1], F: [0.2, 1.1] },   unit: "mg/dL" },

  // ═══════════════════════════════════════════════════════════════════
  // METAIS PESADOS  (IFM_final_2 — agora numéricos com cutoffs)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "mercurio",        range: { M: [0, 5.9], F: [0, 5.9] },           unit: "" },  // IFM: <5.9 (sem unidade definida)
  { marker_id: "chumbo",          range: { M: [0, 3.5], F: [0, 3.5] },           unit: "" },  // IFM: <3.5
  { marker_id: "aluminio",        range: { M: [0, 7], F: [0, 7] },               unit: "" },  // IFM: <7
  { marker_id: "cadmio",          range: { M: [0, 1.2], F: [0, 1.2] },           unit: "" },  // IFM: <1.2

  // ═══════════════════════════════════════════════════════════════════
  // AUTOIMUNIDADE  (IFM_final_2 — Anti-Transglutaminase agora numérico)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "anti_transglutaminase_iga", range: { M: [0, 7], F: [0, 7] },     unit: "U/mL" },  // IFM: <7

  // ═══════════════════════════════════════════════════════════════════
  // COPROLÓGICO  (IFM_final_2 — pH numérico, demais são qualitativos)
  // ═══════════════════════════════════════════════════════════════════
  { marker_id: "copro_ph",        range: { M: [6.5, 7.5], F: [6.5, 7.5] },       unit: "" },

  // ═══════════════════════════════════════════════════════════════════
  // NÃO IMPLEMENTADOS nesta versão (IFM_final_2):
  //   - Progesterona M "<33" sem unidade → impreciso
  //   - DHEA-S: IFM sem ref numérica F/M
  //   - Estradiol F: sem fase do ciclo
  //   - FSH F / LH F: fase-dependente
  //   - IAL (Índice Androgênio Livre): M 30-150, precisa marker_id
  //   - 1,25(OH) Vit D: é relação calculada "1–1.5x (25OH)"
  //   - LH/FSH ratio: diagnóstico (SOP >2.0), não referência contínua
  //   - IGF1: listado sem valores no IFM
  //   - T3 Reverso: IFM diz "8-25" mas baseline funcional usa 11-18
  // ═══════════════════════════════════════════════════════════════════
];

// ── Index for fast lookup ──
const _index = new Map<string, FunctionalRange>();
for (const fr of FUNCTIONAL_RANGES) {
  _index.set(fr.marker_id, fr);
}

export function getFunctionalRange(markerId: string): FunctionalRange | undefined {
  return _index.get(markerId);
}

// ═══════════════════════════════════════════════════════════════════════════
// QUALITATIVE FUNCTIONAL REFERENCES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Referência funcional qualitativa para marcadores textuais (urina, fezes etc.).
 * Estrutura separada das referências numéricas — sem min/max.
 */
export interface QualitativeFunctionalRef {
  marker_id: string;
  reference_type: "qualitative";
  /** Texto esperado como "normal" (exibido na coluna Ref. Funcional) */
  expected_text: string;
  /** Todos os valores textuais considerados normais (já normalizados) */
  accepted_values: string[];
  /** Map de equivalências brutas → valor normalizado para comparação */
  normalization_map?: Record<string, string>;
}

/**
 * Normaliza texto qualitativo para comparação:
 * - lowercase, sem acentos, sem espaços extras, sem pontuação
 */
export function normalizeQualitativeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.,;:!?()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Mapa global de normalização: variantes brutas → forma canônica */
const GLOBAL_NORMALIZATION: Record<string, string> = {
  // negativo (inclui formas femininas e variantes)
  "negativo": "negativo",
  "negativa": "negativo",
  "neg": "negativo",
  "nao detectado": "negativo",
  "nao detectada": "negativo",
  "não detectado": "negativo",
  "não detectada": "negativo",
  "nao detectavel": "negativo",
  "não detectável": "negativo",
  "n/d": "negativo",
  "nenhum": "negativo",
  "nenhuma": "negativo",
  "nao reativo": "negativo",
  "nao reativa": "negativo",
  "não reativo": "negativo",
  "não reativa": "negativo",
  "nao reagente": "negativo",
  "não reagente": "negativo",
  "indetectavel": "negativo",
  "indetectável": "negativo",
  // ausente
  "ausente": "ausente",
  "ausentes": "ausente",
  "nao observado": "ausente",
  "nao observada": "ausente",
  "não observado": "ausente",
  "não observada": "ausente",
  "nao observados": "ausente",
  "não observados": "ausente",
  "nao encontrado": "ausente",
  "nao encontrada": "ausente",
  "não encontrado": "ausente",
  "não encontrada": "ausente",
  "nao encontrados": "ausente",
  "não encontrados": "ausente",
  "nao visualizado": "ausente",
  "nao visualizada": "ausente",
  "nao visualizados": "ausente",
  // raríssimos
  "rarissimos": "rarissimos",
  "raríssimos": "rarissimos",
  "rarissimas": "rarissimos",
  "rarissima": "rarissimos",
  "raros": "raros",
  "raras": "raros",
  "raro": "raros",
  "rara": "raros",
  // normal
  "normal": "normal",
  "normals": "normal",
  "dentro da normalidade": "normal",
  // presente
  "presente": "presente",
  "presentes": "presente",
  "positivo": "presente",
  "positiva": "presente",
  "pos": "presente",
  "detectado": "presente",
  "detectada": "presente",
  "detectavel": "presente",
  "reativo": "presente",
  "reativa": "presente",
  "reagente": "presente",
};

/**
 * Detects "below detection limit" patterns like "< 0.10", "< 0,3", "<1.0"
 * These are lab results that mean the substance was not detected at measurable levels.
 * Returns the canonical form they should map to, or null if not a BDL pattern.
 */
function detectBelowDetectionLimit(text: string): string | null {
  const bdlPattern = /^[<≤]\s*\d+[.,]?\d*$/;
  if (bdlPattern.test(text.trim())) {
    return "negativo";
  }
  return null;
}

/**
 * Map of marker_ids where below-detection-limit should map to a specific
 * canonical form OTHER than "negativo". E.g. urobilinogênio: "< 1.0" → "normal"
 */
const BDL_MARKER_OVERRIDES: Record<string, string> = {
  "urina_urobilinogenio": "normal",
};

/**
 * Tabela de referências funcionais qualitativas.
 * Fonte ÚNICA: IFM_final_2.xlsx
 *
 * NOTA: Anti-TPO, Anti-TG, TRAb, Anti-Transglutaminase IgA e Metais Pesados
 * foram movidos para FUNCTIONAL_RANGES (numérico) pois IFM_final_2 traz cutoffs numéricos.
 * Eles permanecem aqui como fallback qualitativo para laudos que trazem resultado textual.
 */
export const QUALITATIVE_FUNCTIONAL_RANGES: QualitativeFunctionalRef[] = [
  // ═══════════════════════════════════════════════════════════════════
  // URINA  (IFM_final_2: "Urina I = Normal")
  // ═══════════════════════════════════════════════════════════════════
  {
    marker_id: "urina_nitritos",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo"],
  },
  {
    marker_id: "urina_bilirrubina",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo"],
  },
  {
    marker_id: "urina_cetona",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo"],
  },
  {
    marker_id: "urina_proteinas",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "urina_glicose",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "normal"],
  },
  {
    marker_id: "urina_hemoglobina",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "urina_cilindros",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo", "rarissimos"],
  },
  {
    marker_id: "urina_celulas",
    reference_type: "qualitative",
    expected_text: "Raras",
    accepted_values: ["raros", "rarissimos", "ausente", "negativo"],
  },
  {
    marker_id: "urina_bacterias",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo", "rarissimos", "raros"],
  },
  {
    marker_id: "urina_cristais",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo"],
  },
  {
    marker_id: "urina_muco",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "urina_urobilinogenio",
    reference_type: "qualitative",
    expected_text: "Normal",
    accepted_values: ["normal", "negativo"],
  },
  {
    marker_id: "urina_fungos",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "urina_fibras",
    reference_type: "qualitative",
    expected_text: "Presentes",
    accepted_values: ["presente"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // COPROLÓGICO  (IFM_final_2)
  // ═══════════════════════════════════════════════════════════════════
  {
    marker_id: "copro_parasitas",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "copro_sangue",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "copro_muco",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "copro_leucocitos",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo", "rarissimos", "raros"],
  },
  {
    marker_id: "copro_hemacias",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo"],
  },
  {
    marker_id: "copro_gordura",
    reference_type: "qualitative",
    expected_text: "Normal",
    accepted_values: ["normal", "negativo", "ausente"],  // IFM: "normal"
  },
  {
    marker_id: "copro_fibras",
    reference_type: "qualitative",
    expected_text: "Presentes",
    accepted_values: ["presente"],
  },
  {
    marker_id: "copro_fungos",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "copro_bacterias",
    reference_type: "qualitative",
    expected_text: "Normal",
    accepted_values: ["normal"],
  },
  {
    marker_id: "copro_amido",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo"],
  },
  {
    marker_id: "copro_residuos",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo"],
  },
  {
    marker_id: "copro_ac_graxos",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo"],
  },
  {
    marker_id: "copro_celulose",
    reference_type: "qualitative",
    expected_text: "Ausente",
    accepted_values: ["ausente", "negativo", "rarissimos"],
  },

  // ═══════════════════════════════════════════════════════════════════
  // AUTOIMUNIDADE qualitativa  (IFM_final_2)
  // Anti-TPO/Anti-TG/TRAb agora também têm cutoff numérico acima,
  // mas mantidos aqui para laudos que reportam como texto.
  // ═══════════════════════════════════════════════════════════════════
  {
    marker_id: "fan",
    reference_type: "qualitative",
    expected_text: "Não reagente",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "anti_endomisio",
    reference_type: "qualitative",
    expected_text: "Não reagente",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "anti_endomisio_iga",
    reference_type: "qualitative",
    expected_text: "Não reagente",
    accepted_values: ["negativo", "ausente"],
  },
  {
    marker_id: "intolerancia_lactose",
    reference_type: "qualitative",
    expected_text: "Negativo",
    accepted_values: ["negativo", "ausente"],
  },
];

// ── Qualitative index ──
const _qualIndex = new Map<string, QualitativeFunctionalRef>();
for (const qr of QUALITATIVE_FUNCTIONAL_RANGES) {
  _qualIndex.set(qr.marker_id, qr);
}

export function getQualitativeFunctionalRef(markerId: string): QualitativeFunctionalRef | undefined {
  return _qualIndex.get(markerId);
}

/**
 * Resolve qualitative functional reference status.
 * Returns FunctionalResult with refText and status.
 */
export function resolveQualitativeFunctionalRef(
  markerId: string,
  textValue: string | null | undefined,
): FunctionalResult | null {
  const qr = _qualIndex.get(markerId);
  if (!qr) return null;

  const refText = qr.expected_text;

  if (!textValue || textValue.trim() === "") {
    return { refText, status: null };
  }

  // Normalize the input text
  const normalized = normalizeQualitativeText(textValue);

  // Try global normalization map first
  let mapped = GLOBAL_NORMALIZATION[normalized] ?? null;

  // If no direct match, try below-detection-limit pattern (e.g. "< 0.10")
  if (!mapped) {
    const bdl = detectBelowDetectionLimit(normalized);
    if (bdl) {
      // Some markers override BDL mapping (e.g. urobilinogênio → "normal" instead of "negativo")
      mapped = BDL_MARKER_OVERRIDES[markerId] ?? bdl;
    } else {
      mapped = normalized; // fallback to normalized text as-is
    }
  }

  // Check if mapped value is in accepted_values
  const isNormal = qr.accepted_values.includes(mapped);

  return { refText, status: isNormal ? "normal" : "fora" };
}

// ── Simple unit conversion for functional range adaptation ──
// Only converts the *functional range* to match the marker's canonical unit.

interface ConversionRule {
  from: string;
  to: string;
  factor: number;
}

const UNIT_CONVERSIONS: ConversionRule[] = [
  { from: "ng/dL", to: "pg/mL", factor: 10 },
  { from: "pg/mL", to: "ng/dL", factor: 0.1 },
  { from: "mg/dL", to: "mg/L", factor: 10 },
  { from: "mg/L",  to: "mg/dL", factor: 0.1 },
  { from: "µg/dL", to: "µg/L", factor: 10 },
  { from: "µg/L",  to: "µg/dL", factor: 0.1 },
  { from: "ng/mL", to: "ng/dL", factor: 100 },
  { from: "ng/dL", to: "ng/mL", factor: 0.01 },
  { from: "µg/mL", to: "mg/L", factor: 1 },
  { from: "mg/L",  to: "µg/mL", factor: 1 },
  { from: "mUI/L", to: "µIU/mL", factor: 1 },
  { from: "µIU/mL", to: "mUI/L", factor: 1 },
  { from: "mEq/L", to: "mmol/L", factor: 1 },
  { from: "mmol/L", to: "mEq/L", factor: 1 },
  { from: "mcg/dL", to: "µg/dL", factor: 1 },
  { from: "µg/dL", to: "mcg/dL", factor: 1 },
  // mg/L ↔ µg/L: Vitamina A (retinol) — labs podem usar µg/L ou mcg/L
  { from: "mg/L",  to: "µg/L",  factor: 1000 },
  { from: "µg/L",  to: "mg/L",  factor: 0.001 },
  { from: "mcg/L", to: "mg/L",  factor: 0.001 },
  { from: "mg/L",  to: "mcg/L", factor: 1000 },
  { from: "/mm³",   to: "/µL",   factor: 1 },
  { from: "/µL",    to: "/mm³",  factor: 1 },
  { from: "mil/µL", to: "/mm³",  factor: 1000 },
  { from: "/mm³",   to: "mil/µL", factor: 0.001 },
  // IU/mL ↔ UI/mL: mesma unidade, abreviações diferentes (International Units)
  { from: "IU/mL",  to: "UI/mL", factor: 1 },
  { from: "UI/mL",  to: "IU/mL", factor: 1 },
  { from: "IU/L",   to: "UI/L",  factor: 1 },
  { from: "UI/L",   to: "IU/L",  factor: 1 },
  // µIU/mL ↔ µU/mL ↔ uIU/mL: micro-international-units per mL (insulina)
  { from: "µIU/mL", to: "µU/mL", factor: 1 },
  { from: "µU/mL",  to: "µIU/mL", factor: 1 },
  { from: "uIU/mL", to: "µU/mL", factor: 1 },
  { from: "µU/mL",  to: "uIU/mL", factor: 1 },
  { from: "mUI/L",  to: "µU/mL", factor: 1 },
  { from: "µU/mL",  to: "mUI/L", factor: 1 },
];

function normalizeUnit(u: string): string {
  return u.toLowerCase().replace(/\s/g, "").replace(/μ/g, "µ");
}

function convertRange(
  range: [number, number],
  fromUnit: string,
  toUnit: string
): [number, number] | null {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return range;

  const rule = UNIT_CONVERSIONS.find(
    (r) => normalizeUnit(r.from) === from && normalizeUnit(r.to) === to
  );
  if (!rule) return null; // can't convert — skip functional ref
  return [range[0] * rule.factor, range[1] * rule.factor];
}

// ── Public API for Excel ──

export interface FunctionalResult {
  refText: string;       // e.g. "75 – 90 mg/dL"
  status: "normal" | "fora" | null;
}

/**
 * Resolve functional reference for a given marker, value, sex, and canonical unit.
 * Returns null if no functional range exists for the marker.
 */
export function resolveFunctionalRef(
  markerId: string,
  value: number | null,
  sex: "M" | "F",
  canonicalUnit: string
): FunctionalResult | null {
  const fr = getFunctionalRange(markerId);
  if (!fr) return null;

  const rawRange = fr.range[sex];
  // If range is a sentinel [0, 9999] (meaning "no ref for this sex"), return null
  if (rawRange[0] === 0 && rawRange[1] >= 9000) return null;
  let effectiveRange = rawRange;
  let displayUnit = fr.unit;

  // Convert functional range to canonical unit if different
  if (fr.unit && canonicalUnit && normalizeUnit(fr.unit) !== normalizeUnit(canonicalUnit)) {
    const converted = convertRange(rawRange, fr.unit, canonicalUnit);
    if (!converted) return null; // Can't convert — don't show
    effectiveRange = converted;
    displayUnit = canonicalUnit;
  }

  const [rawMin, rawMax] = effectiveRange;
  // Round to avoid floating-point artifacts (e.g. 0.11000000000000001)
  const min = parseFloat(rawMin.toPrecision(10));
  const max = parseFloat(rawMax.toPrecision(10));
  const refText = max >= 9000
    ? `> ${min} ${displayUnit}`
    : min === 0
      ? `< ${max} ${displayUnit}`
      : `${min} – ${max} ${displayUnit}`;

  if (value === null || value === undefined) {
    return { refText, status: null };
  }

  const status = value >= min && value <= max ? "normal" : "fora";
  return { refText, status };
}
