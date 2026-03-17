import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { StructuredAnamnese, AnamneseSource } from "./clinicalContext.types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MarkerResult {
  marker_id: string;
  marker_name: string;
  value: number | null;
  text_value?: string;
  unit: string;
  functional_min?: number;
  functional_max?: number;
  status: "normal" | "low" | "high" | "critical_low" | "critical_high" | "qualitative";
  session_date: string;
}

interface PatientProfile {
  objectives?: string[];
  activity_level?: string | null;
  sport_modality?: string | null;
  main_complaints?: string | null;
  restrictions?: string | null;
}

/** SOAP notes from the current encounter */
interface EncounterSOAP {
  chief_complaint?: string | null;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
  exams_requested?: string | null;
  medications?: string | null;
  free_notes?: string | null;
}

/** Context explicitly linked to the current encounter */
interface EncounterContext {
  encounter_id: string;
  encounter_date: string;
  soap?: EncounterSOAP | null;
  /** IDs of lab sessions linked to this encounter */
  linked_lab_session_ids?: string[];
  /** IDs of body composition sessions linked to this encounter */
  linked_body_composition_ids?: string[];
  /** IDs of imaging reports linked to this encounter */
  linked_imaging_report_ids?: string[];
}

interface AnalysisRequest {
  patient_name: string;
  patient_id?: string;
  sex: "M" | "F";
  birth_date?: string;
  sessions: Array<{ id: string; session_date: string }>;
  results: MarkerResult[];
  mode?: "full" | "analysis_only" | "protocols_only";
  patient_profile?: PatientProfile | null;
  specialty_id?: string; // ID da especialidade para carregar o prompt do banco
  encounter_context?: EncounterContext | null;
}

interface ProtocolRecommendation {
  protocol_id: string;
  protocol_name: string;
  category: string;
  via: string;
  composition: string;
  justification: string;
  priority: "alta" | "media" | "baixa";
  key_actives: string[];
}

interface PrescriptionRow {
  substancia: string;
  dose: string;
  via: string;
  frequencia: string;
  duracao: string;
  condicoes_ci: string;
  monitorizacao: string;
}

interface AnalysisResponse {
  summary: string;
  patterns: string[];
  trends: string[];
  suggestions: string[];
  full_text: string;
  technical_analysis?: string;    // Documento 1: análise técnica com faixas funcionais
  patient_plan?: string;          // Documento 2: plano de condutas resumido
  prescription_table?: PrescriptionRow[]; // Documento 3: prescrição em tabela
  protocol_recommendations?: ProtocolRecommendation[];
}

// ══════════════════════════════════════════════════════════════════════════════
// CAMADA 1 — MAPA DE ATIVOS TERAPÊUTICOS
// Cada ativo define: quais marcadores o indicam, em qual direção (alto/baixo),
// e quais objetivos do paciente amplificam sua prioridade.
// ══════════════════════════════════════════════════════════════════════════════
interface ActiveTherapeutic {
  id: string;
  name: string;
  mechanism: string; // breve descrição do mecanismo para o prompt
  markers_high: string[];   // marcadores ALTOS que indicam este ativo
  markers_low: string[];    // marcadores BAIXOS que indicam este ativo
  markers_any: string[];    // marcadores alterados em qualquer direção
  objectives_boost: string[]; // objetivos do paciente que amplificam prioridade
  contraindications?: string; // texto para o GPT-4.1
}

const THERAPEUTIC_ACTIVES: ActiveTherapeutic[] = [
  // ── Antioxidantes e Detox ──
  {
    id: "glutationa",
    name: "Glutationa (L-Glutathion)",
    mechanism: "Principal antioxidante intracelular; neutraliza radicais livres, apoia detox hepática fase II, regenera vitamina C e E.",
    markers_high: ["pcr", "vhs", "tgo", "tgp", "ggt", "homocisteina", "acido_urico"],
    markers_low: ["albumina"],
    markers_any: [],
    objectives_boost: ["desinflamacao", "longevidade", "saude_hormonal"],
  },
  {
    id: "nac",
    name: "NAC (N-Acetil Cisteína)",
    mechanism: "Precursor da glutationa; mucolítico, hepatoprotetor, reduz homocisteína, apoia função renal.",
    markers_high: ["pcr", "vhs", "tgo", "tgp", "ggt", "homocisteina", "creatinina", "ureia"],
    markers_low: [],
    markers_any: [],
    objectives_boost: ["desinflamacao", "longevidade"],
  },
  {
    id: "curcumina",
    name: "Curcumina (Nanomicelas)",
    mechanism: "Potente anti-inflamatório via inibição de NF-κB e COX-2; antioxidante, hepatoprotetor, melhora sensibilidade à insulina.",
    markers_high: ["pcr", "vhs", "tgo", "tgp", "ggt", "acido_urico", "insulina_jejum", "homa_ir"],
    markers_low: [],
    markers_any: [],
    objectives_boost: ["desinflamacao", "longevidade", "saude_intestinal"],
    contraindications: "Cautela com anticoagulantes (varfarina, heparina).",
  },
  {
    id: "resveratrol",
    name: "Resveratrol (Nanomicelas)",
    mechanism: "Ativa sirtuínas (SIRT1/SIRT3); anti-inflamatório, melhora perfil lipídico, sensibilizador de insulina, neuroprotetor.",
    markers_high: ["ldl", "colesterol_total", "triglicerides", "glicose_jejum", "insulina_jejum", "hba1c", "pcr"],
    markers_low: ["hdl"],
    markers_any: [],
    objectives_boost: ["longevidade", "desinflamacao", "emagrecimento", "cognicao_foco"],
  },
  {
    id: "acido_alfa_lipoico",
    name: "Ácido Alfa-Lipóico (ALA)",
    mechanism: "Antioxidante universal (hidro e lipossolúvel); melhora resistência à insulina, regenera glutationa, neuroprotetor, hepatoprotetor.",
    markers_high: ["glicose_jejum", "insulina_jejum", "hba1c", "homa_ir", "glicemia_media_estimada", "tgo", "tgp"],
    markers_low: [],
    markers_any: [],
    objectives_boost: ["emagrecimento", "desinflamacao", "longevidade"],
  },
  // ── Energia Mitocondrial ──
  {
    id: "nad_nadh",
    name: "NAD+/NADH",
    mechanism: "Coenzima essencial para produção de ATP mitocondrial; ativa sirtuínas, repara DNA, melhora fadiga e performance cognitiva.",
    markers_high: ["cortisol", "glicose_jejum", "insulina_jejum"],
    markers_low: ["ferritina", "vitamina_b12", "t3_livre", "igf1"],
    markers_any: [],
    objectives_boost: ["energia_disposicao", "longevidade", "performance_esportiva", "cognicao_foco"],
  },
  {
    id: "nmn",
    name: "NMN (Nicotinamida Mononucleotídeo)",
    mechanism: "Precursor direto do NAD+; aumenta NAD+ intracelular mais eficientemente que niacina; anti-aging, melhora metabolismo.",
    markers_high: ["glicose_jejum", "insulina_jejum", "hba1c"],
    markers_low: ["igf1", "testosterona_total"],
    markers_any: [],
    objectives_boost: ["longevidade", "energia_disposicao", "performance_esportiva"],
  },
  {
    id: "coq10",
    name: "Coenzima Q10",
    mechanism: "Componente essencial da cadeia respiratória mitocondrial; antioxidante de membrana, cardioprotetor, melhora fadiga.",
    markers_high: ["colesterol_total", "ldl", "triglicerides", "pcr"],
    markers_low: ["ferritina"],
    markers_any: [],
    objectives_boost: ["energia_disposicao", "longevidade", "performance_esportiva"],
  },
  {
    id: "l_carnitina",
    name: "L-Carnitina",
    mechanism: "Transporta ácidos graxos para a mitocôndria para β-oxidação; melhora metabolismo lipídico, performance e recuperação muscular.",
    markers_high: ["triglicerides", "colesterol_total", "ldl", "glicose_jejum", "insulina_jejum"],
    markers_low: ["testosterona_total", "ferritina"],
    markers_any: [],
    objectives_boost: ["emagrecimento", "performance_esportiva", "ganho_massa", "energia_disposicao"],
  },
  // ── Vitaminas e Minerais Chave ──
  {
    id: "vitamina_d",
    name: "Vitamina D3 (Colecalciferol)",
    mechanism: "Hormônio esteroide; regula imunidade, metabolismo ósseo, síntese hormonal, função muscular e humor.",
    markers_high: ["pth", "anti_tpo", "pcr"],
    markers_low: ["vitamina_d", "calcio_total", "testosterona_total"],
    markers_any: ["tsh"],
    objectives_boost: ["imunidade", "saude_hormonal", "performance_esportiva", "ganho_massa"],
  },
  {
    id: "vitamina_c",
    name: "Vitamina C (Ácido Ascórbico IV)",
    mechanism: "Antioxidante potente em altas doses IV; síntese de colágeno, imunomodulador, pró-oxidante seletivo em células tumorais.",
    markers_high: ["pcr", "vhs", "tgo", "tgp"],
    markers_low: ["vitamina_c", "albumina", "ferritina"],
    markers_any: [],
    objectives_boost: ["imunidade", "desinflamacao", "saude_pele"],
    contraindications: "Contraindicado em deficiência de G-6PD. Cautela com cálculos renais de oxalato.",
  },
  {
    id: "complexo_b_b12",
    name: "Complexo B / Metil-B12",
    mechanism: "Cofatores essenciais para metilação, síntese de neurotransmissores, metabolismo da homocisteína e produção de energia.",
    markers_high: ["homocisteina"],
    markers_low: ["vitamina_b12", "acido_folico"],
    markers_any: [],
    objectives_boost: ["energia_disposicao", "cognicao_foco", "saude_hormonal"],
  },
  {
    id: "magnesio",
    name: "Magnésio",
    mechanism: "Cofator de >300 enzimas; regula cortisol, síntese de ATP, contração muscular, sono, pressão arterial e sensibilidade à insulina.",
    markers_high: ["cortisol", "insulina_jejum", "glicose_jejum", "pcr"],
    markers_low: ["magnesio", "vitamina_d"],
    markers_any: [],
    objectives_boost: ["energia_disposicao", "performance_esportiva", "sono", "desinflamacao"],
  },
  {
    id: "zinco",
    name: "Zinco",
    mechanism: "Cofator de >200 enzimas; síntese de testosterona, imunidade celular, cicatrização, saúde da pele e função tireoidiana.",
    markers_high: ["pcr", "anti_tpo"],
    markers_low: ["zinco", "testosterona_total", "testosterona_livre", "vitamina_d"],
    markers_any: [],
    objectives_boost: ["imunidade", "saude_hormonal", "saude_pele", "ganho_massa"],
  },
  {
    id: "selenio",
    name: "Selênio",
    mechanism: "Componente de glutationa peroxidase; antioxidante, essencial para conversão T4→T3, imunomodulador.",
    markers_high: ["anti_tpo", "anti_tg", "pcr"],
    markers_low: ["selenio", "t3_livre"],
    markers_any: ["tsh"],
    objectives_boost: ["imunidade", "saude_hormonal"],
  },
  // ── Ativos Específicos ──
  {
    id: "dmts_msm",
    name: "DMTS/MSM (Metilsulfonilmetano)",
    mechanism: "Fonte orgânica de enxofre; anti-inflamatório articular, reduz dor crônica, apoia síntese de colágeno e glutationa.",
    markers_high: ["pcr", "vhs", "acido_urico", "homocisteina"],
    markers_low: [],
    markers_any: [],
    objectives_boost: ["desinflamacao"],
  },
  {
    id: "inositol",
    name: "Inositol (Mio-Inositol)",
    mechanism: "Segundo mensageiro da insulina; melhora resistência insulínica, SOP, saúde ovariana, humor e sono.",
    markers_high: ["insulina_jejum", "homa_ir", "glicose_jejum", "triglicerides", "lh"],
    markers_low: ["hdl"],
    markers_any: [],
    objectives_boost: ["emagrecimento", "saude_hormonal"],
  },
  {
    id: "taurina",
    name: "Taurina",
    mechanism: "Aminoácido condicionalmente essencial; cardioprotetor, neuroprotetor, melhora metabolismo lipídico e função mitocondrial.",
    markers_high: ["colesterol_total", "ldl", "triglicerides", "pcr", "cortisol"],
    markers_low: [],
    markers_any: [],
    objectives_boost: ["energia_disposicao", "performance_esportiva", "longevidade"],
  },
  {
    id: "aminoacidos",
    name: "Aminoácidos Essenciais (Pool)",
    mechanism: "Substrato para síntese proteica, reparo muscular, neurotransmissores e enzimas.",
    markers_high: [],
    markers_low: ["albumina", "proteina_total", "igf1", "testosterona_total"],
    markers_any: [],
    objectives_boost: ["ganho_massa", "performance_esportiva", "recuperacao_muscular"],
  },
  {
    id: "ferro_carboximaltose",
    name: "Ferro Carboximaltose (Reposição IV)",
    mechanism: "Reposição de ferro de liberação gradual; corrige anemia ferropriva rapidamente sem efeitos GI.",
    markers_high: [],
    markers_low: ["ferritina", "hemoglobina", "hematocrito", "vcm", "hcm", "ferro_serico"],
    markers_any: [],
    objectives_boost: ["energia_disposicao", "performance_esportiva"],
  },
  {
    id: "l_baiba",
    name: "L-BAIBA (Ácido L-β-Aminoisobutírico)",
    mechanism: "Miocina derivada do catabolismo da valina via PGC-1α; ativa AMPK, promove browning do tecido adiposo, β-oxidação de ácidos graxos, biogênese mitocondrial, ação anti-inflamatória (inibe NF-κB), antioxidante (via Nrf2), neuroprotetor e sensibilizador de insulina.",
    markers_high: ["pcr", "vhs", "triglicerides", "glicose_jejum", "insulina_jejum", "homa_ir", "hba1c", "colesterol_total", "ldl"],
    markers_low: ["hdl", "vitamina_d"],
    markers_any: [],
    objectives_boost: ["emagrecimento", "desinflamacao", "longevidade", "performance_esportiva", "energia_disposicao"],
  },
];

