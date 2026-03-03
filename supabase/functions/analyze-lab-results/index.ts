import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

FORMATO DE SAÍDA (JSON estrito):
{
  "summary": "Parágrafo de 2-3 frases equilibrado: pontos positivos primeiro, depois atenções",
  "patterns": ["Padrões clínicos identificados — incluir padrões positivos também"],
  "trends": ["Tendências entre sessões — destacar melhorias"],
  "suggestions": ["Sugestões de exames complementares — apenas quando clinicamente justificado"],
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
// BUILD USER PROMPT
// ══════════════════════════════════════════════════════════════════════════════
function buildUserPrompt(
  req: AnalysisRequest,
  scoredActives: ScoredActive[],
  matchedProtocols: Array<{ protocol: EssentiaProtocol; coverage: number; matched_actives: string[] }>
): string {
  const age = req.birth_date
    ? Math.floor((Date.now() - new Date(req.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  const sexLabel = req.sex === "M" ? "Masculino" : "Feminino";
  const ageLabel = age ? `${age} anos` : "idade não informada";

  const sessionDates = [...new Set(req.results.map((r) => r.session_date))].sort();
  const abnormal = req.results.filter(
    (r) => r.status === "low" || r.status === "high" || r.status === "critical_low" || r.status === "critical_high"
  );
  const normal = req.results.filter((r) => r.status === "normal");

  let prompt = `DADOS DO PACIENTE:
- Nome: ${req.patient_name}
- Sexo: ${sexLabel}
- Idade: ${ageLabel}
- Sessões: ${sessionDates.length} (${sessionDates.join(", ")})
`;

  // Perfil do paciente
  if (req.patient_profile) {
    const p = req.patient_profile;
    if (p.objectives && p.objectives.length > 0) prompt += `- Objetivos: ${p.objectives.join(", ")}\n`;
    if (p.activity_level) prompt += `- Atividade física: ${p.activity_level}\n`;
    if (p.sport_modality) prompt += `- Modalidade: ${p.sport_modality}\n`;
    if (p.main_complaints) prompt += `- Queixas: ${p.main_complaints}\n`;
    if (p.restrictions) prompt += `- Restrições/alergias: ${p.restrictions}\n`;
  }

  prompt += `\nMARCADORES FORA DA FAIXA LABORATORIAL (${abnormal.length}):\n`;
  for (const r of abnormal) {
    const valueStr = r.value !== null ? `${r.value} ${r.unit}` : r.text_value ?? "—";
    // Referência laboratorial convencional (base para status)
    const labRefStr = (r as any).lab_min !== undefined && (r as any).lab_max !== undefined
      ? `(ref. lab: ${(r as any).lab_min}–${(r as any).lab_max} ${r.unit})`
      : "";
    // Referência funcional (contexto adicional para a IA)
    const funcRefStr = r.functional_min !== undefined && r.functional_max !== undefined
      ? `[faixa funcional: ${r.functional_min}–${r.functional_max}]`
      : "";
    const statusLabels: Record<string, string> = {
      low: "↓ BAIXO", high: "↑ ALTO", critical_low: "⬇ CRÍTICO BAIXO", critical_high: "⬆ CRÍTICO ALTO",
    };
    prompt += `- ${r.marker_name}: ${valueStr} ${statusLabels[r.status] ?? r.status} ${labRefStr} ${funcRefStr} [${r.session_date}]\n`;
  }

  prompt += `\nMARCADORES DENTRO DA FAIXA LABORATORIAL (${normal.length}):\n`;
  for (const r of normal) {
    const valueStr = r.value !== null ? `${r.value} ${r.unit}` : r.text_value ?? "—";
    // Incluir referência funcional se diferente da laboratorial (para contexto clínico)
    const funcRefStr = r.functional_min !== undefined && r.functional_max !== undefined
      ? `[faixa funcional: ${r.functional_min}–${r.functional_max}]`
      : "";
    prompt += `- ${r.marker_name}: ${valueStr} ${funcRefStr} [${r.session_date}]\n`;
  }

  // Tendências entre sessões
  if (sessionDates.length > 1) {
    prompt += `\nTENDÊNCIAS (múltiplas sessões):\n`;
    const markerSessions: Record<string, Array<{ date: string; value: number }>> = {};
    for (const r of req.results) {
      if (r.value !== null) {
        if (!markerSessions[r.marker_name]) markerSessions[r.marker_name] = [];
        markerSessions[r.marker_name].push({ date: r.session_date, value: r.value });
      }
    }
    for (const [name, entries] of Object.entries(markerSessions)) {
      if (entries.length > 1) {
        const sorted = entries.sort((a, b) => a.date.localeCompare(b.date));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const delta = ((last.value - first.value) / first.value * 100).toFixed(1);
        const trend = last.value > first.value ? "↑" : last.value < first.value ? "↓" : "→";
        prompt += `- ${name}: ${first.value} → ${last.value} (${trend} ${delta}%)\n`;
      }
    }
  }

  // Ativos terapêuticos pré-selecionados (Camada 1+2)
  const mode = req.mode ?? "full";
  if (mode !== "analysis_only" && scoredActives.length > 0) {
    prompt += `\n(A) ATIVOS TERAPÊUTICOS MAIS RELEVANTES PARA ESTE PACIENTE (calculados pelo sistema):\n`;
    prompt += `Os seguintes ativos foram selecionados com base nos marcadores alterados e objetivos do paciente. Confirme quais são clinicamente justificados:\n\n`;
    for (const sa of scoredActives.slice(0, 8)) {
      const triggeredNames = sa.triggered_by.join(", ") || "objetivos do paciente";
      prompt += `• ${sa.active.name} (score: ${sa.score.toFixed(1)})\n`;
      prompt += `  Mecanismo: ${sa.active.mechanism}\n`;
      prompt += `  Ativado por: ${triggeredNames}\n`;
      if (sa.active.contraindications) prompt += `  ⚠ Contraindicações: ${sa.active.contraindications}\n`;
      prompt += `\n`;
    }

    prompt += `(B) PROTOCOLOS ESSENTIA QUE CONTÊM ESSES ATIVOS (pré-filtrados pelo sistema):\n`;
    prompt += `Selecione os 3-4 com MAIOR PRECISÃO CLÍNICA para este paciente:\n\n`;
    for (const mp of matchedProtocols) {
      prompt += `• ${mp.protocol.id} | ${mp.protocol.name} | Via: ${mp.protocol.via}\n`;
      prompt += `  Composição: ${mp.protocol.composition}\n`;
      prompt += `  Ativos em comum com os selecionados: ${mp.matched_actives.join(", ")} (${mp.coverage} ativos)\n\n`;
    }

    prompt += `INSTRUÇÃO: Para cada protocolo selecionado, escreva uma justificativa ESPECÍFICA (não genérica) mencionando os ativos-chave e os marcadores alterados deste paciente. Inclua "key_actives" com os 2-3 ativos mais importantes.\n`;
  }

  // Instruções por modo
  if (mode === "analysis_only") {
    prompt += `\nMODO: Gere APENAS a análise clínica (summary, patterns, trends, suggestions, full_text, technical_analysis, patient_plan). Retorne "protocol_recommendations" como array vazio e "prescription_table" como array vazio.\n`;
  } else if (mode === "protocols_only") {
    prompt += `\nMODO: Gere APENAS as recomendações de protocolos. Retorne summary, patterns, trends, suggestions e full_text como strings/arrays vazios.\n`;
  } else {
    // modo full — reforçar que prescription_table NÃO pode ser vazio
    prompt += `\n⚠ REGRA OBRIGATÓRIA: O campo "prescription_table" NUNCA deve ser retornado como array vazio no modo full.`;
    prompt += ` Inclua TODOS os suplementos orais, injetáveis e medicamentos recomendados no plano de condutas.`;
    prompt += ` Cada item DEVE conter: substancia, dose, via, frequencia, duracao, condicoes_ci, monitorizacao.`;
    prompt += ` Mínimo de 3 itens. Se houver suplementação oral mencionada no patient_plan, ela DEVE aparecer na prescription_table.\n`;
  }

  prompt += `\nRetorne um JSON com a análise clínica estruturada conforme o formato especificado.`;
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

    // ── Prompt Engine: carregar prompt do banco por especialidade ──
    const specialtyId = body.specialty_id ?? "medicina_funcional";
    let activeSystemPrompt = SYSTEM_PROMPT; // fallback para o prompt hardcoded
    let specialtyHasProtocols = true;
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        const { data: promptData, error: promptError } = await supabase
          .from("analysis_prompts")
          .select("system_prompt, has_protocols")
          .eq("specialty_id", specialtyId)
          .eq("is_active", true)
          .single();
        if (!promptError && promptData?.system_prompt) {
          activeSystemPrompt = promptData.system_prompt;
          specialtyHasProtocols = promptData.has_protocols ?? false;
          console.log(`Loaded prompt for specialty: ${specialtyId}`);
        } else {
          console.warn(`Prompt not found for specialty '${specialtyId}', using default. Error: ${promptError?.message}`);
        }
      }
    } catch (promptLoadError) {
      console.warn("Failed to load prompt from DB, using default:", promptLoadError);
    }

    // ── Buscar anamnese do paciente para enriquecer o prompt ──
    let anamneseContext = "";
    if (body.patient_id) {
      try {
        const supabaseUrl2 = Deno.env.get("SUPABASE_URL");
        const supabaseKey2 = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
        if (supabaseUrl2 && supabaseKey2) {
          const supabaseClient2 = createClient(supabaseUrl2, supabaseKey2);
          const { data: anamneseData } = await supabaseClient2
            .from("patient_anamneses")
            .select("*")
            .eq("patient_id", body.patient_id)
            .eq("specialty_id", specialtyId)
            .single();
          if (anamneseData) {
            const a = anamneseData as Record<string, unknown>;
            const lines: string[] = [];
            if (a.expectativa_consulta) lines.push(`Expectativa: ${a.expectativa_consulta}`);
            if (a.queixas_principais) lines.push(`Queixas principais: ${a.queixas_principais}`);
            if (a.objetivos) lines.push(`Objetivos: ${a.objetivos}`);
            if (a.nota_saude !== null && a.nota_saude !== undefined) lines.push(`Nota de saude (0-10): ${a.nota_saude}`);
            if (a.o_que_melhoraria) lines.push(`O que melhoraria: ${a.o_que_melhoraria}`);
            if (a.fase_melhor) lines.push(`Fase melhor: ${a.fase_melhor}`);
            if (a.evento_marcante) lines.push(`Evento marcante: ${a.evento_marcante}`);
            if (a.comorbidades) lines.push(`Comorbidades/historico: ${a.comorbidades}`);
            if (a.peso_altura) lines.push(`Peso/Altura: ${a.peso_altura}`);
            if (a.tipo_sanguineo) lines.push(`Tipo sanguineo: ${a.tipo_sanguineo}`);
            if (a.suplementacao) lines.push(`Suplementacao atual: ${a.suplementacao}`);
            if (a.medicamentos_continuos) lines.push(`Medicamentos continuos: ${a.medicamentos_continuos}`);
            if (a.estado_pele) lines.push(`Pele: ${a.estado_pele}`);
            if (a.estado_cabelos) lines.push(`Cabelos: ${a.estado_cabelos}`);
            if (a.estado_unhas) lines.push(`Unhas: ${a.estado_unhas}`);
            if (a.memoria_concentracao) lines.push(`Memoria/concentracao: ${a.memoria_concentracao}`);
            if (a.imunidade) lines.push(`Imunidade: ${a.imunidade}`);
            if (a.consumo_cafe) lines.push(`Consumo de cafe: ${a.consumo_cafe}`);
            if (Array.isArray(a.habitos) && (a.habitos as string[]).length > 0) lines.push(`Habitos: ${(a.habitos as string[]).join(", ")}`);
            if (Array.isArray(a.sintomas_atuais) && (a.sintomas_atuais as string[]).length > 0) lines.push(`Sintomas atuais: ${(a.sintomas_atuais as string[]).join(", ")}`);
            if (a.evacuacoes_por_dia) lines.push(`Evacuacoes/dia: ${a.evacuacoes_por_dia}`);
            if (a.tipo_fezes) lines.push(`Tipo de fezes (Bristol): ${a.tipo_fezes}`);
            if (a.uso_antibiotico_2anos) lines.push(`Antibiotico ultimos 2 anos: ${a.uso_antibiotico_2anos}`);
            if (a.estufamento_gases) lines.push(`Estufamento/gases: ${a.estufamento_gases}`);
            if (a.litros_agua_dia) lines.push(`Agua/dia: ${a.litros_agua_dia}`);
            if (a.dorme_bem) lines.push(`Dorme bem: ${a.dorme_bem}`);
            if (a.horario_sono) lines.push(`Horario de sono: ${a.horario_sono}`);
            if (a.acorda_cansado) lines.push(`Acorda: ${a.acorda_cansado}`);
            if (a.dificuldade_dormir) lines.push(`Dificuldade de dormir: ${a.dificuldade_dormir}`);
            if (a.nivel_estresse !== null && a.nivel_estresse !== undefined) lines.push(`Nivel de estresse (0-10): ${a.nivel_estresse}`);
            if (a.faz_terapia) lines.push(`Terapia: ${a.faz_terapia}`);
            if (a.atividade_relaxamento) lines.push(`Relaxamento: ${a.atividade_relaxamento}`);
            if (a.hobbies) lines.push(`Hobbies: ${a.hobbies}`);
            if (a.atividade_fisica) lines.push(`Atividade fisica: ${a.atividade_fisica}`);
            if (a.recordatorio_alimentar) lines.push(`Recordatorio alimentar: ${a.recordatorio_alimentar}`);
            if (a.intolerancias_alimentares) lines.push(`Intolerancias alimentares: ${a.intolerancias_alimentares}`);
            if (a.episodios_compulsao) lines.push(`Compulsao alimentar: ${a.episodios_compulsao}`);
            if (a.culpa_apos_comer) lines.push(`Culpa apos comer: ${a.culpa_apos_comer}`);
            if (a.preferencias_alimentares) lines.push(`Preferencias alimentares: ${a.preferencias_alimentares}`);
            if (a.aversoes_alimentares) lines.push(`Aversoes alimentares: ${a.aversoes_alimentares}`);
            if (a.ciclo_regular) lines.push(`Ciclo menstrual: ${a.ciclo_regular}`);
            if (a.metodo_contraceptivo) lines.push(`Contraceptivo: ${a.metodo_contraceptivo}`);
            if (a.deseja_engravidar) lines.push(`Deseja engravidar: ${a.deseja_engravidar}`);
            if (a.tem_tpm) lines.push(`TPM: ${a.tem_tpm}`);
            if (a.specialty_data && typeof a.specialty_data === "object") {
              const sd = a.specialty_data as Record<string, string>;
              for (const [k, v] of Object.entries(sd)) {
                if (v) lines.push(`${k.replace(/_/g, " ")}: ${v}`);
              }
            }
            if (lines.length > 0) {
              anamneseContext = `\nANAMNESE DO PACIENTE (${specialtyId.replace(/_/g, " ")}):\n` + lines.map(l => `- ${l}`).join("\n") + "\n";
              console.log(`Anamnese loaded: ${lines.length} fields for patient ${body.patient_id}`);
            }
          }
        }
      } catch (anamneseError) {
        console.warn("Failed to load anamnese:", anamneseError);
      }
    }

    // Camada 1+2: Score de ativos terapeuticos
    const abnormalResults = body.results.filter(
      (r) => r.status === "low" || r.status === "high" || r.status === "critical_low" || r.status === "critical_high"
    );
    const objectives = body.patient_profile?.objectives ?? [];
    const scoredActives = scoreActives(abnormalResults, body.sex, objectives);

    // Camada 3: Mapear ativos → protocolos Essentia (apenas para especialidades com protocolos)
    const topActiveIds = specialtyHasProtocols ? scoredActives.slice(0, 8).map((sa) => sa.active.id) : [];
    const matchedProtocols = specialtyHasProtocols ? matchProtocolsByActives(topActiveIds, body.sex) : [];

    // Se a especialidade não tem protocolos, forçar modo analysis_only
    const effectiveMode = !specialtyHasProtocols ? "analysis_only" : (body.mode ?? "full");
    const bodyWithMode = { ...body, mode: effectiveMode };

     const userPromptBase = buildUserPrompt(bodyWithMode, scoredActives, matchedProtocols);
    // Injetar anamnese no prompt logo apos os dados do paciente (antes dos marcadores)
    const userPrompt = anamneseContext
      ? userPromptBase.replace("\nMARCADORES FORA DA FAIXA", anamneseContext + "\nMARCADORES FORA DA FAIXA")
      : userPromptBase;
    console.log(
      `Analyzing ${body.results.length} markers for ${body.patient_name} | specialty: ${specialtyId} | ` +
      `${abnormalResults.length} abnormal | ${scoredActives.length} actives scored | ` +
      `${matchedProtocols.length} protocols matched | has_protocols: ${specialtyHasProtocols}`
    );

    // ── Dynamic max_tokens by mode ──
    const MAX_TOKENS_BY_MODE: Record<string, number> = {
      analysis_only: 6000,
      protocols_only: 8000,
      full: 16384,
    };
    const maxTokens = MAX_TOKENS_BY_MODE[effectiveMode] ?? 16384;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
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

    // Fire-and-forget: log AI call for observability
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
      const authHeader = req.headers.get("Authorization");
      if (supabaseUrl && supabaseKey && authHeader) {
        const logClient = createClient(supabaseUrl, supabaseKey, {
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
          }).then(() => {}).catch((e: any) => console.warn("ai_call_logs insert failed:", e));
        }
      }
    } catch (logErr) {
      console.warn("ai_call_logs error (non-blocking):", logErr);
    }

    return new Response(
      JSON.stringify({
        analysis,
        specialty_id: specialtyId,
        _truncated: isTruncated,
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