// ══════════════════════════════════════════════════════════════════════════════
// CAMADA 2 — SCORE DE ATIVOS (marcadores + objetivos do paciente)
// ══════════════════════════════════════════════════════════════════════════════
interface ScoredActive {
  active: ActiveTherapeutic;
  score: number;
  triggered_by: string[]; // marcadores que ativaram este ativo
}

function scoreActives(
  abnormalResults: MarkerResult[],
  sex: "M" | "F",
  objectives: string[]
): ScoredActive[] {
  const highIds = new Set(
    abnormalResults.filter((r) => r.status === "high" || r.status === "critical_high").map((r) => r.marker_id)
  );
  const lowIds = new Set(
    abnormalResults.filter((r) => r.status === "low" || r.status === "critical_low").map((r) => r.marker_id)
  );
  const anyIds = new Set(abnormalResults.map((r) => r.marker_id));
  const objectiveSet = new Set(objectives);

  const scored: ScoredActive[] = [];

  for (const active of THERAPEUTIC_ACTIVES) {
    let score = 0;
    const triggered: string[] = [];

    // Marcadores altos
    for (const m of active.markers_high) {
      if (highIds.has(m)) {
        score += highIds.has(m) ? 2 : 0;
        // Marcadores críticos valem mais
        const r = abnormalResults.find((x) => x.marker_id === m);
        if (r?.status === "critical_high") score += 1;
        triggered.push(m);
      }
    }

    // Marcadores baixos
    for (const m of active.markers_low) {
      if (lowIds.has(m)) {
        score += 2;
        const r = abnormalResults.find((x) => x.marker_id === m);
        if (r?.status === "critical_low") score += 1;
        triggered.push(m);
      }
    }

    // Marcadores em qualquer direção
    for (const m of active.markers_any) {
      if (anyIds.has(m)) {
        score += 1;
        triggered.push(m);
      }
    }

    // Amplificação por objetivos do paciente
    for (const obj of active.objectives_boost) {
      if (objectiveSet.has(obj)) {
        score += 1.5;
      }
    }

    // Filtro por sexo
    if (sex === "M" && (active.id === "inositol" && !anyIds.has("insulina_jejum"))) continue;

    if (score > 0) {
      scored.push({ active, score, triggered_by: [...new Set(triggered)] });
    }
  }

  // Ordenar por score decrescente
  return scored.sort((a, b) => b.score - a.score);
}

// ══════════════════════════════════════════════════════════════════════════════
// CAMADA 3 — MAPEAMENTO ATIVO → PROTOCOLO ESSENTIA
// Cada protocolo define quais ativos terapêuticos contém (por ID do ativo).
// ══════════════════════════════════════════════════════════════════════════════
interface EssentiaProtocol {
  id: string;
  name: string;
  category: string;
  via: "Endovenoso" | "Intramuscular";
  composition: string;
  actives_contained: string[]; // IDs dos ativos terapêuticos presentes neste protocolo
  sex_restriction?: "M" | "F";
}

const ESSENTIA_PROTOCOLS: EssentiaProtocol[] = [
  // ── ENDOVENOSOS: Imunidade, Inflamação e Antioxidante ──
  { id: "EV 1.1", name: "Protocolo adjuvante para Imunidade", category: "Imunidade e Antioxidante", via: "Endovenoso",
    composition: "Alanil Glutamina, Complexo B sem B1, NAC 300mg, L-Glutathion 100mg, Minerais (Cromo, Manganês, Magnésio, Zinco, Selênio, Cobre)",
    actives_contained: ["nac", "glutationa", "magnesio", "zinco", "selenio", "complexo_b_b12"] },
  { id: "EV 1.2", name: "Protocolo adjuvante Anti-inflamatório", category: "Imunidade e Antioxidante", via: "Endovenoso",
    composition: "MSM 750mg, NAC 300mg, Vit B3, Minerais, Aminoácidos (3,8%), Ácido Lipoico 600mg",
    actives_contained: ["dmts_msm", "nac", "acido_alfa_lipoico", "aminoacidos", "complexo_b_b12"] },
  { id: "EV 1.3", name: "Protocolo de Vitaminas, Minerais, Antioxidantes e Aminoácidos", category: "Imunidade e Antioxidante", via: "Endovenoso",
    composition: "NAC 300mg, L-Glutathion 100mg, Vit B3, Complexo B sem B1, Aminoácidos (3,8%), Minerais",
    actives_contained: ["nac", "glutationa", "complexo_b_b12", "aminoacidos", "zinco", "selenio", "magnesio"] },
  { id: "EV 1.4", name: "Protocolo adjuvante Pós-Infecção", category: "Imunidade e Antioxidante", via: "Endovenoso",
    composition: "Complexo B sem B1, L-Citrulina + Vit C 75mg, NAC 300mg, L-Leucina, L-Lisina, MSM 1,5g, Magnésio 1g, Minerais",
    actives_contained: ["nac", "vitamina_c", "dmts_msm", "magnesio", "complexo_b_b12", "aminoacidos"] },
  { id: "EV 1.5", name: "Protocolo adjuvante Anti-inflamatório e Antioxidante", category: "Imunidade e Antioxidante", via: "Endovenoso",
    composition: "MSM 1,5g, NAC 300mg, L-Carnitina 600mg, Complexo B sem B1, SAMe 200mg, Aminoácidos (3,8%), L-Glutathion 600mg",
    actives_contained: ["dmts_msm", "nac", "glutationa", "l_carnitina", "complexo_b_b12", "aminoacidos"] },
  { id: "EV 1.6", name: "Protocolo adjuvante para Dores Crônicas", category: "Imunidade e Antioxidante", via: "Endovenoso",
    composition: "SAMe 200mg, MSM 1,5g, L-Carnitina 600mg, ATP 20mg, Complexo B com Metil B12, DL-Fenilalanina",
    actives_contained: ["dmts_msm", "l_carnitina", "complexo_b_b12"] },
  { id: "EV 1.7", name: "Protocolo adjuvante Síndrome da Ativação Mastocitária", category: "Imunidade e Antioxidante", via: "Endovenoso",
    composition: "Vit C 444mg, Cloreto de Magnésio 500mg, Nanomicelas de Quercetina 15mg, Nanomicelas de Resveratrol 10mg, Vit D3 50.000–600.000 UI",
    actives_contained: ["vitamina_c", "magnesio", "resveratrol", "vitamina_d"] },
  { id: "EV 1.9", name: "Protocolo Antioxidante Plus (Curcumina + Resveratrol)", category: "Imunidade e Antioxidante", via: "Endovenoso",
    composition: "Nanomicelas de Curcuminoides 2mg, Nanomicelas de Tocoferóis 10mg",
    actives_contained: ["curcumina", "resveratrol"] },

  // ── ENDOVENOSOS: Energia e Disposição ──
  { id: "EV 2.1", name: "Protocolo adjuvante para Fadiga/Indisposição", category: "Energia e Disposição", via: "Endovenoso",
    composition: "NAC 300mg, Sulfato de Magnésio 200mg, Vit B12 (Metilcobalamina) 500mcg, Complexo B sem B1, D-Ribose 500mg, Taurina 500mg, Aminoácidos (3,8%), Inositol 1g",
    actives_contained: ["nac", "magnesio", "complexo_b_b12", "taurina", "aminoacidos", "inositol"] },
  { id: "EV 2.2", name: "Protocolo adjuvante Energia Mitocondrial", category: "Energia e Disposição", via: "Endovenoso",
    composition: "L-Carnitina 600mg, Vit B5, Sulfato de Magnésio 200mg, D-Ribose 500mg, Vit B3, Vit B2, PQQ 2,5–5mg, Coenzima Q10 50mg",
    actives_contained: ["l_carnitina", "magnesio", "coq10", "complexo_b_b12"] },
  { id: "EV 2.3", name: "Protocolo adjuvante Energia Celular", category: "Energia e Disposição", via: "Endovenoso",
    composition: "ATP 20mg, D-Ribose 500mg, L-Carnitina 600mg, Sulfato de Magnésio 200mg, L-Citrulina + Vit C 75mg, Ácido Lipoico 600mg",
    actives_contained: ["l_carnitina", "magnesio", "acido_alfa_lipoico", "vitamina_c"] },
  { id: "EV 2.4", name: "Protocolo adjuvante Energia, Disposição e Foco", category: "Energia e Disposição", via: "Endovenoso",
    composition: "NAC 300mg, L-Fenilalanina, Taurina 100mg, L-Triptofano 100mg, Piracetam 500mg, Complexo B com Metil B12",
    actives_contained: ["nac", "taurina", "complexo_b_b12"] },
  { id: "EV 2.5", name: "Protocolo adjuvante Aumento de Vitalidade", category: "Energia e Disposição", via: "Endovenoso",
    composition: "Sulfato de Magnésio 1g, Complexo B sem B1, Taurina 500mg, NAC 300mg, Vit C 1g, L-Fenilalanina",
    actives_contained: ["magnesio", "complexo_b_b12", "taurina", "nac", "vitamina_c"] },
  { id: "EV 2.6", name: "Protocolo adjuvante Ativador Metabólico", category: "Energia e Disposição", via: "Endovenoso",
    composition: "L-Carnitina 600mg, Cloreto de Cromo 100mcg, HMB 50mg, Inositol 100mg + Taurina 100mg",
    actives_contained: ["l_carnitina", "inositol", "taurina"] },
  { id: "EV 2.7", name: "Protocolo adjuvante Energia e Saúde Mitocondrial", category: "Energia e Disposição", via: "Endovenoso",
    composition: "Nanomicelas de Resveratrol 10mg, L-Carnitina 600mg, Ácido Lipoico 10mg, Coenzima Q10 100mg",
    actives_contained: ["resveratrol", "l_carnitina", "acido_alfa_lipoico", "coq10"] },
  { id: "EV 2.7_nmn", name: "Protocolo adjuvante Longevidade e Anti-Aging (NMN)", category: "Longevidade", via: "Endovenoso",
    composition: "NMN 100mg, Nanomicelas de Resveratrol 10mg, L-Carnitina 600mg, Ácido Lipoico 10mg, Coenzima Q10 100mg",
    actives_contained: ["nmn", "resveratrol", "l_carnitina", "acido_alfa_lipoico", "coq10"] },
  { id: "EV 2.8", name: "Protocolo adjuvante Revitalização Celular (NADH + NMN)", category: "Energia e Disposição", via: "Endovenoso",
    composition: "NADH 10mg, L-Carnitina 600mg, D-Ribose 500mg, L-Triptofano 100mg, NMN 100mg, Complexo B com Metil B12, PQQ 2,5mg",
    actives_contained: ["nad_nadh", "nmn", "l_carnitina", "complexo_b_b12"] },
  { id: "EV 2.8_ferro", name: "Protocolo adjuvante Reposição de Ferro (Ferro Carboximaltose)", category: "Energia e Disposição", via: "Endovenoso",
    composition: "Ferro Carboximaltose — tecnologia de liberação gradual e controlada do ferro",
    actives_contained: ["ferro_carboximaltose"] },

  // ── ENDOVENOSOS: Cognição e Memória ──
  { id: "EV 3.1", name: "Protocolo adjuvante Recuperação Neuronal", category: "Cognição e Memória", via: "Endovenoso",
    composition: "Alfa-GPC 150mg, Clorato de Colina + L-Carnitina + Vit B5, Inositol 1g, L-Triptofano 100mg, Vit B12 2500mcg, Minerais",
    actives_contained: ["complexo_b_b12", "l_carnitina", "inositol", "magnesio", "zinco"] },
  { id: "EV 3.2", name: "Protocolo adjuvante Redução do Estresse e Memória", category: "Cognição e Memória", via: "Endovenoso",
    composition: "N-Acetil L-Tirosina, L-Theanina 50mg, Minerais, Inositol 100mg + Taurina 100mg, Vit B12 2500mcg",
    actives_contained: ["complexo_b_b12", "inositol", "taurina", "magnesio", "zinco"] },

  // ── ENDOVENOSOS: Saúde Hepática ──
  { id: "EV 4.1", name: "Protocolo adjuvante Saúde e Desintoxicação Hepática", category: "Saúde Hepática", via: "Endovenoso",
    composition: "L-Glutathion 600mg, NAC 300mg, Ácido Lipoico 600mg, Vit C 444mg, Complexo B sem B1, Minerais",
    actives_contained: ["glutationa", "nac", "acido_alfa_lipoico", "vitamina_c", "complexo_b_b12"] },

  // ── ENDOVENOSOS: Quelação ──
  { id: "EV 5.1", name: "Protocolo adjuvante Quelação de Metais Tóxicos", category: "Quelação", via: "Endovenoso",
    composition: "EDTA Dissódico, Vit C 444mg, Complexo B sem B1, Minerais",
    actives_contained: ["vitamina_c", "complexo_b_b12", "zinco", "selenio"] },

  // ── ENDOVENOSOS: Metabolismo / Emagrecimento / Massa ──
  { id: "EV 6.1", name: "Protocolo adjuvante para Distúrbios do Metabolismo", category: "Metabolismo", via: "Endovenoso",
    composition: "L-Carnitina 600mg, Cloreto de Cromo 100mcg, Ácido Lipoico 600mg, Inositol 1g, Vit B3, Magnésio 1g",
    actives_contained: ["l_carnitina", "acido_alfa_lipoico", "inositol", "magnesio", "complexo_b_b12"] },
  { id: "EV 6.2", name: "Protocolo adjuvante para Emagrecimento", category: "Emagrecimento e Massa", via: "Endovenoso",
    composition: "L-Carnitina 600mg, Cloreto de Cromo 100mcg, Inositol 1g, Taurina 500mg, Complexo B sem B1, Ácido Lipoico 600mg",
    actives_contained: ["l_carnitina", "inositol", "taurina", "acido_alfa_lipoico", "complexo_b_b12"] },
  { id: "EV 6.3", name: "Protocolo adjuvante para Ganho de Massa Muscular", category: "Emagrecimento e Massa", via: "Endovenoso",
    composition: "L-Arginina HCl 400mg, HMB 50mg, Complexo B com Metil B12, Aminoácidos (3,8%), Sulfato de Magnésio 200mg",
    actives_contained: ["aminoacidos", "magnesio", "complexo_b_b12"] },

  // ── ENDOVENOSOS: Pele, Cabelo e Unhas ──
  { id: "EV 7.1", name: "Protocolo adjuvante Saúde e Beleza da Pele, Cabelo e Unhas", category: "Pele, Cabelo e Unhas", via: "Endovenoso",
    composition: "Biotina 10mg, Vit C 444mg, Zinco 20mg, Silício Orgânico, Complexo B com Metil B12",
    actives_contained: ["vitamina_c", "zinco", "complexo_b_b12"] },

  // ── ENDOVENOSOS: Saúde Óssea ──
  { id: "EV 8.1", name: "Protocolo adjuvante Saúde Óssea, Muscular e Articular", category: "Saúde Óssea", via: "Endovenoso",
    composition: "Magnésio 1g, Vit D3 50.000 UI, L-Lisina 300mg, L-Prolina 300mg, Vit C 444mg, Minerais",
    actives_contained: ["magnesio", "vitamina_d", "vitamina_c", "zinco"] },
  { id: "EV 8.2", name: "Protocolo adjuvante Síndrome Metabólica", category: "Metabolismo", via: "Endovenoso",
    composition: "L-Carnitina 600mg, Cloreto de Cromo 100mcg, Ácido Lipoico 600mg, Inositol 1g, Taurina 500mg, Complexo B sem B1",
    actives_contained: ["l_carnitina", "acido_alfa_lipoico", "inositol", "taurina", "complexo_b_b12"] },
  { id: "EV 8.3", name: "Protocolo adjuvante Hipotireoidismo Funcional", category: "Metabolismo", via: "Endovenoso",
    composition: "Selênio 200mcg, Zinco 20mg, Complexo B com Metil B12, L-Tirosina 500mg",
    actives_contained: ["selenio", "zinco", "complexo_b_b12"] },
  { id: "EV 8.4", name: "Protocolo adjuvante Diabetes Tipo 2", category: "Metabolismo", via: "Endovenoso",
    composition: "Ácido Lipoico 600mg, Cloreto de Cromo 100mcg, Inositol 1g, Vit B12 500mcg, Complexo B sem B1",
    actives_contained: ["acido_alfa_lipoico", "inositol", "complexo_b_b12"] },

  // ── ENDOVENOSOS: SNC ──
  { id: "EV 9.1_snc", name: "Protocolo adjuvante Ansiedade e Estresse", category: "SNC e Humor", via: "Endovenoso",
    composition: "L-Triptofano 100mg, L-Theanina 50mg, Magnésio 1g, Inositol 1g, Complexo B com Metil B12",
    actives_contained: ["magnesio", "inositol", "complexo_b_b12"] },
  { id: "EV 9.2", name: "Protocolo adjuvante Depressão", category: "SNC e Humor", via: "Endovenoso",
    composition: "L-Triptofano 100mg, SAMe 200mg, Complexo B com Metil B12, Ácido Fólico, Zinco 20mg",
    actives_contained: ["complexo_b_b12", "zinco"] },
  { id: "EV 9.3", name: "Protocolo adjuvante Fibromialgia", category: "SNC e Humor", via: "Endovenoso",
    composition: "SAMe 200mg, MSM 1,5g, L-Carnitina 600mg, Magnésio 1g, Complexo B com Metil B12, DL-Fenilalanina",
    actives_contained: ["dmts_msm", "l_carnitina", "magnesio", "complexo_b_b12"] },

  // ── ENDOVENOSOS: Saúde Feminina ──
  { id: "EV 9.1_fem", name: "Protocolo adjuvante Saúde Feminina", category: "Saúde Feminina", via: "Endovenoso",
    composition: "Complexo B com Metil B12, Inositol 1g, Magnésio 1g, L-Carnitina 600mg, Zinco 20mg, Vit D3 50.000 UI",
    actives_contained: ["complexo_b_b12", "inositol", "magnesio", "l_carnitina", "zinco", "vitamina_d"],
    sex_restriction: "F" },
  { id: "EV 16.2", name: "Protocolo adjuvante TPM e Menopausa", category: "Saúde Feminina", via: "Endovenoso",
    composition: "Magnésio 1g, Vit B6 100mg, Inositol 1g, L-Triptofano 100mg, Complexo B com Metil B12",
    actives_contained: ["magnesio", "inositol", "complexo_b_b12"],
    sex_restriction: "F" },

  // ── ENDOVENOSOS: Saúde Masculina ──
  { id: "EV 10.1", name: "Protocolo adjuvante Saúde Masculina", category: "Saúde Masculina", via: "Endovenoso",
    composition: "Zinco 20mg, L-Carnitina 600mg, Vit D3 50.000 UI, Complexo B com Metil B12, NAC 300mg",
    actives_contained: ["zinco", "l_carnitina", "vitamina_d", "complexo_b_b12", "nac"],
    sex_restriction: "M" },

  // ── ENDOVENOSOS: Cardiovascular ──
  { id: "EV 11.1", name: "Protocolo adjuvante Saúde Cardiovascular", category: "Saúde Cardiovascular", via: "Endovenoso",
    composition: "Magnésio 1g, Taurina 500mg, L-Carnitina 600mg, Coenzima Q10 100mg, Vit C 444mg",
    actives_contained: ["magnesio", "taurina", "l_carnitina", "coq10", "vitamina_c"] },
  { id: "EV 11.2", name: "Protocolo adjuvante Condições Autoimunes", category: "Imunidade e Antioxidante", via: "Endovenoso",
    composition: "L-Glutathion 600mg, NAC 300mg, Vit D3 50.000 UI, Ácido Lipoico 600mg",
    actives_contained: ["glutationa", "nac", "vitamina_d", "acido_alfa_lipoico"] },

  // ── ENDOVENOSOS: Performance Esportiva ──
  { id: "EV 14.1", name: "Protocolo adjuvante Performance Esportiva", category: "Performance Esportiva", via: "Endovenoso",
    composition: "L-Arginina HCl 400mg, L-Citrulina + Vit C 75mg, L-Carnitina 600mg, Complexo B com Metil B12, Sulfato de Magnésio 200mg",
    actives_contained: ["l_carnitina", "vitamina_c", "magnesio", "complexo_b_b12", "aminoacidos"] },
  { id: "EV 14.2", name: "Protocolo adjuvante Recuperação Muscular Esportiva", category: "Performance Esportiva", via: "Endovenoso",
    composition: "Aminoácidos (3,8%), L-Glutamina, Magnésio 1g, Zinco 20mg, Vit C 444mg",
    actives_contained: ["aminoacidos", "magnesio", "zinco", "vitamina_c"] },

  // ── ENDOVENOSOS: Outros ──
  { id: "EV 12.1", name: "Protocolo adjuvante Recuperação Pós-Cirúrgica", category: "Pós-Cirúrgico", via: "Endovenoso",
    composition: "Vit C 444mg, Zinco 20mg, L-Glutamina, Complexo B sem B1, Aminoácidos (3,8%)",
    actives_contained: ["vitamina_c", "zinco", "aminoacidos", "complexo_b_b12"] },
  { id: "EV 13.1", name: "Protocolo adjuvante Saúde do Sono", category: "Sono", via: "Endovenoso",
    composition: "Magnésio 1g, L-Triptofano 100mg, Inositol 1g, Taurina 500mg, Vit B6 100mg",
    actives_contained: ["magnesio", "inositol", "taurina", "complexo_b_b12"] },
  { id: "EV 13.2", name: "Protocolo adjuvante Hidratação e Reposição de Minerais", category: "Hidratação", via: "Endovenoso",
    composition: "Soro Fisiológico 0,9%, Eletrólitos, Magnésio 1g, Complexo B sem B1",
    actives_contained: ["magnesio", "complexo_b_b12"] },
  { id: "EV 15.1", name: "Protocolo adjuvante Saúde Intestinal", category: "Saúde Intestinal", via: "Endovenoso",
    composition: "L-Glutamina, Zinco 20mg, Vit D3 50.000 UI, Complexo B com Metil B12",
    actives_contained: ["zinco", "vitamina_d", "complexo_b_b12", "aminoacidos"] },
  { id: "EV 18.1", name: "Protocolo adjuvante Suporte ao Tratamento Oncológico", category: "Suporte Oncológico", via: "Endovenoso",
    composition: "L-Glutathion 600mg, Vit C 444mg, NAC 300mg, Selênio, Zinco 20mg, Complexo B sem B1",
    actives_contained: ["glutationa", "vitamina_c", "nac", "selenio", "zinco", "complexo_b_b12"] },
  { id: "EV 22.1", name: "Protocolo adjuvante Saúde Renal", category: "Saúde Renal", via: "Endovenoso",
    composition: "NAC 300mg, L-Glutathion 600mg, Vit C 444mg, Complexo B sem B1, Magnésio 1g",
    actives_contained: ["nac", "glutationa", "vitamina_c", "magnesio", "complexo_b_b12"] },

  // ── INTRAMUSCULARES ──
  { id: "IM 1.1", name: "Protocolo IM adjuvante para Imunidade", category: "Imunidade e Antioxidante", via: "Intramuscular",
    composition: "Vit D3 50.000–600.000 UI, Vit A 25.000 UI, Coenzima Q10 50mg",
    actives_contained: ["vitamina_d", "coq10"] },
  { id: "IM 2.1", name: "Protocolo IM adjuvante para Fadiga/Indisposição", category: "Energia e Disposição", via: "Intramuscular",
    composition: "Vit B12 (Metilcobalamina) 2500mcg, Complexo B com Metil B12, Coenzima Q10 50mg",
    actives_contained: ["complexo_b_b12", "coq10"] },
  { id: "IM 3.1", name: "Protocolo IM adjuvante Cognição e Memória", category: "Cognição e Memória", via: "Intramuscular",
    composition: "Complexo B com Metil B12, Citicolina, Fosfatidilserina",
    actives_contained: ["complexo_b_b12"] },
  { id: "IM 4.1", name: "Protocolo IM adjuvante Saúde e Desintoxicação Hepática", category: "Saúde Hepática", via: "Intramuscular",
    composition: "NAC 300mg, L-Glutathion 100mg, Silimarina",
    actives_contained: ["nac", "glutationa"] },
  { id: "IM 5.1", name: "Protocolo IM adjuvante Emagrecimento e Ganho de Massa", category: "Emagrecimento e Massa", via: "Intramuscular",
    composition: "L-Carnitina 600mg, Cloreto de Cromo 100mcg, HMB 50mg",
    actives_contained: ["l_carnitina"] },
  { id: "IM 6.1", name: "Protocolo IM adjuvante Pele, Cabelo e Unhas", category: "Pele, Cabelo e Unhas", via: "Intramuscular",
    composition: "Biotina 10mg, Vit C 400mg, Zinco 20mg, Complexo B com Metil B12",
    actives_contained: ["vitamina_c", "zinco", "complexo_b_b12"] },
  { id: "IM 7.1", name: "Protocolo IM adjuvante Distúrbios do Metabolismo", category: "Metabolismo", via: "Intramuscular",
    composition: "Ácido Lipoico 10mg, Cloreto de Cromo 100mcg, Inositol 100mg + Taurina 100mg",
    actives_contained: ["acido_alfa_lipoico", "inositol", "taurina"] },
  { id: "IM 8.1", name: "Protocolo IM adjuvante SNC", category: "SNC e Humor", via: "Intramuscular",
    composition: "L-Triptofano 100mg, Magnésio 500mg, Complexo B com Metil B12",
    actives_contained: ["magnesio", "complexo_b_b12"] },
  { id: "IM 9.1", name: "Protocolo IM adjuvante Saúde Feminina", category: "Saúde Feminina", via: "Intramuscular",
    composition: "Vit D3 50.000 UI, Vit B12 2500mcg, Coenzima Q10 50mg",
    actives_contained: ["vitamina_d", "complexo_b_b12", "coq10"],
    sex_restriction: "F" },
  { id: "IM 9.2", name: "Protocolo IM adjuvante Saúde Óssea, Muscular e Articular", category: "Saúde Óssea", via: "Intramuscular",
    composition: "Vit D3 50.000–600.000 UI, Vit K2, Magnésio 500mg",
    actives_contained: ["vitamina_d", "magnesio"] },
  { id: "IM 11.1", name: "Protocolo IM adjuvante Saúde Masculina", category: "Saúde Masculina", via: "Intramuscular",
    composition: "Zinco 20mg, Selênio 200mcg, L-Arginina HCl 400mg, Vit D3 50.000 UI",
    actives_contained: ["zinco", "selenio", "vitamina_d"],
    sex_restriction: "M" },
  { id: "IM 12.1", name: "Protocolo IM adjuvante Saúde do Coração", category: "Saúde Cardiovascular", via: "Intramuscular",
    composition: "Complexo B com Metil B12, L-Carnitina 600mg, D-Ribose 500mg, Taurina 100mg, NMN 100mg",
    actives_contained: ["complexo_b_b12", "l_carnitina", "taurina", "nmn"] },
  { id: "IM 13.1", name: "Protocolo IM adjuvante Hipocloridria", category: "Saúde Intestinal", via: "Intramuscular",
    composition: "Glicina 75mg, L-Lisina 300mg, Complexo B com Metil B12",
    actives_contained: ["complexo_b_b12", "aminoacidos"] },
  { id: "IM 13.2", name: "Protocolo IM adjuvante Disbiose", category: "Saúde Intestinal", via: "Intramuscular",
    composition: "MSM 750mg, Vit C 400mg, Glicina 75mg",
    actives_contained: ["dmts_msm", "vitamina_c", "aminoacidos"] },
  { id: "IM 14.1", name: "Protocolo IM adjuvante Regulação do Sono", category: "Sono", via: "Intramuscular",
    composition: "Melatonina 3mg, Hidroxitriptofano 4mg, L-Theanina 50mg",
    actives_contained: ["magnesio"] },
  { id: "IM 15.1", name: "Protocolo IM adjuvante Saúde do Sistema Respiratório", category: "Saúde Respiratória", via: "Intramuscular",
    composition: "Nanomicelas de Quercetina 15mg, NAC 300mg",
    actives_contained: ["nac"] },

  // ── INJETÁVEIS AVULSOS ──
  { id: "INJ_BAIBA", name: "L-BAIBA (ácido L-β-aminoisobutírico) 100mg/1mL", category: "Metabolismo", via: "Endovenoso",
    composition: "L-BAIBA (ácido L-β-aminoisobutírico) 100mg/1mL — diluir em 250mL SF 0,9%, EV lento 45-60min, 1x/semana, 8-10 sessões. Também disponível IM (ventroglúteo/dorsoglúteo).",
    actives_contained: ["l_baiba"] },
];

// ══════════════════════════════════════════════════════════════════════════════
// CAMADA 3 — MATCHING: ativos selecionados → protocolos com maior cobertura
// ══════════════════════════════════════════════════════════════════════════════
function matchProtocolsByActives(
  topActiveIds: string[],
  sex: "M" | "F"
): Array<{ protocol: EssentiaProtocol; coverage: number; matched_actives: string[] }> {
  const activeSet = new Set(topActiveIds);

  const scored = ESSENTIA_PROTOCOLS
    .filter((p) => {
      if (p.sex_restriction && p.sex_restriction !== sex) return false;
      return true;
    })
    .map((p) => {
      const matched = p.actives_contained.filter((a) => activeSet.has(a));
      return { protocol: p, coverage: matched.length, matched_actives: matched };
    })
    .filter((x) => x.coverage > 0)
    .sort((a, b) => {
      // Prioriza cobertura, depois EV sobre IM
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      if (a.protocol.via === "Endovenoso" && b.protocol.via === "Intramuscular") return -1;
      if (a.protocol.via === "Intramuscular" && b.protocol.via === "Endovenoso") return 1;
      return 0;
    });

  // Retornar top 5 (o GPT vai filtrar para 3-4 com justificativa clínica)
  return scored.slice(0, 5);
}

// ══════════════════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ══════════════════════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `Você é um assistente clínico especializado em medicina funcional e integrativa, com profundo conhecimento em interpretação de exames laboratoriais e protocolos de injetáveis terapêuticos.

Sua função é analisar resultados de exames laboratoriais e fornecer uma análise clínica estruturada, EQUILIBRADA e objetiva para uso profissional (nutricionistas, médicos, profissionais de saúde).

REGRAS IMPORTANTES:
1. Use linguagem técnica e profissional em português brasileiro
2. Nunca faça diagnósticos definitivos — use "sugere", "pode indicar", "merece acompanhamento"
3. SEJA EQUILIBRADO: destaque tanto achados positivos quanto os que merecem atenção
4. NÃO SEJA ALARMISTA: tom neutro e analítico. "Merece acompanhamento" > "preocupante"
5. Correlacione marcadores entre si quando houver relação clínica relevante
6. Considere sexo, idade e objetivos do paciente nas interpretações
7. Quando houver múltiplas sessões, identifique tendências — destaque melhorias
8. Seja conciso mas completo — máximo 3-5 pontos por seção

INSTRUÇÕES PARA HIPÓTESES DIAGNÓSTICAS (OBRIGATÓRIO):
- O campo "diagnostic_hypotheses" é OBRIGATÓRIO no JSON de saída
- Gere 2-4 hipóteses diagnósticas ESPECÍFICAS e clinicamente úteis
- NÃO use placeholders genéricos como "análise técnica disponível"
- Cada hipótese deve ser uma condição clínica real e acionável (ex: "Dislipidemia primária", "Síndrome metabólica inicial", "Deficiência funcional de ferro")
- Ordene por probabilidade (probable > possible > unlikely)
- Inclua achados contra (contradicting_findings) quando existirem — isso aumenta a confiança do médico
- Inclua exames confirmatórios específicos para cada hipótese

INSTRUÇÕES PARA FOLLOW-UP (OBRIGATÓRIO):
- O campo "follow_up" é OBRIGATÓRIO no JSON de saída
- suggested_exams: liste os exames mais importantes para o próximo retorno, não repita os já realizados
- suggested_return_days: estime o prazo ideal de retorno (30, 60, 90 dias) baseado na gravidade dos achados
- notes: inclua observações relevantes como "reavaliar após início da suplementação" ou "correlacionar com sintomas clínicos"

INSTRUÇÕES PARA RECOMENDAÇÃO DE PROTOCOLOS (CRÍTICO):
Você receberá:
  (A) Os ATIVOS TERAPÊUTICOS mais relevantes para este paciente (já calculados pelo sistema com base nos marcadores alterados e objetivos)
  (B) Os PROTOCOLOS ESSENTIA que contêm esses ativos (já pré-filtrados)

Sua tarefa é:
1. Confirmar quais ativos são clinicamente justificados para ESTE paciente específico
2. Selecionar os 3-4 protocolos com MAIOR PRECISÃO CLÍNICA (não apenas os com mais ativos em comum)
3. Para cada protocolo selecionado, escrever uma justificativa de 2-3 frases que:
   - Mencione os ativos-chave do protocolo que são relevantes para este paciente
   - Explique o mecanismo clínico no contexto dos marcadores alterados
   - Seja específica (NÃO genérica como "indicado para fadiga")
4. Definir prioridade: "alta" (marcadores críticos ou múltiplos marcadores alterados), "media" (1-2 marcadores alterados), "baixa" (objetivo do paciente sem marcadores alterados)
5. Incluir no campo "key_actives" os 2-3 ativos mais importantes do protocolo para este paciente

FORMATO DE SAÍDA (JSON estrito — TODOS os campos são obrigatórios):
{
  "summary": "Parágrafo de 2-3 frases equilibrado: pontos positivos primeiro, depois atenções",
  "patterns": ["Padrões clínicos identificados — incluir padrões positivos também"],
  "trends": ["Tendências entre sessões — destacar melhorias"],
  "suggestions": ["Sugestões de exames complementares — apenas quando clinicamente justificado"],
  "diagnostic_hypotheses": [
    {
      "hypothesis": "Nome da hipótese diagnóstica específica (ex: Dislipidemia primária, SOP, Deficiência funcional de ferro)",
      "supporting_findings": ["Achado laboratorial ou clínico que sustenta esta hipótese"],
      "contradicting_findings": ["Achado que vai contra esta hipótese, se houver — pode ser array vazio"],
      "confirmatory_exams": ["Exames específicos para confirmar ou refutar esta hipótese"],
      "likelihood": "probable | possible | unlikely",
      "priority": "critical | high | medium | low"
    }
  ],
  "follow_up": {
    "suggested_exams": ["Exames a solicitar no próximo retorno, com justificativa breve"],
    "suggested_return_days": 90,
    "notes": "Observações de acompanhamento relevantes para o médico"
  },
  "full_text": "Análise narrativa completa em 3-5 parágrafos. Tom equilibrado e profissional.",
  "technical_analysis": "DOCUMENTO 1 — ANÁLISE TÉCNICA COMPLETA: texto detalhado com faixas funcionais, cálculos mostrados (ex: HOMA-IR = glicose × insulina / 405), correlações entre marcadores, exames recebidos listados com unidades, exames ausentes sinalizados.",
  "patient_plan": "DOCUMENTO 2 — PLANO DE CONDUTAS: mudanças de estilo de vida, suplementação oral, injetáveis indicados (quando aplicável), acompanhamento proposto. Texto corrido, linguagem acessível para o paciente.",
  "prescription_table": [
    {
      "substancia": "Nome do ativo ou medicamento",
      "dose": "Dose exata com unidade",
      "via": "Oral / EV / IM / Sublingual",
      "frequencia": "Frequência de uso",
      "duracao": "Duração do tratamento",
      "condicoes_ci": "Condições de uso ou contraindicações relevantes",
      "monitorizacao": "O que monitorar durante o uso"
    }
  ],
  "protocol_recommendations": [
    {
      "protocol_id": "EV X.X",
      "protocol_name": "Nome completo",
      "category": "Categoria",
      "via": "Endovenoso ou Intramuscular",
      "composition": "Composição resumida",
      "justification": "Justificativa clínica específica de 2-3 frases mencionando os ativos-chave e os marcadores alterados deste paciente",
      "priority": "alta | media | baixa",
      "key_actives": ["Ativo 1", "Ativo 2", "Ativo 3"]
    }
  ]
}`;


// ══════════════════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════════
// CLINICAL CONTEXT — imports, assembly, fetch
// ══════════════════════════════════════════════════════════════════════════════
import type {
  ClinicalContext,
  ClinicalContextLabs,
  ClinicalHistoryContext,
  PreviousEncounterSnapshot,
  PreviousAnalysisSummary,
  ContextLoaded,
  CanonicalLabResult,
  LabTrend,
  LabStatus,
  BodyCompositionSnapshot,
  BodyCompositionContext,
  ImagingReportSnapshot,
  ImagingReportsContext,
} from "./clinicalContext.types.ts";
import { checkNearLimit, isKeyMarker } from "./clinicalContext.types.ts";
import { mapV1toV2 } from "./buildV2.ts";

// Derived marker IDs (markers calculated from other markers)
const DERIVED_MARKER_IDS = new Set([
  "homa_ir", "relacao_t3_t4", "relacao_albumina_globulina",
  "glicemia_media_estimada", "colesterol_nao_hdl",
]);

/**
 * Builds ClinicalContextLabs from the MarkerResult[] already in the request.
 * This is a deterministic transformation — no new data is fetched or invented.
 */
function buildLabsContext(results: MarkerResult[]): ClinicalContextLabs {
  // Map MarkerResult -> CanonicalLabResult (1:1, no data changes)
  const allResults: CanonicalLabResult[] = results.map((r) => ({
    marker_id: r.marker_id,
    marker_name: r.marker_name,
    value: r.value,
    text_value: r.text_value,
    unit: r.unit,
    status: r.status as LabStatus,
    session_date: r.session_date,
    lab_ref_min: (r as any).lab_min,
    lab_ref_max: (r as any).lab_max,
    functional_min: r.functional_min,
    functional_max: r.functional_max,
    is_derived: DERIVED_MARKER_IDS.has(r.marker_id),
    source: "current" as const,
  }));

  const outOfRange = allResults.filter(
    (r) => r.status === "low" || r.status === "high" || r.status === "critical_low" || r.status === "critical_high"
  );

  const derivedMarkers = allResults.filter((r) => r.is_derived);

  // clinicallyRelevantNormals: normals that are key markers OR near limits
  const normals = allResults.filter((r) => r.status === "normal");
  const clinicallyRelevantNormals: CanonicalLabResult[] = [];
  for (const r of normals) {
    if (isKeyMarker(r.marker_id)) {
      clinicallyRelevantNormals.push({ ...r, relevance_reason: "key_marker" });
    } else if (r.value !== null) {
      const nearReason = checkNearLimit(r.value, r.lab_ref_min, r.lab_ref_max);
      if (nearReason) {
        clinicallyRelevantNormals.push({ ...r, relevance_reason: nearReason });
      }
    }
  }

  // Trends: computed from results with multiple sessions
  const trends: LabTrend[] = [];
  const sessionDates = [...new Set(results.map((r) => r.session_date))].sort();
  if (sessionDates.length > 1) {
    const markerSessions: Record<string, { name: string; entries: Array<{ date: string; value: number }> }> = {};
    for (const r of results) {
      if (r.value !== null) {
        if (!markerSessions[r.marker_id]) {
          markerSessions[r.marker_id] = { name: r.marker_name, entries: [] };
        }
        markerSessions[r.marker_id].entries.push({ date: r.session_date, value: r.value });
      }
    }
    for (const [id, data] of Object.entries(markerSessions)) {
      if (data.entries.length > 1) {
        const sorted = data.entries.sort((a, b) => a.date.localeCompare(b.date));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const deltaPct = first.value !== 0
          ? ((last.value - first.value) / first.value * 100)
          : 0;
        const direction: "up" | "down" | "stable" =
          last.value > first.value ? "up" : last.value < first.value ? "down" : "stable";
        trends.push({
          marker_id: id,
          marker_name: data.name,
          entries: sorted,
          first_value: first.value,
          last_value: last.value,
          delta_percent: Math.round(deltaPct * 10) / 10,
          direction,
          is_improving: null, // Phase 3: add clinical direction awareness
        });
      }
    }
  }

  return { allResults, outOfRange, clinicallyRelevantNormals, derivedMarkers, trends };
}

async function fetchClinicalContext(
  supabaseClient: ReturnType<typeof createClient>,
  patientId: string | undefined,
  specialtyId: string,
  patientProfile: PatientProfile | null | undefined,
  results: MarkerResult[],
  encounterCtx?: EncounterContext | null,
): Promise<{ context: ClinicalContext; loaded: ContextLoaded }> {
  // Build labs context deterministically from results
  const labs = buildLabsContext(results);

  const result: ClinicalContext = {
    anamnese: null,
    structuredAnamnese: null,
    anamneseSource: "none",
    doctorNotes: null,
    patientProfile: patientProfile ?? null,
    labs,
    bodyComposition: null,
    imagingReports: null,
    clinicalHistory: null,
  };

  const loaded: ContextLoaded = {
    anamnesis: false,
    doctorNotes: false,
    bodyComposition: false,
    imagingReports: false,
    clinicalHistory: false,
    patientProfile: !!(patientProfile && (
      (patientProfile.objectives && patientProfile.objectives.length > 0) ||
      patientProfile.activity_level || patientProfile.sport_modality ||
      patientProfile.main_complaints || patientProfile.restrictions
    )),
    labs: {
      total: labs.allResults.length,
      outOfRange: labs.outOfRange.length,
      clinicallyRelevantNormals: labs.clinicallyRelevantNormals.length,
      derivedMarkers: labs.derivedMarkers.length,
      trendsCount: (labs.trends ?? []).length,
    },
  };

  if (!patientId) return { context: result, loaded };

  // Fetch anamnese, doctor notes, body composition, and imaging reports in parallel
  const bodyCompSpecialties = ["nutrologia", "endocrinologia"];
  const imagingSpecialties = ["endocrinologia", "nutrologia", "ginecologia"];
  const shouldFetchBodyComp = bodyCompSpecialties.includes(specialtyId);
  const shouldFetchImaging = imagingSpecialties.includes(specialtyId);

  const [anamneseResult, notesResult, bodyCompResult, imagingResult, encountersResult, analysesResult] = await Promise.all([
    supabaseClient
      .from("patient_anamneses")
      .select("*")
      .eq("patient_id", patientId)
      .eq("specialty_id", specialtyId)
      .single()
      .then(({ data }: { data: unknown }) => data)
      .catch((err: unknown) => { console.warn("Failed to load anamnese:", err); return null; }),
    // DEPRECATED: doctor_specialty_notes is legacy. Kept for backward compat.
    // Superseded by SOAP notes in clinical_evolution_notes.
    supabaseClient
      .from("doctor_specialty_notes")
      .select("*")
      .eq("patient_id", patientId)
      .eq("specialty_id", specialtyId)
      .single()
      .then(({ data }: { data: unknown }) => data)
      .catch((err: unknown) => { console.warn("[DEPRECATED] Failed to load doctor notes:", err); return null; }),
    shouldFetchBodyComp
      ? supabaseClient
          .from("body_composition_sessions")
          .select("session_date, weight_kg, bmi, skeletal_muscle_kg, body_fat_kg, body_fat_pct, visceral_fat_level, total_body_water_l, ecw_tbw_ratio, bmr_kcal, waist_cm, hip_cm, waist_hip_ratio")
          .eq("patient_id", patientId)
          .order("session_date", { ascending: false })
          .limit(2)
          .then(({ data }: { data: unknown }) => data)
          .catch((err: unknown) => { console.warn("Failed to load body composition:", err); return null; })
      : Promise.resolve(null),
    shouldFetchImaging
      ? supabaseClient
          .from("imaging_reports")
          .select("id, report_date, exam_type, exam_region, findings, conclusion, recommendations, incidental_findings, classifications, source_lab, source_type, specialty_id")
          .eq("patient_id", patientId)
          .order("report_date", { ascending: false })
          .limit(6)
          .then(({ data }: { data: unknown }) => data)
          .catch((err: unknown) => { console.warn("Failed to load imaging reports:", err); return null; })
      : Promise.resolve(null),
    // Clinical history: previous encounters
    supabaseClient
      .from("clinical_encounters")
      .select("encounter_date, chief_complaint, status, clinical_evolution_notes(subjective, objective, assessment, plan, medications, exams_requested)")
      .eq("patient_id", patientId)
      .order("encounter_date", { ascending: false })
      .limit(2)
      .then(({ data }: { data: unknown }) => data)
      .catch((err: unknown) => { console.warn("Failed to load encounters:", err); return null; }),
    // Clinical history: previous analyses for same specialty
    supabaseClient
      .from("patient_analyses")
      .select("created_at, specialty_name, summary, patterns, suggestions")
      .eq("patient_id", patientId)
      .eq("specialty_id", specialtyId)
      .order("created_at", { ascending: false })
      .limit(2)
      .then(({ data }: { data: unknown }) => data)
      .catch((err: unknown) => { console.warn("Failed to load analyses:", err); return null; }),
  ]);

  // Parse anamnese — prefer structured_data, fallback to anamnese_text
  if (anamneseResult) {
    const a = anamneseResult as Record<string, unknown>;
    const structuredData = a.structured_data as StructuredAnamnese | null;
    const text = a.anamnese_text as string | null;

    // Check if structured_data has meaningful content
    const hasStructured = structuredData && (
      structuredData.queixa_principal ||
      (structuredData.objetivos && structuredData.objetivos.length > 0) ||
      (structuredData.sintomas && structuredData.sintomas.length > 0) ||
      (structuredData.medicacoes && structuredData.medicacoes.length > 0) ||
      (structuredData.comorbidades && structuredData.comorbidades.length > 0) ||
      (structuredData.suplementos && structuredData.suplementos.length > 0) ||
      (structuredData.alergias && structuredData.alergias.length > 0)
    );

    if (hasStructured) {
      result.structuredAnamnese = structuredData;
      result.anamneseSource = "structured";
      // Keep legacy text for fallback/audit
      if (text && text.trim().length > 0) {
        result.anamnese = text.trim();
      }
      loaded.anamnesis = true;
      console.log("Structured anamnese loaded for patient " + patientId + " (fields: " +
        Object.keys(structuredData!).filter(k => {
          const v = (structuredData as Record<string, unknown>)[k];
          return v && (typeof v === "string" ? v.trim().length > 0 : Array.isArray(v) ? v.length > 0 : v !== null);
        }).length + ")");
    } else if (text && text.trim().length > 0) {
      result.anamnese = text.trim();
      result.anamneseSource = "legacy_text";
      loaded.anamnesis = true;
      console.log("Legacy anamnese text loaded: " + text.length + " chars for patient " + patientId);
    }
  }

  // Parse doctor notes — DEPRECATED: from legacy doctor_specialty_notes table.
  // Kept for backward compat; superseded by SOAP notes in clinical_evolution_notes.
  // TODO: Remove after data migration (see ARCHITECTURE.md).
  if (notesResult) {
    const n = notesResult as Record<string, unknown>;
    const noteLines: string[] = [];
    if (n.impressao_clinica) noteLines.push("Impressao clinica: " + n.impressao_clinica);
    if (n.hipoteses_diagnosticas) noteLines.push("Hipoteses diagnosticas: " + n.hipoteses_diagnosticas);
    if (n.foco_consulta) noteLines.push("Foco desta consulta: " + n.foco_consulta);
    if (n.observacoes_exames) noteLines.push("Observacoes sobre exames: " + n.observacoes_exames);
    if (n.conduta_planejada) noteLines.push("Conduta planejada: " + n.conduta_planejada);
    if (n.pontos_atencao) noteLines.push("Pontos de atencao: " + n.pontos_atencao);
    if (n.medicamentos_prescritos) noteLines.push("Medicamentos ja prescritos: " + n.medicamentos_prescritos);
    if (n.resposta_tratamento) noteLines.push("Resposta ao tratamento anterior: " + n.resposta_tratamento);
    if (n.proximos_passos) noteLines.push("Proximos passos planejados: " + n.proximos_passos);
    if (n.notas_livres) noteLines.push("Notas adicionais: " + n.notas_livres);
    if (n.adesao_tratamento) noteLines.push("Adesao ao tratamento: " + n.adesao_tratamento);
    if (n.motivacao_paciente) noteLines.push("Motivacao do paciente: " + n.motivacao_paciente);
    if (n.exames_em_dia !== null) noteLines.push("Exames em dia: " + (n.exames_em_dia ? "sim" : "nao"));
    if (noteLines.length > 0) {
      result.doctorNotes = noteLines.map(l => "- " + l).join("\n");
      loaded.doctorNotes = true;
      console.log("[DEPRECATED] Doctor notes loaded: " + noteLines.length + " fields for patient " + patientId);
    }
  }

  // Parse body composition
  if (bodyCompResult && Array.isArray(bodyCompResult) && bodyCompResult.length > 0) {
    const mapSession = (row: Record<string, unknown>): BodyCompositionSnapshot => ({
      session_date: row.session_date as string,
      weight_kg: row.weight_kg as number | null,
      bmi: row.bmi as number | null,
      skeletal_muscle_kg: row.skeletal_muscle_kg as number | null,
      body_fat_kg: row.body_fat_kg as number | null,
      body_fat_pct: row.body_fat_pct as number | null,
      visceral_fat_level: row.visceral_fat_level as number | null,
      total_body_water_l: row.total_body_water_l as number | null,
      ecw_tbw_ratio: row.ecw_tbw_ratio as number | null,
      bmr_kcal: row.bmr_kcal as number | null,
      waist_cm: row.waist_cm as number | null,
      hip_cm: row.hip_cm as number | null,
      waist_hip_ratio: row.waist_hip_ratio as number | null,
    });

    // Count total sessions (we fetched limit 2 for current+previous)
    const totalCount = bodyCompResult.length; // approximate; enough for context
    result.bodyComposition = {
      current: mapSession(bodyCompResult[0] as Record<string, unknown>),
      previous: bodyCompResult.length > 1 ? mapSession(bodyCompResult[1] as Record<string, unknown>) : null,
      totalSessions: totalCount,
    };
    loaded.bodyComposition = true;
    console.log("Body composition loaded: " + totalCount + " session(s) for patient " + patientId);
  }

  // Parse imaging reports
  if (imagingResult && Array.isArray(imagingResult) && imagingResult.length > 0) {
    const mapReport = (row: Record<string, unknown>): ImagingReportSnapshot => ({
      id: row.id as string,
      report_date: row.report_date as string,
      exam_type: row.exam_type as string,
      exam_region: (row.exam_region as string | null) ?? null,
      findings: (row.findings as string | null) ?? null,
      conclusion: (row.conclusion as string | null) ?? null,
      recommendations: (row.recommendations as string | null) ?? null,
      incidental_findings: (row.incidental_findings as string | null) ?? null,
      classifications: (row.classifications as string | null) ?? null,
      source_lab: (row.source_lab as string | null) ?? null,
      source_type: (row.source_type as string) ?? "manual",
      specialty_id: (row.specialty_id as string | null) ?? null,
    });

    const allReports = imagingResult.map((r: unknown) => mapReport(r as Record<string, unknown>));
    result.imagingReports = {
      current: allReports[0],
      history: allReports.slice(1),
      totalReports: allReports.length,
    };
    loaded.imagingReports = true;
    console.log("Imaging reports loaded: " + allReports.length + " report(s) for patient " + patientId);
  }

  // Parse clinical history (encounters + previous analyses)
  try {
    const encounters = (encountersResult && Array.isArray(encountersResult)) ? encountersResult : [];
    const analyses = (analysesResult && Array.isArray(analysesResult)) ? analysesResult : [];

    let previousEncounter: PreviousEncounterSnapshot | null = null;
    // Use the most recent finalized encounter as "previous" context
    if (encounters.length > 0) {
      const enc = encounters[0] as Record<string, unknown>;
      const notes = Array.isArray(enc.clinical_evolution_notes)
        ? (enc.clinical_evolution_notes[0] as Record<string, unknown> | undefined)
        : null;
      previousEncounter = {
        encounter_date: enc.encounter_date as string,
        chief_complaint: (enc.chief_complaint as string | null) ?? null,
        status: (enc.status as string) ?? "draft",
        subjective: (notes?.subjective as string | null) ?? null,
        objective: (notes?.objective as string | null) ?? null,
        assessment: (notes?.assessment as string | null) ?? null,
        plan: (notes?.plan as string | null) ?? null,
        medications: (notes?.medications as string | null) ?? null,
        exams_requested: (notes?.exams_requested as string | null) ?? null,
      };
    }

    let previousAnalysis: PreviousAnalysisSummary | null = null;
    // Use the second analysis (first is likely the current one being generated)
    const prevAnalysisRow = analyses.length > 1
      ? (analyses[1] as Record<string, unknown>)
      : analyses.length === 1
        ? (analyses[0] as Record<string, unknown>)
        : null;
    if (prevAnalysisRow) {
      previousAnalysis = {
        created_at: prevAnalysisRow.created_at as string,
        specialty_name: (prevAnalysisRow.specialty_name as string | null) ?? null,
        summary: (prevAnalysisRow.summary as string | null) ?? null,
        patterns: Array.isArray(prevAnalysisRow.patterns) ? (prevAnalysisRow.patterns as string[]) : [],
        suggestions: Array.isArray(prevAnalysisRow.suggestions) ? (prevAnalysisRow.suggestions as string[]) : [],
      };
    }

    if (previousEncounter || previousAnalysis) {
      result.clinicalHistory = {
        previousEncounter,
        previousAnalysis,
        totalEncounters: encounters.length,
        totalAnalyses: analyses.length,
      };
      loaded.clinicalHistory = true;
      console.log("Clinical history loaded: encounter=" + !!previousEncounter + " analysis=" + !!previousAnalysis + " for patient " + patientId);
    }
  } catch (histErr) {
    console.warn("Failed to parse clinical history (non-fatal):", histErr);
  }

  return { context: result, loaded };
}

// ══════════════════════════════════════════════════════════════════════════════
// PROMPT HELPER: format a lab result line for the prompt
// ══════════════════════════════════════════════════════════════════════════════
function formatLabLine(r: CanonicalLabResult, useFunctionalRefs: boolean, includeStatus: boolean): string {
  const valueStr = r.value !== null ? r.value + " " + r.unit : r.text_value ?? "--";
  const labRefStr = r.lab_ref_min !== undefined && r.lab_ref_max !== undefined
    ? "(ref. lab: " + r.lab_ref_min + "-" + r.lab_ref_max + " " + r.unit + ")"
    : "";
  const funcRefStr = useFunctionalRefs && r.functional_min !== undefined && r.functional_max !== undefined
    ? "[faixa funcional: " + r.functional_min + "-" + r.functional_max + "]"
    : "";

  let statusStr = "";
  if (includeStatus) {
    const statusLabels: Record<string, string> = {
      low: "BAIXO", high: "ALTO", critical_low: "CRITICO BAIXO", critical_high: "CRITICO ALTO",
    };
    statusStr = statusLabels[r.status] ?? "";
  }

  let line = "- " + r.marker_name + ": " + valueStr;
  if (statusStr) line += " " + statusStr;
  if (labRefStr) line += " " + labRefStr;
  if (funcRefStr) line += " " + funcRefStr;
  line += " [" + r.session_date + "]";
  return line;
}

// ══════════════════════════════════════════════════════════════════════════════
// BUILD USER PROMPT
// ══════════════════════════════════════════════════════════════════════════════
function buildUserPrompt(
  req: AnalysisRequest,
  scoredActives: ScoredActive[],
  matchedProtocols: Array<{ protocol: EssentiaProtocol; coverage: number; matched_actives: string[] }>,
  clinicalContext: ClinicalContext,
  specialtyIdOverride?: string
): string {
  const activeSpecialty = specialtyIdOverride ?? req.specialty_id ?? "medicina_funcional";
  const useFunctionalRefs = activeSpecialty === "nutrologia";
  const age = req.birth_date
    ? Math.floor((Date.now() - new Date(req.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  const sexLabel = req.sex === "M" ? "Masculino" : "Feminino";
  const ageLabel = age ? age + " anos" : "idade nao informada";
  const labs = clinicalContext.labs;
  const patientSex = req.sex;

  const sessionDates = [...new Set(labs.allResults.map((r) => r.session_date))].sort();

  let prompt = "DADOS DO PACIENTE:\n" +
    "- Nome: " + req.patient_name + "\n" +
    "- Sexo: " + sexLabel + "\n" +
    "- Idade: " + ageLabel + "\n" +
    "- Sessoes: " + sessionDates.length + " (" + sessionDates.join(", ") + ")\n";

  // Perfil do paciente
  const p = clinicalContext.patientProfile;
  if (p) {
    if (p.objectives && p.objectives.length > 0) prompt += "- Objetivos: " + p.objectives.join(", ") + "\n";
    if (p.activity_level) prompt += "- Atividade fisica: " + p.activity_level + "\n";
    if (p.sport_modality) prompt += "- Modalidade: " + p.sport_modality + "\n";
    if (p.main_complaints) prompt += "- Queixas: " + p.main_complaints + "\n";
    if (p.restrictions) prompt += "- Restricoes/alergias: " + p.restrictions + "\n";
  }

  // ── Clinical context sections: Anamnese ──
  const sa = clinicalContext.structuredAnamnese;
  if (sa && clinicalContext.anamneseSource === "structured") {
    prompt += "\nANAMNESE DO PACIENTE (" + activeSpecialty.replace(/_/g, " ") + ") — CAMPOS ESTRUTURADOS:\n";
    if (sa.queixa_principal) prompt += "- Queixa principal: " + sa.queixa_principal + "\n";
    if (sa.objetivos && sa.objetivos.length > 0) prompt += "- Objetivos: " + sa.objetivos.join(", ") + "\n";
    if (sa.sintomas && sa.sintomas.length > 0) prompt += "- Sintomas relevantes: " + sa.sintomas.join(", ") + "\n";
    if (sa.comorbidades && sa.comorbidades.length > 0) prompt += "- Comorbidades: " + sa.comorbidades.join(", ") + "\n";
    if (sa.medicacoes && sa.medicacoes.length > 0) prompt += "- Medicacoes em uso: " + sa.medicacoes.join(", ") + "\n";
    if (sa.suplementos && sa.suplementos.length > 0) prompt += "- Suplementos: " + sa.suplementos.join(", ") + "\n";
    if (sa.alergias && sa.alergias.length > 0) prompt += "- Alergias: " + sa.alergias.join(", ") + "\n";
    if (sa.restricoes_alimentares) prompt += "- Restricoes alimentares: " + sa.restricoes_alimentares + "\n";
    if (sa.cirurgias && sa.cirurgias.length > 0) prompt += "- Cirurgias previas: " + sa.cirurgias.join(", ") + "\n";
    if (sa.historico_familiar) prompt += "- Historico familiar: " + sa.historico_familiar + "\n";
    // Hábitos
    const habitLines: string[] = [];
    if (sa.atividade_fisica) habitLines.push("Atividade fisica: " + sa.atividade_fisica);
    if (sa.qualidade_sono) habitLines.push("Sono: " + (sa.sono_horas ? sa.sono_horas + "h" : "") + " (" + sa.qualidade_sono + ")");
    if (sa.nivel_estresse) habitLines.push("Estresse: " + sa.nivel_estresse);
    if (sa.tabagismo) habitLines.push("Tabagismo: sim");
    if (sa.etilismo) habitLines.push("Etilismo: " + sa.etilismo);
    if (sa.dieta_resumo) habitLines.push("Dieta: " + sa.dieta_resumo);
    if (habitLines.length > 0) {
      prompt += "- Habitos/Estilo de vida: " + habitLines.join("; ") + "\n";
    }
    // Observações livres
    if (sa.observacoes) {
      prompt += "\nOBSERVACOES LIVRES DO MEDICO (texto livre complementar):\n" + sa.observacoes + "\n";
    }
  } else if (clinicalContext.anamnese) {
    // Fallback: texto legado
    prompt += "\nANAMNESE DO PACIENTE (" + activeSpecialty.replace(/_/g, " ") + ") — TEXTO LEGADO:\n" + clinicalContext.anamnese + "\n";
  }
  // DEPRECATED: doctorNotes from legacy doctor_specialty_notes table.
  // Only inject if NO SOAP notes exist (clinicalHistory has encounter data).
  // Once data migration is complete, remove this block entirely.
  if (clinicalContext.doctorNotes && !clinicalContext.clinicalHistory?.previousEncounter) {
    prompt += "\nNOTAS CLINICAS DO MEDICO [LEGADO] (" + activeSpecialty.replace(/_/g, " ") + "):\n" + clinicalContext.doctorNotes + "\n";
    console.log("[DEPRECATED] Legacy doctor notes injected into prompt (no SOAP encounter found)");
  } else if (clinicalContext.doctorNotes) {
    console.log("[DEPRECATED] Legacy doctor notes SKIPPED — SOAP encounter exists, using clinicalHistory instead");
  }

  // ── Clinical history (previous encounter + analysis) ──
  const ch = clinicalContext.clinicalHistory;
  if (ch) {
    prompt += "\nHISTORICO CLINICO ANTERIOR (contexto longitudinal - dados determinísticos de consultas anteriores):\n";
    prompt += "IMPORTANTE: Use este historico para identificar evolucao, resposta a tratamentos anteriores, e o que mudou desde a ultima consulta. Nao altere os dados.\n";

    if (ch.previousEncounter) {
      const enc = ch.previousEncounter;
      prompt += "\nUltima consulta (" + enc.encounter_date + ")";
      if (enc.status === "finalized") prompt += " [finalizada]";
      prompt += ":\n";
      if (enc.chief_complaint) prompt += "  Queixa principal: " + enc.chief_complaint + "\n";
      if (enc.subjective) prompt += "  Subjetivo: " + enc.subjective.slice(0, 500) + "\n";
      if (enc.objective) prompt += "  Objetivo: " + enc.objective.slice(0, 500) + "\n";
      if (enc.assessment) prompt += "  Avaliacao: " + enc.assessment.slice(0, 500) + "\n";
      if (enc.plan) prompt += "  Plano/Conduta: " + enc.plan.slice(0, 500) + "\n";
      if (enc.medications) prompt += "  Medicamentos prescritos: " + enc.medications.slice(0, 300) + "\n";
      if (enc.exams_requested) prompt += "  Exames solicitados: " + enc.exams_requested.slice(0, 300) + "\n";
    }

    if (ch.previousAnalysis) {
      const pa = ch.previousAnalysis;
      prompt += "\nAnalise IA anterior (" + pa.created_at.slice(0, 10) + "):\n";
      if (pa.summary) prompt += "  Resumo: " + pa.summary.slice(0, 600) + "\n";
      if (pa.patterns.length > 0) prompt += "  Padroes identificados: " + pa.patterns.slice(0, 5).join("; ") + "\n";
      if (pa.suggestions.length > 0) prompt += "  Sugestoes anteriores: " + pa.suggestions.slice(0, 5).join("; ") + "\n";
    }

    if (ch.totalEncounters > 1) {
      prompt += "\n(Total de consultas registradas: " + ch.totalEncounters + " | Analises IA para esta especialidade: " + ch.totalAnalyses + ")\n";
    }
    prompt += "\n";
  }

  // ── Body composition (nutrologia / endocrinologia only) ──
  const bodyCompSpecialties = ["nutrologia", "endocrinologia"];
  const bc = clinicalContext.bodyComposition;
  if (bc?.current && bodyCompSpecialties.includes(activeSpecialty)) {
    prompt += "\nCOMPOSICAO CORPORAL (dados deterministicos - bioimpedancia/InBody):\n";
    prompt += "IMPORTANTE: Estes sao dados objetivos de composicao corporal obtidos por bioimpedancia. Use-os como contexto complementar aos exames laboratoriais. Nao altere os valores. Voce DEVE integrar estes dados nas seguintes secoes da sua resposta quando clinicamente relevante: executive_summary, clinical_findings, diagnostic_hypotheses, suggested_actions e follow_up.\n";
    const c = bc.current;
    prompt += "Sessao atual (" + c.session_date + "):\n";
    if (c.weight_kg !== null) prompt += "- Peso: " + c.weight_kg + " kg\n";
    if (c.bmi !== null) prompt += "- IMC: " + c.bmi + " kg/m2\n";
    if (c.skeletal_muscle_kg !== null) prompt += "- Massa muscular esqueletica: " + c.skeletal_muscle_kg + " kg\n";
    if (c.body_fat_kg !== null) prompt += "- Massa de gordura corporal: " + c.body_fat_kg + " kg\n";
    if (c.body_fat_pct !== null) prompt += "- Percentual de gordura: " + c.body_fat_pct + "%\n";
    if (c.visceral_fat_level !== null) prompt += "- Gordura visceral (nivel): " + c.visceral_fat_level + "\n";
    if (c.total_body_water_l !== null) prompt += "- Agua corporal total: " + c.total_body_water_l + " L\n";
    if (c.ecw_tbw_ratio !== null) prompt += "- Relacao ECW/TBW: " + c.ecw_tbw_ratio + "\n";
    if (c.bmr_kcal !== null) prompt += "- TMB/BMR: " + c.bmr_kcal + " kcal\n";
    if (c.waist_cm !== null) prompt += "- Cintura: " + c.waist_cm + " cm\n";
    if (c.hip_cm !== null) prompt += "- Quadril: " + c.hip_cm + " cm\n";
    if (c.waist_hip_ratio !== null) prompt += "- Relacao cintura/quadril: " + c.waist_hip_ratio + "\n";

    // ── Deterministic risk alerts ──
    const alerts: string[] = [];
    if (c.bmi !== null) {
      if (c.bmi >= 30) alerts.push("ALERTA: IMC " + c.bmi + " — Obesidade (>=30). Correlacionar com resistencia insulinica, perfil lipidico e inflamacao.");
      else if (c.bmi >= 25) alerts.push("ATENCAO: IMC " + c.bmi + " — Sobrepeso (25-29.9). Avaliar composicao corporal relativa e risco metabolico.");
      else if (c.bmi < 18.5) alerts.push("ALERTA: IMC " + c.bmi + " — Baixo peso (<18.5). Avaliar desnutricao, sarcopenia e causas secundarias.");
    }
    if (c.visceral_fat_level !== null) {
      if (c.visceral_fat_level >= 13) alerts.push("ALERTA: Gordura visceral nivel " + c.visceral_fat_level + " — Risco elevado (>=13). Forte correlacao com sindrome metabolica e risco cardiovascular.");
      else if (c.visceral_fat_level >= 10) alerts.push("ATENCAO: Gordura visceral nivel " + c.visceral_fat_level + " — Moderadamente elevada (10-12). Monitorar evolucao e correlacionar com marcadores metabolicos.");
    }
    if (c.ecw_tbw_ratio !== null && c.ecw_tbw_ratio > 0.39) {
      alerts.push("ATENCAO: Relacao ECW/TBW " + c.ecw_tbw_ratio + " — Acima do ideal (>0.39). Pode indicar retencao hidrica, inflamacao ou disfuncao renal.");
    }
    if (c.body_fat_pct !== null) {
      // Use sex from outer scope (body.sex)
      const highFatThreshold = patientSex === "F" ? 32 : 25;
      const lowFatThreshold = patientSex === "F" ? 14 : 6;
      if (c.body_fat_pct >= highFatThreshold) alerts.push("ATENCAO: Percentual de gordura " + c.body_fat_pct + "% — Acima do ideal para " + (patientSex === "F" ? "mulheres" : "homens") + " (>=" + highFatThreshold + "%). Correlacionar com perfil metabolico.");
      if (c.body_fat_pct < lowFatThreshold) alerts.push("ATENCAO: Percentual de gordura " + c.body_fat_pct + "% — Abaixo do ideal para " + (patientSex === "F" ? "mulheres" : "homens") + " (<" + lowFatThreshold + "%). Avaliar impacto hormonal e imunologico.");
    }
    if (c.waist_hip_ratio !== null) {
      const highWHR = patientSex === "F" ? 0.85 : 0.90;
      if (c.waist_hip_ratio > highWHR) alerts.push("ATENCAO: Relacao cintura/quadril " + c.waist_hip_ratio + " — Acima do recomendado (>" + highWHR + "). Risco cardiovascular aumentado.");
    }
    if (alerts.length > 0) {
      prompt += "\nAlertas de composicao corporal (deterministicos):\n";
      for (const a of alerts) prompt += "- " + a + "\n";
    }

    // ── Trends vs previous session ──
    if (bc.previous) {
      const prev = bc.previous;
      prompt += "\nTendencia vs sessao anterior (" + prev.session_date + "):\n";
      const comparisons: Array<{ label: string; curr: number | null; prev: number | null; unit: string; upIsBad: boolean }> = [
        { label: "Peso", curr: c.weight_kg, prev: prev.weight_kg, unit: "kg", upIsBad: true },
        { label: "% Gordura", curr: c.body_fat_pct, prev: prev.body_fat_pct, unit: "%", upIsBad: true },
        { label: "Massa muscular", curr: c.skeletal_muscle_kg, prev: prev.skeletal_muscle_kg, unit: "kg", upIsBad: false },
        { label: "Gordura visceral", curr: c.visceral_fat_level, prev: prev.visceral_fat_level, unit: "", upIsBad: true },
        { label: "IMC", curr: c.bmi, prev: prev.bmi, unit: "", upIsBad: true },
        { label: "Agua corporal", curr: c.total_body_water_l, prev: prev.total_body_water_l, unit: "L", upIsBad: false },
        { label: "TMB/BMR", curr: c.bmr_kcal, prev: prev.bmr_kcal, unit: "kcal", upIsBad: false },
      ];
      for (const cmp of comparisons) {
        if (cmp.curr !== null && cmp.prev !== null) {
          const delta = cmp.curr - cmp.prev;
          if (Math.abs(delta) > 0.01) {
            const sign = delta > 0 ? "+" : "";
            const direction = (delta > 0 && cmp.upIsBad) || (delta < 0 && !cmp.upIsBad) ? " (desfavoravel)" : " (favoravel)";
            prompt += "- " + cmp.label + ": " + cmp.prev + " -> " + cmp.curr + " (" + sign + delta.toFixed(1) + " " + cmp.unit + ")" + direction + "\n";
          }
        }
      }
    }

    prompt += "\nOrientacoes para uso da composicao corporal na analise:\n";
    prompt += "- Correlacione composicao corporal com marcadores metabolicos (glicose, insulina, HOMA-IR, perfil lipidico)\n";
    prompt += "- Se houver tendencias, mencione evolucao no executive_summary\n";
    prompt += "- Use os alertas deterministicos como evidencia em diagnostic_hypotheses (ex: sindrome metabolica, sarcopenia)\n";
    prompt += "- Sugira repeticao de bioimpedancia em suggested_actions/follow_up quando pertinente\n";
    prompt += "\n";
  }

  // ── Imaging reports (endocrinologia / nutrologia only) ──
  const imagingSpecialties = ["nutrologia", "endocrinologia", "ginecologia"];
  const ir = clinicalContext.imagingReports;
  if (ir?.current && imagingSpecialties.includes(activeSpecialty)) {
    prompt += "\nLAUDOS DE EXAMES DE IMAGEM (dados deterministicos - transcritos de laudos oficiais):\n";
    prompt += "IMPORTANTE: Estes sao dados textuais extraidos de laudos de imagem. A IA interpreta mas NAO altera o conteudo. Camada complementar a exames laboratoriais e composicao corporal.\n";

    const formatReport = (rpt: typeof ir.current, label: string): string => {
      if (!rpt) return "";
      let block = label + " (" + rpt.report_date + ") - " + rpt.exam_type.replace(/_/g, " ");
      if (rpt.exam_region) block += " [" + rpt.exam_region + "]";
      block += ":\n";
      if (rpt.findings) block += "  Achados: " + rpt.findings + "\n";
      if (rpt.conclusion) block += "  Conclusao: " + rpt.conclusion + "\n";
      if (rpt.recommendations) block += "  Recomendacoes: " + rpt.recommendations + "\n";
      if (rpt.incidental_findings) block += "  Achados incidentais: " + rpt.incidental_findings + "\n";
      if (rpt.classifications) block += "  Classificacoes: " + rpt.classifications + "\n";
      return block;
    };

    prompt += formatReport(ir.current, "Laudo mais recente");

    if (ir.history.length > 0) {
      prompt += "\nHistorico de laudos anteriores (" + ir.history.length + "):\n";
      for (const prev of ir.history) {
        prompt += formatReport(prev, "Laudo");
      }
    }
    prompt += "\n";
  }


  prompt += "\nMARCADORES FORA DA FAIXA LABORATORIAL (" + labs.outOfRange.length + "):\n";
  for (const r of labs.outOfRange) {
    prompt += formatLabLine(r, useFunctionalRefs, true) + "\n";
  }

  // ── Lab results: normals (excluding clinically relevant, listed separately) ──
  const relevantIds = new Set(labs.clinicallyRelevantNormals.map((r) => r.marker_id + "|" + r.session_date));
  const plainNormals = labs.allResults.filter(
    (r) => r.status === "normal" && !relevantIds.has(r.marker_id + "|" + r.session_date)
  );
  prompt += "\nMARCADORES DENTRO DA FAIXA LABORATORIAL (" + plainNormals.length + "):\n";
  for (const r of plainNormals) {
    prompt += formatLabLine(r, useFunctionalRefs, false) + "\n";
  }

  // ── Clinically relevant normals (new section) ──
  if (labs.clinicallyRelevantNormals.length > 0) {
    prompt += "\nMARCADORES NORMAIS CLINICAMENTE RELEVANTES (" + labs.clinicallyRelevantNormals.length + "):\n";
    for (const r of labs.clinicallyRelevantNormals) {
      const reasonLabel = r.relevance_reason === "near_lower_limit" ? "(proximo do limite inferior)"
        : r.relevance_reason === "near_upper_limit" ? "(proximo do limite superior)"
        : r.relevance_reason === "key_marker" ? "(marcador-chave)"
        : "";
      prompt += formatLabLine(r, useFunctionalRefs, false) + " " + reasonLabel + "\n";
    }
  }

  // ── Derived markers (if any, highlighted) ──
  if (labs.derivedMarkers.length > 0) {
    prompt += "\nMARCADORES DERIVADOS/CALCULADOS (" + labs.derivedMarkers.length + "):\n";
    for (const r of labs.derivedMarkers) {
      const statusLabel = r.status !== "normal" ? (" " + (r.status === "high" ? "ALTO" : r.status === "low" ? "BAIXO" : r.status.toUpperCase())) : "";
      prompt += "- " + r.marker_name + ": " + (r.value !== null ? r.value + " " + r.unit : r.text_value ?? "--") + statusLabel + " [" + r.session_date + "]\n";
    }
  }

  // ── Trends ──
  if (labs.trends && labs.trends.length > 0) {
    prompt += "\nTENDENCIAS (multiplas sessoes):\n";
    for (const t of labs.trends) {
      const sign = t.direction === "up" ? "+" : t.direction === "down" ? "-" : "=";
      prompt += "- " + t.marker_name + ": " + t.first_value + " -> " + t.last_value + " (" + sign + " " + t.delta_percent + "%)\n";
    }
  }

  // ── Therapeutic actives (Camada 1+2) ──
  const mode = req.mode ?? "full";
  if (mode !== "analysis_only" && scoredActives.length > 0) {
    prompt += "\n(A) ATIVOS TERAPEUTICOS MAIS RELEVANTES PARA ESTE PACIENTE (calculados pelo sistema):\n";
    prompt += "Os seguintes ativos foram selecionados com base nos marcadores alterados e objetivos do paciente. Confirme quais sao clinicamente justificados:\n\n";
    for (const sa of scoredActives.slice(0, 8)) {
      const triggeredNames = sa.triggered_by.join(", ") || "objetivos do paciente";
      prompt += "* " + sa.active.name + " (score: " + sa.score.toFixed(1) + ")\n";
      prompt += "  Mecanismo: " + sa.active.mechanism + "\n";
      prompt += "  Ativado por: " + triggeredNames + "\n";
      if (sa.active.contraindications) prompt += "  Contraindicacoes: " + sa.active.contraindications + "\n";
      prompt += "\n";
    }

    prompt += "(B) PROTOCOLOS ESSENTIA QUE CONTEM ESSES ATIVOS (pre-filtrados pelo sistema):\n";
    prompt += "Selecione os 3-4 com MAIOR PRECISAO CLINICA para este paciente:\n\n";
    for (const mp of matchedProtocols) {
      prompt += "* " + mp.protocol.id + " | " + mp.protocol.name + " | Via: " + mp.protocol.via + "\n";
      prompt += "  Composicao: " + mp.protocol.composition + "\n";
      prompt += "  Ativos em comum com os selecionados: " + mp.matched_actives.join(", ") + " (" + mp.coverage + " ativos)\n\n";
    }

    prompt += "INSTRUCAO: Para cada protocolo selecionado, escreva uma justificativa ESPECIFICA (nao generica) mencionando os ativos-chave e os marcadores alterados deste paciente. Inclua \"key_actives\" com os 2-3 ativos mais importantes.\n";
  }

  // Instruções por modo
  if (mode === "analysis_only") {
    prompt += "\nMODO: Gere APENAS a analise clinica (summary, patterns, trends, suggestions, full_text, technical_analysis, patient_plan). Retorne \"protocol_recommendations\" como array vazio e \"prescription_table\" como array vazio.\n";
  } else if (mode === "protocols_only") {
    prompt += "\nMODO: Gere APENAS as recomendacoes de protocolos. Retorne summary, patterns, trends, suggestions e full_text como strings/arrays vazios.\n";
  } else {
    prompt += "\nREGRA OBRIGATORIA: O campo \"prescription_table\" NUNCA deve ser retornado como array vazio no modo full.";
    prompt += " Inclua TODOS os suplementos orais, injetaveis e medicamentos recomendados no plano de condutas.";
    prompt += " Cada item DEVE conter: substancia, dose, via, frequencia, duracao, condicoes_ci, monitorizacao.";
    prompt += " Minimo de 3 itens. Se houver suplementacao oral mencionada no patient_plan, ela DEVE aparecer na prescription_table.\n";
  }

  prompt += "\n\nINSTRUÇÕES OBRIGATÓRIAS PARA O JSON DE SAÍDA:";
  prompt += "\n1. O campo 'diagnostic_hypotheses' é OBRIGATÓRIO. Gere 2-4 hipóteses diagnósticas ESPECÍFICAS (ex: 'Dislipidemia primária', 'Deficiência funcional de ferro', 'SOP'). NÃO use placeholders genéricos. Cada hipótese deve ter: hypothesis, supporting_findings, contradicting_findings (array vazio se não houver), confirmatory_exams, likelihood (probable/possible/unlikely), priority.";
  prompt += "\n2. O campo 'follow_up' é OBRIGATÓRIO. Deve conter: suggested_exams (exames para o próximo retorno), suggested_return_days (30/60/90 dias), notes (observações de acompanhamento).";
  prompt += "\nRetorne um JSON com a analise clinica estruturada conforme o formato especificado.";
  return prompt;
}

// ══════════════════════════════════════════════════════════════════════════════
// ROBUST FALLBACK: Extract partial analysis from truncated/malformed JSON
// ══════════════════════════════════════════════════════════════════════════════
function extractPartialAnalysis(raw: string): AnalysisResponse {
  const result: AnalysisResponse = {
    summary: "",
    patterns: [],
    trends: [],
    suggestions: [],
    full_text: raw,
    protocol_recommendations: [],
  };

  // Try to fix truncated JSON by closing open brackets/braces
  const fixedJson = tryFixTruncatedJson(raw);
  if (fixedJson) {
    try {
      const parsed = JSON.parse(fixedJson);
      return {
        summary: parsed.summary ?? "",
        patterns: parsed.patterns ?? [],
        trends: parsed.trends ?? [],
        suggestions: parsed.suggestions ?? [],
        full_text: parsed.full_text ?? raw,
        technical_analysis: parsed.technical_analysis,
        patient_plan: parsed.patient_plan,
        prescription_table: parsed.prescription_table,
        protocol_recommendations: parsed.protocol_recommendations ?? [],
      };
    } catch { /* fall through to regex extraction */ }
  }

  // Regex extraction as last resort
  const extractString = (key: string): string | undefined => {
    const regex = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)`, "s");
    const match = raw.match(regex);
    return match?.[1]?.replace(/\\n/g, "\n").replace(/\\"/g, '"');
  };

  const extractArray = (key: string): string[] => {
    const regex = new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)`, "s");
    const match = raw.match(regex);
    if (!match) return [];
    try {
      return JSON.parse(`[${match[1]}]`);
    } catch {
      // Extract quoted strings
      const items: string[] = [];
      const strRegex = /"((?:[^"\\]|\\.)*)"/g;
      let m;
      while ((m = strRegex.exec(match[1])) !== null) items.push(m[1]);
      return items;
    }
  };

  // Extract prescription_table (array of objects) via regex
  const extractObjectArray = (key: string): any[] => {
    const regex = new RegExp(`"${key}"\\s*:\\s*\\[`, "s");
    const match = regex.exec(raw);
    if (!match) return [];
    // Find the matching closing bracket
    let depth = 0;
    let start = match.index + match[0].length - 1; // position of '['
    for (let i = start; i < raw.length; i++) {
      if (raw[i] === "[") depth++;
      else if (raw[i] === "]") { depth--; if (depth === 0) { try { return JSON.parse(raw.slice(start, i + 1)); } catch { return []; } } }
    }
    return [];
  };

  result.summary = extractString("summary") ?? raw.slice(0, 300);
  result.technical_analysis = extractString("technical_analysis");
  result.patient_plan = extractString("patient_plan");
  result.prescription_table = extractObjectArray("prescription_table");
  result.patterns = extractArray("patterns");
  result.trends = extractArray("trends");
  result.suggestions = extractArray("suggestions");

  console.log(
    `Partial extraction: summary=${!!result.summary} technical=${!!result.technical_analysis} ` +
    `plan=${!!result.patient_plan} prescription=${(result.prescription_table ?? []).length} patterns=${result.patterns.length}`
  );

  return result;
}

function tryFixTruncatedJson(raw: string): string | null {
  let s = raw.trim();
  // Remove markdown code fences if present
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "").trim();
  }
  if (!s.startsWith("{")) return null;

  // Count open/close braces and brackets
  let braces = 0, brackets = 0, inString = false, escaped = false;
  for (const ch of s) {
    if (escaped) { escaped = false; continue; }
    if (ch === "\\") { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") braces++;
    if (ch === "}") braces--;
    if (ch === "[") brackets++;
    if (ch === "]") brackets--;
  }

  // Close any remaining open structures
  if (inString) s += '"';
  while (brackets > 0) { s += "]"; brackets--; }
  while (braces > 0) { s += "}"; braces--; }

  return s;
}

// ══════════════════════════════════════════════════════════════════════════════
// HANDLER PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const startMs = Date.now();
    const body: AnalysisRequest = await req.json();

    if (!body.patient_name || !body.results || body.results.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: patient_name, results" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ── Single Supabase client (service role) for all DB reads ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Supabase config missing");
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // ── Prompt Engine: carregar prompt do banco por especialidade ──
    const specialtyId = body.specialty_id ?? "medicina_funcional";
    let activeSystemPrompt = SYSTEM_PROMPT;
    let specialtyHasProtocols = true;
    try {
      const { data: promptData, error: promptError } = await serviceClient
        .from("analysis_prompts")
        .select("system_prompt, has_protocols")
        .eq("specialty_id", specialtyId)
        .eq("is_active", true)
        .single();
      if (!promptError && promptData?.system_prompt) {
        activeSystemPrompt = promptData.system_prompt;
        specialtyHasProtocols = promptData.has_protocols ?? false;
        console.log("Loaded prompt for specialty: " + specialtyId);
      } else {
        console.warn("Prompt not found for specialty '" + specialtyId + "', using default. Error: " + (promptError?.message ?? "none"));
      }
    } catch (promptLoadError) {
      console.warn("Failed to load prompt from DB, using default:", promptLoadError);
    }

    // ── Fetch clinical context (anamnese + doctor notes + labs) ──
    const { context: clinicalContext, loaded: contextLoaded } = await fetchClinicalContext(
      serviceClient,
      body.patient_id,
      specialtyId,
      body.patient_profile,
      body.results,
    );

    // Camada 1+2: Score de ativos terapeuticos (using labs.outOfRange from context)
    const abnormalResults = body.results.filter(
      (r) => r.status === "low" || r.status === "high" || r.status === "critical_low" || r.status === "critical_high"
    );
    const objectives = body.patient_profile?.objectives ?? [];
    const scoredActives = scoreActives(abnormalResults, body.sex, objectives);

    // Camada 3: Mapear ativos -> protocolos Essentia (apenas para especialidades com protocolos)
    const topActiveIds = specialtyHasProtocols ? scoredActives.slice(0, 8).map((sa) => sa.active.id) : [];
    const matchedProtocols = specialtyHasProtocols ? matchProtocolsByActives(topActiveIds, body.sex) : [];

    // Se a especialidade nao tem protocolos, forcar modo analysis_only
    const effectiveMode = !specialtyHasProtocols ? "analysis_only" : (body.mode ?? "full");
    const bodyWithMode = { ...body, mode: effectiveMode };

    const userPrompt = buildUserPrompt(bodyWithMode, scoredActives, matchedProtocols, clinicalContext, specialtyId);
    console.log(
      "Analyzing " + body.results.length + " markers for " + body.patient_name + " | specialty: " + specialtyId + " | " +
      "labs: " + contextLoaded.labs.total + " total, " + contextLoaded.labs.outOfRange + " OOR, " +
      contextLoaded.labs.clinicallyRelevantNormals + " relevant normals, " + contextLoaded.labs.trendsCount + " trends | " +
      abnormalResults.length + " abnormal | " + scoredActives.length + " actives scored | " +
      matchedProtocols.length + " protocols matched | has_protocols: " + specialtyHasProtocols +
      " | context: anamnesis=" + contextLoaded.anamnesis + " notes=" + contextLoaded.doctorNotes + " profile=" + contextLoaded.patientProfile + " bodyComp=" + contextLoaded.bodyComposition
    );

    // ── Dynamic max_tokens by mode ──
    const MAX_TOKENS_BY_MODE: Record<string, number> = {
      analysis_only: 6000,
      protocols_only: 8000,
      full: 12000,
    };
    const maxTokens = MAX_TOKENS_BY_MODE[effectiveMode] ?? 12000;

    // ── AbortController with 90s timeout ──
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);

    let response: Response;
    try {
      response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          temperature: 0.25,
          max_tokens: maxTokens,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: activeSystemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
        console.error("AI gateway timeout after 90s");
        return new Response(JSON.stringify({ error: "A análise excedeu o tempo limite (90s). Tente novamente ou use o modo 'Análise Rápida'." }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway returned ${response.status}: ${errText}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;
    const finishReason = aiResponse.choices?.[0]?.finish_reason;
    const usage = aiResponse.usage;

    console.log(
      `AI response | finish_reason: ${finishReason} | ` +
      `completion_tokens: ${usage?.completion_tokens ?? "?"} | ` +
      `content_length: ${content?.length ?? 0}`
    );

    if (!content) throw new Error("Empty response from AI");

    if (finishReason === "length") {
      console.warn("⚠ Response was TRUNCATED (finish_reason=length). Attempting partial extraction.");
    }

    let analysis: AnalysisResponse;
    try {
      analysis = JSON.parse(content);
    } catch (parseError) {
      console.warn("JSON.parse failed, attempting robust extraction:", (parseError as Error).message);
      analysis = extractPartialAnalysis(content);
    }

    const isTruncated = finishReason === "length";
    const durationMs = Date.now() - startMs;

    // ── Build V2 payload (deterministic + LLM mapping) ──
    let analysisV2 = null;
    try {
      // Resolve specialty name for meta
      let specialtyName = specialtyId.replace(/_/g, " ");
      try {
        const { data: spData } = await serviceClient
          .from("analysis_prompts")
          .select("specialty_name")
          .eq("specialty_id", specialtyId)
          .single();
        if (spData?.specialty_name) specialtyName = spData.specialty_name;
      } catch { /* use fallback name */ }

      analysisV2 = mapV1toV2(
        analysis,
        clinicalContext,
        specialtyId,
        specialtyName,
        effectiveMode as "full" | "analysis_only" | "protocols_only",
        "google/gemini-2.5-flash",
      );
      console.log(
        `V2 built: ${analysisV2.red_flags.length} red_flags, ` +
        `${analysisV2.clinical_findings.length} findings, ` +
        `${analysisV2.diagnostic_hypotheses.length} hypotheses, ` +
        `${analysisV2.suggested_actions.length} actions`
      );
    } catch (v2Err) {
      console.warn("V2 build failed (non-blocking):", v2Err);
    }

    // Fire-and-forget: log AI call for observability (needs auth client for RLS)
    try {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const logClient = createClient(supabaseUrl!, supabaseServiceKey!, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: userData } = await logClient.auth.getUser();
        const practitionerId = userData?.user?.id;
        if (practitionerId) {
          logClient.from("ai_call_logs").insert({
            practitioner_id: practitionerId,
            patient_id: body.patient_id ?? null,
            specialty_id: specialtyId,
            mode: effectiveMode,
            input_tokens: usage?.prompt_tokens ?? null,
            output_tokens: usage?.completion_tokens ?? null,
            finish_reason: finishReason,
            success: true,
            duration_ms: durationMs,
          }).then((_res: unknown) => {}, (e: unknown) => console.warn("ai_call_logs insert failed:", e));
        }
      }
    } catch (logErr) {
      console.warn("ai_call_logs error (non-blocking):", logErr);
    }

    return new Response(
      JSON.stringify({
        analysis,
        analysis_v2: analysisV2,
        specialty_id: specialtyId,
        _truncated: isTruncated,
        _context_loaded: { ...contextLoaded, anamneseSource: clinicalContext.anamneseSource ?? "none" },
        _diagnostics: {
          finish_reason: finishReason,
          completion_tokens: usage?.completion_tokens,
          content_length: content.length,
          max_tokens: maxTokens,
          mode: effectiveMode,
          duration_ms: durationMs,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("analyze-lab-results error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
