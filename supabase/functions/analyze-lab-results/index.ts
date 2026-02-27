import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  sex: "M" | "F";
  birth_date?: string;
  sessions: Array<{ id: string; session_date: string }>;
  results: MarkerResult[];
  mode?: "full" | "analysis_only" | "protocols_only";
  patient_profile?: PatientProfile | null;
}

interface ProtocolRecommendation {
  protocol_id: string;
  protocol_name: string;
  category: string;
  via: string;
  composition: string;
  justification: string;
  priority: "alta" | "media" | "baixa";
}

interface AnalysisResponse {
  summary: string;
  patterns: string[];
  trends: string[];
  suggestions: string[];
  full_text: string;
  protocol_recommendations?: ProtocolRecommendation[];
}

// ── Catálogo de Protocolos Essentia Pharma ──────────────────────────────────
// Cada protocolo define os marcadores que, quando alterados, tornam o protocolo relevante.
// markers_indicated: IDs dos marcadores do LabTrack que ativam a sugestão deste protocolo.
const ESSENTIA_PROTOCOLS = [
  // ── ENDOVENOSOS: Imunidade, Inflamação e Antioxidante ──
  {
    id: "EV 1.1", name: "Protocolo adjuvante para Imunidade", category: "Suporte para imunidade, inflamação e antioxidante",
    via: "Endovenoso",
    composition: "Alanil Glutamina 120mg/2mL, Complexo B sem B1 /2mL, NAC 300mg/2mL, L-Glutathion 100mg/2mL, Minerais /2mL (Cromo, Manganês, Magnésio, Zinco, Selênio, Cobre)",
    markers_indicated: ["pcr", "vhs", "zinco", "selenio", "vitamina_d", "vitamina_c", "linfocitos", "neutrofilos"],
  },
  {
    id: "EV 1.2", name: "Protocolo adjuvante Anti-inflamatório", category: "Suporte para imunidade, inflamação e antioxidante",
    via: "Endovenoso",
    composition: "MSM 750mg/5mL, NAC 300mg/2mL, Vit B3 (Nicotinamida) 30mg/2mL, Minerais /2mL, Aminoácidos (3,8%) /10mL, Ácido Lipoico 600mg/24mL",
    markers_indicated: ["pcr", "vhs", "homocisteina", "vitamina_b12", "acido_folico", "zinco"],
  },
  {
    id: "EV 1.3", name: "Protocolo de Vitaminas, Minerais, Antioxidantes e Aminoácidos", category: "Suporte para imunidade, inflamação e antioxidante",
    via: "Endovenoso",
    composition: "NAC 300mg/2mL, L-Glutathion 100mg/2mL, Vit B3 30mg/2mL, Complexo B sem B1 /2mL, Aminoácidos (3,8%) /10mL, Minerais /2mL",
    markers_indicated: ["vitamina_b12", "acido_folico", "zinco", "selenio", "magnesio", "pcr"],
  },
  {
    id: "EV 1.4", name: "Protocolo adjuvante Pós-Infecção", category: "Suporte para imunidade, inflamação e antioxidante",
    via: "Endovenoso",
    composition: "Complexo B sem B1 /2mL, L-Citrulina 200mg + Vit C 75mg/10mL, NAC 300mg/2mL, L-Leucina 150mg/10mL, L-Lisina 300mg/2mL, MSM 1,5g/10mL, Magnésio 1g/10mL, Minerais /2mL, N-Acetil L-Tirosina 20mg/2mL",
    markers_indicated: ["vitamina_c", "vitamina_d", "zinco", "pcr", "vhs", "linfocitos"],
  },
  {
    id: "EV 1.7", name: "Protocolo adjuvante Síndrome da Ativação Mastocitária", category: "Suporte para imunidade, inflamação e antioxidante",
    via: "Endovenoso",
    composition: "Vit C 444mg/2mL, Cloreto de Magnésio 500mg/5mL, Nanomicelas de Quercetina 15mg/2mL, Nanomicelas de Resveratrol 10mg/1mL, Vit D3 (Colecalciferol) 50.000–600.000 UI/1mL",
    markers_indicated: ["vitamina_d", "magnesio", "pcr", "ige_total", "eosinofilos"],
  },
  {
    id: "EV 1.9", name: "Protocolo Antioxidante Plus", category: "Suporte para imunidade, inflamação e antioxidante",
    via: "Endovenoso",
    composition: "Nanomicelas de Curcuminoides 2mg/2mg, Nanomicelas de Tocoferóis 10mg/1mL",
    markers_indicated: ["pcr", "vhs", "tgo", "tgp", "ggt"],
  },

  // ── ENDOVENOSOS: Energia e Disposição ──
  {
    id: "EV 2.1", name: "Protocolo adjuvante para Fadiga/Indisposição", category: "Aumento de energia e disposição",
    via: "Endovenoso",
    composition: "NAC 300mg/2mL, Sulfato de Magnésio 200mg/2mL, Vit B12 (Metilcobalamina) 500mcg/1mL, Complexo B sem B1 /2mL, D-Ribose 500mg/2mL, Taurina 500mg/10mL, Aminoácidos (3,8%) /10mL, Inositol 1g/10mL",
    markers_indicated: ["ferritina", "vitamina_b12", "tsh", "cortisol", "insulina_jejum", "glicose_jejum", "magnesio"],
  },
  {
    id: "EV 2.2", name: "Protocolo adjuvante Energia Mitocondrial", category: "Aumento de energia e disposição",
    via: "Endovenoso",
    composition: "L-Carnitina 600mg/2mL, Vit B5 (D-Pantenol) 40mg/2mL, Sulfato de Magnésio 200mg/2mL, D-Ribose 500mg/2mL, Vit B3 30mg/2mL, Vit B2 (Riboflavina-5-Fosfato) 10mg/1mL, PQQ 2,5–5mg/1mL, Coenzima Q10 50mg/1mL",
    markers_indicated: ["ferritina", "vitamina_b12", "t3_livre", "cortisol", "glicose_jejum", "magnesio"],
  },
  {
    id: "EV 2.4", name: "Protocolo adjuvante Energia, Disposição e Foco", category: "Aumento de energia e disposição",
    via: "Endovenoso",
    composition: "NAC 300mg/2mL, L-Fenilalanina 20mg/2mL, Taurina 100mg/2mL, L-Triptofano 100mg/10mL, Piracetam 500mg/2mL, Complexo B com Metil B12 /2mL",
    markers_indicated: ["vitamina_b12", "homocisteina", "tsh", "cortisol", "magnesio"],
  },
  {
    id: "EV 2.7", name: "Protocolo adjuvante Energia e Saúde Mitocondrial", category: "Aumento de energia e disposição",
    via: "Endovenoso",
    composition: "Nanomicelas de Resveratrol 10mg/1mL, L-Carnitina 600mg/2mL, Ácido Lipoico 10mg/2mL, Coenzima Q10 100mg/2mL",
    markers_indicated: ["ferritina", "t3_livre", "cortisol", "glicose_jejum", "insulina_jejum"],
  },
  {
    id: "EV 2.8", name: "Protocolo adjuvante Revitalização Celular", category: "Aumento de energia e disposição",
    via: "Endovenoso",
    composition: "NADH 10mg/2mL, L-Carnitina 600mg/2mL, D-Ribose 500mg/2mL, L-Triptofano 100mg/10mL, NMN 100mg/1mL, Complexo B com Metil B12 /2mL, PQQ 2,5mg/1mL",
    markers_indicated: ["ferritina", "vitamina_b12", "cortisol", "glicose_jejum", "magnesio"],
  },

  // ── ENDOVENOSOS: Cognição e Memória ──
  {
    id: "EV 3.1", name: "Protocolo adjuvante Recuperação Neuronal", category: "Cognição e memória",
    via: "Endovenoso",
    composition: "Alfa-GPC 98% de GPC 150mg/1mL, Clorato de Colina 330mg + L-Carnitina 330mg + Vit B5 80mg/2mL, Inositol 1g/10mL, L-Triptofano 100mg/10mL, Vit B12 (Metilcobalamina) 2500mcg/1mL, Minerais /2mL",
    markers_indicated: ["vitamina_b12", "homocisteina", "vitamina_d", "zinco", "magnesio"],
  },
  {
    id: "EV 3.2", name: "Protocolo adjuvante Redução do Estresse, Equilíbrio do Humor e Melhora da Memória", category: "Cognição e memória",
    via: "Endovenoso",
    composition: "N-Acetil L-Tirosina 20mg/2mL, L-Theanina 50mg/2mL, Minerais /2mL, Inositol 100mg + Taurina 100mg/2mL, Vit B12 (Metilcobalamina) 2500mcg/1mL",
    markers_indicated: ["cortisol", "dhea_s", "vitamina_b12", "magnesio", "zinco"],
  },

  // ── ENDOVENOSOS: Saúde Hepática ──
  {
    id: "EV 4.1", name: "Protocolo adjuvante Saúde e Desintoxicação Hepática", category: "Saúde e desintoxicação hepática",
    via: "Endovenoso",
    composition: "L-Glutathion 600mg/5mL, NAC 300mg/2mL, Ácido Lipoico 600mg/24mL, Vit C 444mg/2mL, Complexo B sem B1 /2mL, Minerais /2mL",
    markers_indicated: ["tgo", "tgp", "ggt", "fosfatase_alcalina", "bilirrubina_total", "albumina"],
  },

  // ── ENDOVENOSOS: Metabolismo ──
  {
    id: "EV 6.1", name: "Protocolo adjuvante para Distúrbios do Metabolismo", category: "Condições e patologias relacionadas a distúrbios de metabolismo",
    via: "Endovenoso",
    composition: "L-Carnitina 600mg/2mL, Cloreto de Cromo 100mcg/2mL, Ácido Lipoico 600mg/24mL, Inositol 1g/10mL, Vit B3 30mg/2mL, Magnésio 1g/10mL",
    markers_indicated: ["glicose_jejum", "insulina_jejum", "hba1c", "glicemia_media_estimada", "colesterol_total", "ldl", "triglicerides", "pcr"],
  },
  {
    id: "EV 2.6", name: "Protocolo adjuvante Ativador Metabólico", category: "Aumento de energia e disposição",
    via: "Endovenoso",
    composition: "L-Carnitina 600mg/2mL, Cloreto de Cromo 100mcg/2mL, HMB 50mg/2mL, Inositol 100mg + Taurina 100mg/2mL",
    markers_indicated: ["glicose_jejum", "insulina_jejum", "triglicerides", "ldl", "hba1c"],
  },

  // ── ENDOVENOSOS: Saúde Feminina ──
  {
    id: "EV 9.1", name: "Protocolo adjuvante Saúde Feminina", category: "Saúde feminina",
    via: "Endovenoso",
    composition: "Complexo B com Metil B12 /2mL, Inositol 1g/10mL, Magnésio 1g/10mL, L-Carnitina 600mg/2mL, Zinco 20mg/2mL, Vit D3 50.000 UI/1mL",
    markers_indicated: ["fsh", "lh", "estradiol", "progesterona", "testosterona_total", "dhea_s", "vitamina_d", "zinco", "insulina_jejum"],
  },

  // ── ENDOVENOSOS: Saúde Masculina ──
  {
    id: "EV 10.1", name: "Protocolo adjuvante Saúde Masculina", category: "Saúde masculina",
    via: "Endovenoso",
    composition: "Zinco 20mg/2mL, L-Carnitina 600mg/2mL, Vit D3 50.000 UI/1mL, Complexo B com Metil B12 /2mL, NAC 300mg/2mL",
    markers_indicated: ["testosterona_total", "testosterona_livre", "dhea_s", "psa", "vitamina_d", "zinco"],
  },

  // ── ENDOVENOSOS: Saúde Cardiovascular ──
  {
    id: "EV 11.1", name: "Protocolo adjuvante Saúde Cardiovascular", category: "Saúde cardiovascular",
    via: "Endovenoso",
    composition: "Magnésio 1g/10mL, Taurina 500mg/10mL, L-Carnitina 600mg/2mL, Coenzima Q10 100mg/2mL, Vit C 444mg/2mL",
    markers_indicated: ["colesterol_total", "ldl", "hdl", "triglicerides", "homocisteina", "pcr", "magnesio"],
  },

  // ── ENDOVENOSOS: Saúde Óssea ──
  {
    id: "EV 8.1", name: "Protocolo adjuvante Saúde Óssea, Muscular e Articular", category: "Saúde óssea, muscular e articular",
    via: "Endovenoso",
    composition: "Magnésio 1g/10mL, Vit D3 50.000 UI/1mL, L-Lisina 300mg/2mL, L-Prolina 300mg/2mL, Vit C 444mg/2mL, Minerais /2mL",
    markers_indicated: ["vitamina_d", "calcio_total", "fosforo", "magnesio", "pth", "osteocalcina"],
  },

  // ── ENDOVENOSOS: Sono ──
  {
    id: "EV 13.1", name: "Protocolo adjuvante Saúde do Sono", category: "Saúde do sono",
    via: "Endovenoso",
    composition: "Magnésio 1g/10mL, L-Triptofano 100mg/10mL, Inositol 1g/10mL, Taurina 500mg/10mL, Vit B6 (Piridoxina) 100mg/2mL",
    markers_indicated: ["cortisol", "magnesio", "vitamina_d", "tsh"],
  },

  // ── ENDOVENOSOS: Dores Crônicas ──
  {
    id: "EV 1.6", name: "Protocolo adjuvante para Dores Crônicas", category: "Suporte para imunidade, inflamação e antioxidante",
    via: "Endovenoso",
    composition: "SAME 200mg/2mL, MSM 1,5g/10mL, L-Carnitina 600mg/2mL, ATP 20mg/2mL, Complexo B com Metil B12 /2mL, DL-Fenilalanina 125mg/10mL",
    markers_indicated: ["pcr", "vhs", "vitamina_d", "magnesio", "cortisol", "ferritina"],
  },
  {
    id: "EV 1.5", name: "Protocolo adjuvante Anti-inflamatório e Antioxidante", category: "Suporte para imunidade, inflamação e antioxidante",
    via: "Endovenoso",
    composition: "MSM 1,5g/10mL, NAC 300mg/2mL, L-Carnitina 600mg/2mL, Complexo B sem B1 /2mL, SAME 200mg/2mL, Aminoácidos (3,8%) /10mL, L-Glutathion 600mg/5mL",
    markers_indicated: ["pcr", "vhs", "homocisteina", "tgo", "tgp", "acido_urico"],
  },
  {
    id: "EV 1.8", name: "Protocolo adjuvante para Herpes", category: "Suporte para imunidade, inflamação e antioxidante",
    via: "Endovenoso",
    composition: "L-Lisina 300mg/2mL, Sulfato de Zinco 20mg/2mL, L-Glutathion 100mg/2mL, Complexo B com B1 /1mL, NMN 100mg/1mL",
    markers_indicated: ["zinco", "vitamina_b12", "linfocitos", "ige_total"],
  },

  // ── ENDOVENOSOS: Energia e Disposição (adicionais) ──
  {
    id: "EV 2.3", name: "Protocolo adjuvante Energia Celular", category: "Aumento de energia e disposição",
    via: "Endovenoso",
    composition: "ATP 20mg/2mL, D-Ribose 500mg/2mL, L-Carnitina 600mg/2mL, Sulfato de Magnésio 200mg/2mL, L-Citrulina 200mg + Vit C 75mg/10mL, Ácido Lipoico 600mg/24mL",
    markers_indicated: ["magnesio", "ferritina", "glicose_jejum", "insulina_jejum", "vitamina_b12"],
  },
  {
    id: "EV 2.5", name: "Protocolo adjuvante Aumento de Vitalidade", category: "Aumento de energia e disposição",
    via: "Endovenoso",
    composition: "Sulfato de Magnésio 1g/10mL, Complexo B sem B1 /2mL, Taurina 500mg/5mL, NAC 300mg/2mL, Vit C 1g/5mL, L-Fenilalanina 50mg/5mL",
    markers_indicated: ["magnesio", "vitamina_b12", "cortisol", "ferritina", "vitamina_c"],
  },
  {
    id: "EV 2.7_nmn", name: "Protocolo adjuvante Longevidade e Anti-Aging (NMN)", category: "Aumento de energia e disposição",
    via: "Endovenoso",
    composition: "NMN 100mg/1mL, Nanomicelas de Resveratrol 10mg/1mL, L-Carnitina 600mg/2mL, Ácido Lipoico 10mg/2mL, Coenzima Q10 100mg/2mL",
    markers_indicated: ["glicose_jejum", "insulina_jejum", "hba1c", "igf1", "testosterona_total"],
  },

  // ── ENDOVENOSOS: Quelação de Metais ──
  {
    id: "EV 5.1", name: "Protocolo adjuvante Quelação de Metais Tóxicos", category: "Quelação de metais tóxicos",
    via: "Endovenoso",
    composition: "EDTA Dissódico, Vit C 444mg/2mL, Complexo B sem B1 /2mL, Minerais /2mL",
    markers_indicated: ["chumbo", "mercurio", "arsenio", "cadmio", "aluminio", "zinco", "selenio"],
  },

  // ── ENDOVENOSOS: Emagrecimento e Ganho de Massa ──
  {
    id: "EV 6.2", name: "Protocolo adjuvante para Emagrecimento", category: "Suporte ao emagrecimento e ganho de massa muscular",
    via: "Endovenoso",
    composition: "L-Carnitina 600mg/2mL, Cloreto de Cromo 100mcg/2mL, Inositol 1g/10mL, Taurina 500mg/10mL, Complexo B sem B1 /2mL, Ácido Lipoico 600mg/24mL",
    markers_indicated: ["glicose_jejum", "insulina_jejum", "hba1c", "glicemia_media_estimada", "triglicerides", "colesterol_total", "tsh"],
  },
  {
    id: "EV 6.3", name: "Protocolo adjuvante para Ganho de Massa Muscular", category: "Suporte ao emagrecimento e ganho de massa muscular",
    via: "Endovenoso",
    composition: "L-Arginina HCl 400mg, HMB 50mg/2mL, Complexo B com Metil B12 /2mL, Aminoácidos (3,8%) /10mL, Sulfato de Magnésio 200mg/2mL",
    markers_indicated: ["testosterona_total", "igf1", "proteina_total", "albumina", "vitamina_d", "magnesio"],
  },

  // ── ENDOVENOSOS: Pele, Cabelo e Unhas ──
  {
    id: "EV 7.1", name: "Protocolo adjuvante Saúde e Beleza da Pele, Cabelo e Unhas", category: "Saúde e beleza da pele, do cabelo e das unhas",
    via: "Endovenoso",
    composition: "Biotina 10mg/2mL, Vit C 444mg/2mL, Zinco 20mg/2mL, Silício Orgânico, Complexo B com Metil B12 /2mL",
    markers_indicated: ["ferritina", "zinco", "vitamina_c", "vitamina_d", "biotina", "tsh"],
  },

  // ── ENDOVENOSOS: Metabolismo (adicionais) ──
  {
    id: "EV 8.2", name: "Protocolo adjuvante Síndrome Metabólica", category: "Condições e patologias relacionadas a distúrbios de metabolismo",
    via: "Endovenoso",
    composition: "L-Carnitina 600mg/2mL, Cloreto de Cromo 100mcg/2mL, Ácido Lipoico 600mg/24mL, Inositol 1g/10mL, Taurina 500mg/10mL, Complexo B sem B1 /2mL",
    markers_indicated: ["glicose_jejum", "insulina_jejum", "hba1c", "triglicerides", "hdl", "pcr"],
  },
  {
    id: "EV 8.3", name: "Protocolo adjuvante Hipotireoidismo Funcional", category: "Condições e patologias relacionadas a distúrbios de metabolismo",
    via: "Endovenoso",
    composition: "Selênio 200mcg, Zinco 20mg/2mL, Complexo B com Metil B12 /2mL, L-Tirosina 500mg",
    markers_indicated: ["tsh", "t3_livre", "t4_livre", "anti_tpo", "anti_tg", "selenio", "zinco"],
  },
  {
    id: "EV 8.4", name: "Protocolo adjuvante Diabetes Tipo 2", category: "Condições e patologias relacionadas a distúrbios de metabolismo",
    via: "Endovenoso",
    composition: "Ácido Lipoico 600mg/24mL, Cloreto de Cromo 100mcg/2mL, Inositol 1g/10mL, Vit B12 (Metilcobalamina) 500mcg/1mL, Complexo B sem B1 /2mL",
    markers_indicated: ["glicose_jejum", "hba1c", "insulina_jejum", "glicemia_media_estimada", "vitamina_b12"],
  },

  // ── ENDOVENOSOS: SNC ──
  {
    id: "EV 9.1_snc", name: "Protocolo adjuvante Ansiedade e Estresse", category: "Condições e patologias relacionadas ao SNC",
    via: "Endovenoso",
    composition: "L-Triptofano 100mg/10mL, L-Theanina 50mg/2mL, Magnésio 1g/10mL, Inositol 1g/10mL, Complexo B com Metil B12 /2mL",
    markers_indicated: ["cortisol", "dhea_s", "magnesio", "vitamina_b12", "tsh"],
  },
  {
    id: "EV 9.2", name: "Protocolo adjuvante Depressão", category: "Condições e patologias relacionadas ao SNC",
    via: "Endovenoso",
    composition: "L-Triptofano 100mg/10mL, SAMe 200mg/2mL, Complexo B com Metil B12 /2mL, Ácido Fólico, Zinco 20mg/2mL",
    markers_indicated: ["vitamina_b12", "acido_folico", "tsh", "cortisol", "ferritina", "zinco"],
  },
  {
    id: "EV 9.3", name: "Protocolo adjuvante Fibromialgia", category: "Condições e patologias relacionadas ao SNC",
    via: "Endovenoso",
    composition: "SAME 200mg/2mL, MSM 1,5g/10mL, L-Carnitina 600mg/2mL, Magnésio 1g/10mL, Complexo B com Metil B12 /2mL, DL-Fenilalanina 125mg/10mL",
    markers_indicated: ["vitamina_d", "magnesio", "cortisol", "pcr", "ferritina"],
  },

  // ── ENDOVENOSOS: Autoimune ──
  {
    id: "EV 11.2", name: "Protocolo adjuvante Condições Autoimunes", category: "Condições e patologias autoimunes",
    via: "Endovenoso",
    composition: "L-Glutathion 600mg/5mL, NAC 300mg/2mL, Vit D3 50.000 UI/1mL, Ácido Lipoico 600mg/24mL",
    markers_indicated: ["vitamina_d", "pcr", "vhs", "anti_tpo", "fator_reumatoide", "ana"],
  },

  // ── ENDOVENOSOS: Pós-Cirúrgico ──
  {
    id: "EV 12.1", name: "Protocolo adjuvante Recuperação Pós-Cirúrgica", category: "Recuperação pós-cirúrgica",
    via: "Endovenoso",
    composition: "Vit C 444mg/2mL, Zinco 20mg/2mL, L-Glutamina, Complexo B sem B1 /2mL, Aminoácidos (3,8%) /10mL",
    markers_indicated: ["albumina", "proteina_total", "vitamina_c", "zinco", "ferritina", "leucocitos"],
  },

  // ── ENDOVENOSOS: Hidratação ──
  {
    id: "EV 13.2", name: "Protocolo adjuvante Hidratação e Reposição de Minerais", category: "Hidratação e reposição de minerais",
    via: "Endovenoso",
    composition: "Soro Fisiológico 0,9%, Eletrólitos, Magnésio 1g/10mL, Complexo B sem B1 /2mL",
    markers_indicated: ["sodio", "potassio", "calcio_total", "magnesio", "cloreto"],
  },

  // ── ENDOVENOSOS: Performance Esportiva ──
  {
    id: "EV 14.1", name: "Protocolo adjuvante Performance Esportiva", category: "Performance esportiva",
    via: "Endovenoso",
    composition: "L-Arginina HCl 400mg, L-Citrulina 200mg + Vit C 75mg/10mL, L-Carnitina 600mg/2mL, Complexo B com Metil B12 /2mL, Sulfato de Magnésio 200mg/2mL",
    markers_indicated: ["testosterona_total", "igf1", "vitamina_d", "magnesio", "ferritina", "hemoglobina", "cortisol"],
  },
  {
    id: "EV 14.2", name: "Protocolo adjuvante Recuperação Muscular Esportiva", category: "Performance esportiva",
    via: "Endovenoso",
    composition: "Aminoácidos (3,8%) /10mL, L-Glutamina, Magnésio 1g/10mL, Zinco 20mg/2mL, Vit C 444mg/2mL",
    markers_indicated: ["cpk", "ldh", "acido_urico", "magnesio", "zinco", "vitamina_d"],
  },

  // ── ENDOVENOSOS: Saúde Gastrointestinal ──
  {
    id: "EV 15.1", name: "Protocolo adjuvante Saúde Intestinal", category: "Saúde gastrointestinal",
    via: "Endovenoso",
    composition: "L-Glutamina, Zinco 20mg/2mL, Vit D3 50.000 UI/1mL, Complexo B com Metil B12 /2mL",
    markers_indicated: ["vitamina_d", "zinco", "albumina", "proteina_total", "vitamina_b12", "acido_folico"],
  },

  // ── ENDOVENOSOS: Saúde Feminina (adicionais) ──
  {
    id: "EV 16.2", name: "Protocolo adjuvante TPM e Menopausa", category: "Saúde feminina",
    via: "Endovenoso",
    composition: "Magnésio 1g/10mL, Vit B6 (Piridoxina) 100mg/2mL, Inositol 1g/10mL, L-Triptofano 100mg/10mL, Complexo B com Metil B12 /2mL",
    markers_indicated: ["estradiol", "progesterona", "fsh", "lh", "magnesio", "vitamina_b12", "cortisol"],
  },

  // ── ENDOVENOSOS: Reposição de Ferro ──
  {
    id: "EV 2.8_ferro", name: "Protocolo adjuvante Reposição de Ferro (Ferro Carboximaltose)", category: "Aumento de energia e disposição",
    via: "Endovenoso",
    composition: "Ferro Carboximaltose — tecnologia de liberação gradual e controlada do ferro",
    markers_indicated: ["ferritina", "hemoglobina", "hematocrito", "vcm", "hcm", "ferro_serico", "transferrina"],
  },

  // ── ENDOVENOSOS: Oncológico ──
  {
    id: "EV 18.1", name: "Protocolo adjuvante Suporte ao Tratamento Oncológico", category: "Suporte ao tratamento oncológico",
    via: "Endovenoso",
    composition: "L-Glutathion 600mg/5mL, Vit C 444mg/2mL, NAC 300mg/2mL, Selênio, Zinco 20mg/2mL, Complexo B sem B1 /2mL",
    markers_indicated: ["albumina", "proteina_total", "vitamina_c", "selenio", "zinco", "leucocitos", "hemoglobina"],
  },

  // ── ENDOVENOSOS: Ocular ──
  {
    id: "EV 20.1", name: "Protocolo adjuvante Saúde Ocular", category: "Saúde ocular",
    via: "Endovenoso",
    composition: "Luteína, Zeaxantina, Vit C 444mg/2mL, Zinco 20mg/2mL",
    markers_indicated: ["vitamina_c", "zinco", "glicose_jejum", "hba1c"],
  },

  // ── ENDOVENOSOS: Renal ──
  {
    id: "EV 22.1", name: "Protocolo adjuvante Saúde Renal", category: "Saúde renal",
    via: "Endovenoso",
    composition: "NAC 300mg/2mL, L-Glutathion 600mg/5mL, Vit C 444mg/2mL, Complexo B sem B1 /2mL, Magnésio 1g/10mL",
    markers_indicated: ["creatinina", "ureia", "acido_urico", "tfg", "sodio", "potassio"],
  },

  // ── ENDOVENOSOS: Otológico ──
  {
    id: "EV 23.1", name: "Protocolo adjuvante Saúde Otológica", category: "Saúde otológica",
    via: "Endovenoso",
    composition: "Vit B12 (Metilcobalamina) 2500mcg/1mL, Magnésio 1g/10mL, Zinco 20mg/2mL, Ácido Lipoico 600mg/24mL",
    markers_indicated: ["vitamina_b12", "magnesio", "zinco", "colesterol_total"],
  },

  // ── ENDOVENOSOS: Respiratório ──
  {
    id: "EV 24.1", name: "Protocolo adjuvante Saúde do Sistema Respiratório", category: "Saúde do sistema respiratório",
    via: "Endovenoso",
    composition: "NAC 300mg/2mL, Vit C 444mg/2mL, Zinco 20mg/2mL, Nanomicelas de Quercetina 15mg/2mL, Complexo B sem B1 /2mL",
    markers_indicated: ["vitamina_c", "zinco", "vitamina_d", "ige_total", "eosinofilos"],
  },

  // ── INTRAMUSCULARES: Energia ──
  {
    id: "IM 2.1", name: "Protocolo IM adjuvante para Fadiga/Indisposição", category: "Aumento de energia e disposição",
    via: "Intramuscular",
    composition: "Vit B12 (Metilcobalamina) 2500mcg/1mL, Complexo B com Metil B12 /2mL, Coenzima Q10 50mg/1mL",
    markers_indicated: ["vitamina_b12", "ferritina", "tsh", "cortisol"],
  },

  // ── INTRAMUSCULARES: Cognição ──
  {
    id: "IM 3.1", name: "Protocolo IM adjuvante Cognição e Memória", category: "Cognição e memória",
    via: "Intramuscular",
    composition: "Complexo B com Metil B12 /2mL, Citicolina, Fosfatidilserina",
    markers_indicated: ["vitamina_b12", "homocisteina", "cortisol", "tsh"],
  },

  // ── INTRAMUSCULARES: Hepático ──
  {
    id: "IM 4.1", name: "Protocolo IM adjuvante Saúde e Desintoxicação Hepática", category: "Saúde e desintoxicação hepática",
    via: "Intramuscular",
    composition: "NAC 300mg/2mL, L-Glutathion 100mg/2mL, Silimarina",
    markers_indicated: ["tgp", "tgo", "ggt", "albumina", "bilirrubina_total"],
  },

  // ── INTRAMUSCULARES: Emagrecimento/Massa ──
  {
    id: "IM 5.1", name: "Protocolo IM adjuvante Emagrecimento e Ganho de Massa Muscular", category: "Suporte ao emagrecimento e ganho de massa muscular",
    via: "Intramuscular",
    composition: "L-Carnitina 600mg/2mL, Cloreto de Cromo 100mcg/2mL, HMB 50mg/2mL",
    markers_indicated: ["glicose_jejum", "insulina_jejum", "triglicerides", "testosterona_total", "hba1c"],
  },

  // ── INTRAMUSCULARES: Pele, Cabelo e Unhas ──
  {
    id: "IM 6.1", name: "Protocolo IM adjuvante Pele, Cabelo e Unhas", category: "Saúde e beleza da pele, do cabelo e das unhas",
    via: "Intramuscular",
    composition: "Biotina 10mg/2mL, Vit C (Ácido Ascórbico) 400mg/2mL, Zinco 20mg/2mL, Complexo B com Metil B12 /2mL",
    markers_indicated: ["ferritina", "zinco", "biotina", "vitamina_c", "tsh"],
  },

  // ── INTRAMUSCULARES: Metabolismo ──
  {
    id: "IM 7.1", name: "Protocolo IM adjuvante Distúrbios do Metabolismo", category: "Condições e patologias relacionadas a distúrbios de metabolismo",
    via: "Intramuscular",
    composition: "Ácido Lipoico 10mg/2mL, Cloreto de Cromo 100mcg/2mL, Inositol 100mg + Taurina 100mg/2mL",
    markers_indicated: ["glicose_jejum", "insulina_jejum", "hba1c", "triglicerides", "colesterol_total"],
  },

  // ── INTRAMUSCULARES: SNC ──
  {
    id: "IM 8.1", name: "Protocolo IM adjuvante SNC", category: "Condições e patologias relacionadas ao SNC",
    via: "Intramuscular",
    composition: "L-Triptofano 100mg/10mL, Magnésio 500mg/2mL, Complexo B com Metil B12 /2mL",
    markers_indicated: ["cortisol", "magnesio", "vitamina_b12", "tsh"],
  },

  // ── INTRAMUSCULARES: Imunidade ──
  {
    id: "IM 1.1", name: "Protocolo IM adjuvante para Imunidade", category: "Suporte para imunidade, inflamação e antioxidante",
    via: "Intramuscular",
    composition: "Vit D3 (Colecalciferol) 50.000–600.000 UI/1mL, Vit A (Palmitato de Retinol) 25.000 UI/1mL, Coenzima Q10 50mg/1mL",
    markers_indicated: ["vitamina_d", "pcr", "vhs", "linfocitos"],
  },

  // ── INTRAMUSCULARES: Saúde Óssea ──
  {
    id: "IM 9.2", name: "Protocolo IM adjuvante Saúde Óssea, Muscular e Articular", category: "Saúde óssea, muscular e articular",
    via: "Intramuscular",
    composition: "Vit D3 (Colecalciferol) 50.000–600.000 UI/1mL, Vit K2, Magnésio 500mg/2mL",
    markers_indicated: ["vitamina_d", "calcio_total", "magnesio", "pth"],
  },

  // ── INTRAMUSCULARES: Saúde Feminina ──
  {
    id: "IM 9.1", name: "Protocolo IM adjuvante Saúde Feminina", category: "Saúde feminina",
    via: "Intramuscular",
    composition: "Vit D3 50.000 UI/1mL, Vit B12 (Metilcobalamina) 2500mcg/1mL, Coenzima Q10 50mg/1mL",
    markers_indicated: ["vitamina_d", "vitamina_b12", "estradiol", "fsh", "lh"],
  },
  // ── INTRAMUSCULARES: Masculino ──
  {
    id: "IM 11.1", name: "Protocolo IM adjuvante Saúde Masculina", category: "Saúde masculina",
    via: "Intramuscular",
    composition: "Zinco 20mg/2mL, Selênio 200mcg, L-Arginina HCl 400mg, Vit D3 50.000 UI/1mL",
    markers_indicated: ["testosterona_total", "testosterona_livre", "zinco", "selenio", "vitamina_d", "psa"],
  },

  // ── INTRAMUSCULARES: Cardiovascular ──
  {
    id: "IM 12.1", name: "Protocolo IM adjuvante Saúde do Coração", category: "Saúde cardiovascular",
    via: "Intramuscular",
    composition: "Complexo B com Metil B12 /2mL, L-Carnitina 600mg/2mL, D-Ribose 500mg/2mL, Taurina 100mg/2mL, NMN 100mg/1mL",
    markers_indicated: ["colesterol_total", "ldl", "homocisteina", "vitamina_b12", "magnesio", "triglicerides"],
  },

  // ── INTRAMUSCULARES: Gastrointestinal ──
  {
    id: "IM 13.1", name: "Protocolo IM adjuvante Hipocloridria", category: "Saúde gastrointestinal",
    via: "Intramuscular",
    composition: "Glicina 75mg/2mL, L-Lisina 300mg/2mL, Complexo B com Metil B12 /2mL",
    markers_indicated: ["vitamina_b12", "albumina", "ferritina", "zinco"],
  },
  {
    id: "IM 13.2", name: "Protocolo IM adjuvante Disbiose", category: "Saúde gastrointestinal",
    via: "Intramuscular",
    composition: "MSM 750mg/5mL, Vit C (Ácido Ascórbico) 400mg/2mL, Glicina 75mg/2mL",
    markers_indicated: ["vitamina_c", "albumina", "proteina_total", "zinco"],
  },

  // ── INTRAMUSCULARES: Sono ──
  {
    id: "IM 14.1", name: "Protocolo IM adjuvante Regulação do Sono", category: "Saúde do sono",
    via: "Intramuscular",
    composition: "Melatonina 3mg/2mL, Hidroxitriptofano 4mg/2mL, L-Theanina 50mg/2mL",
    markers_indicated: ["cortisol", "melatonina", "magnesio", "tsh"],
  },

  // ── INTRAMUSCULARES: Respiratório ──
  {
    id: "IM 15.1", name: "Protocolo IM adjuvante Saúde do Sistema Respiratório", category: "Saúde do sistema respiratório",
    via: "Intramuscular",
    composition: "Nanomicelas de Quercetina 15mg/2mL, NAC 300mg/2mL",
    markers_indicated: ["vitamina_d", "zinco", "ige_total", "eosinofilos"],
  },
];

// ── Mapeamento de objetivos do paciente para categorias de protocolos ──
const OBJECTIVE_TO_CATEGORIES: Record<string, string[]> = {
  performance_esportiva: ["Performance esportiva"],
  ganho_massa: ["Suporte ao emagrecimento e ganho de massa muscular"],
  emagrecimento: ["Suporte ao emagrecimento e ganho de massa muscular", "Condições e patologias relacionadas a distúrbios de metabolismo"],
  desinflamacao: ["Suporte para imunidade, inflamação e antioxidante"],
  energia_disposicao: ["Aumento de energia e disposição"],
  longevidade: ["Aumento de energia e disposição"],
  saude_hormonal: ["Saúde feminina", "Saúde masculina"],
  imunidade: ["Suporte para imunidade, inflamação e antioxidante"],
  cognicao_foco: ["Cognição e memória", "Condições e patologias relacionadas ao SNC"],
  saude_pele: ["Saúde e beleza da pele, do cabelo e das unhas"],
  sono: ["Saúde do sono"],
  libido: ["Saúde feminina", "Saúde masculina"],
  recuperacao_muscular: ["Performance esportiva", "Saúde óssea, muscular e articular"],
  saude_intestinal: ["Saúde gastrointestinal"],
};

// ── Sistema de matching: protocolos relevantes por marcadores alterados + objetivos do paciente ──
function matchProtocols(abnormalMarkerIds: string[], sex: "M" | "F", objectives?: string[]): typeof ESSENTIA_PROTOCOLS {
  const abnormalSet = new Set(abnormalMarkerIds);

  // Categorias alinhadas aos objetivos do paciente
  const objectiveCategories = new Set<string>();
  if (objectives && objectives.length > 0) {
    for (const obj of objectives) {
      const cats = OBJECTIVE_TO_CATEGORIES[obj];
      if (cats) cats.forEach((c) => objectiveCategories.add(c));
    }
    // Filtrar categorias por sexo
    if (sex === "M") objectiveCategories.delete("Saúde feminina");
    if (sex === "F") objectiveCategories.delete("Saúde masculina");
  }

  const sexFiltered = ESSENTIA_PROTOCOLS.filter((p) => {
    if (sex === "M" && p.category === "Saúde feminina") return false;
    if (sex === "F" && p.category === "Saúde masculina") return false;
    return true;
  });

  // Score por marcadores alterados
  const scored = sexFiltered.map((p) => {
    const markerMatches = p.markers_indicated.filter((m) => abnormalSet.has(m)).length;
    const objectiveMatch = objectiveCategories.has(p.category);
    return { protocol: p, markerMatches, objectiveMatch };
  });

  // Protocolos com match de marcadores (top 5)
  const byMarkers = scored
    .filter((x) => x.markerMatches > 0)
    .sort((a, b) => b.markerMatches - a.markerMatches)
    .slice(0, 5);

  const selectedIds = new Set(byMarkers.map((x) => x.protocol.id));

  // Protocolos adicionais alinhados aos objetivos (que não foram selecionados por marcadores)
  const byObjectives = scored
    .filter((x) => x.objectiveMatch && !selectedIds.has(x.protocol.id))
    .sort((a, b) => b.markerMatches - a.markerMatches)
    .slice(0, 3);

  // Combinar: até 5 por marcadores + até 3 por objetivos = máximo 8
  return [...byMarkers, ...byObjectives].map((x) => x.protocol);
}

const SYSTEM_PROMPT = `Você é um assistente clínico especializado em medicina funcional e integrativa, com profundo conhecimento em interpretação de exames laboratoriais e protocolos de injetáveis.

Sua função é analisar resultados de exames laboratoriais de pacientes e fornecer uma análise clínica estruturada, EQUILIBRADA e objetiva para uso profissional (nutricionistas, médicos, profissionais de saúde).

REGRAS IMPORTANTES:
1. Sempre use linguagem técnica e profissional em português brasileiro
2. Nunca faça diagnósticos definitivos — use termos como "sugere", "pode indicar", "merece acompanhamento"
3. SEJA EQUILIBRADO: destaque tanto os achados positivos quanto os que merecem atenção. Comece reconhecendo o que está adequado antes de mencionar alterações
4. NÃO SEJA ALARMISTA: evite linguagem negativa excessiva. Use tom neutro e analítico. Prefira "merece acompanhamento" a "preocupante", "discretamente alterado" a "anormal"
5. Valores levemente fora da faixa funcional devem ser tratados como variações discretas, não como problemas graves
6. Correlacione marcadores entre si quando houver relação clínica relevante
7. Considere o sexo e idade do paciente nas interpretações
8. Quando houver múltiplas sessões, identifique tendências (melhora, piora, estabilidade) — destaque melhorias quando existirem
9. Seja conciso mas completo — cada seção deve ter no máximo 3-5 pontos
10. Foque em achados acionáveis — o que o profissional pode fazer com essa informação
11. No resumo (summary), comece com uma visão geral equilibrada do estado do paciente, mencionando primeiro os pontos positivos
12. Para os protocolos sugeridos: avalie cada protocolo listado e determine se é clinicamente justificado com base nos marcadores alterados. Defina a prioridade ("alta", "media" ou "baixa") e escreva uma justificativa clínica concisa (1-2 frases) para cada um. Inclua apenas os protocolos que fazem sentido clínico real para este paciente.

FORMATO DE SAÍDA (JSON estrito):
{
  "summary": "Parágrafo de 2-3 frases com visão equilibrada: primeiro os pontos positivos, depois os que merecem atenção",
  "patterns": ["Padrões clínicos identificados pela correlação entre marcadores — incluir padrões positivos também"],
  "trends": ["Tendências observadas entre sessões — destacar melhorias quando houver"],
  "suggestions": ["Sugestões de exames complementares ou ajustes — apenas quando clinicamente justificado"],
  "full_text": "Análise narrativa completa em 3-5 parágrafos para inclusão no relatório. Tom equilibrado e profissional.",
  "protocol_recommendations": [
    {
      "protocol_id": "EV 2.1",
      "protocol_name": "Nome do protocolo",
      "category": "Categoria",
      "via": "Endovenoso ou Intramuscular",
      "composition": "Composição resumida",
      "justification": "Justificativa clínica de 1-2 frases baseada nos marcadores alterados deste paciente",
      "priority": "alta | media | baixa"
    }
  ]
}`;

function buildUserPrompt(req: AnalysisRequest, matchedProtocols: typeof ESSENTIA_PROTOCOLS): string {
  const age = req.birth_date
    ? Math.floor((Date.now() - new Date(req.birth_date).getTime()) / (365.25 * 24 * 3600 * 1000))
    : null;

  const sexLabel = req.sex === "M" ? "Masculino" : "Feminino";
  const ageLabel = age ? `${age} anos` : "idade não informada";

  // Group results by session
  const sessionMap: Record<string, MarkerResult[]> = {};
  for (const r of req.results) {
    if (!sessionMap[r.session_date]) sessionMap[r.session_date] = [];
    sessionMap[r.session_date].push(r);
  }

  const sessionDates = Object.keys(sessionMap).sort();

  // Build abnormal markers list (prioritize alerts)
  const abnormal = req.results.filter(
    (r) => r.status === "low" || r.status === "high" || r.status === "critical_low" || r.status === "critical_high"
  );

  const normal = req.results.filter((r) => r.status === "normal");

  let prompt = `DADOS DO PACIENTE:
- Nome: ${req.patient_name}
- Sexo: ${sexLabel}
- Idade: ${ageLabel}
- Número de sessões: ${sessionDates.length}
- Datas das sessões: ${sessionDates.join(", ")}

MARCADORES FORA DA FAIXA FUNCIONAL (${abnormal.length} marcadores):
`;

  for (const r of abnormal) {
    const valueStr = r.value !== null ? `${r.value} ${r.unit}` : r.text_value ?? "—";
    const refStr = r.functional_min !== undefined && r.functional_max !== undefined
      ? `(ref funcional: ${r.functional_min}–${r.functional_max} ${r.unit})`
      : "";
    const statusLabels: Record<string, string> = {
      low: "↓ BAIXO",
      high: "↑ ALTO",
      critical_low: "⬇ CRÍTICO BAIXO",
      critical_high: "⬆ CRÍTICO ALTO",
    };
    const statusLabel = statusLabels[r.status] ?? r.status;
    prompt += `- ${r.marker_name}: ${valueStr} ${statusLabel} ${refStr} [${r.session_date}]\n`;
  }

  prompt += `\nMARCADORES DENTRO DA FAIXA FUNCIONAL (${normal.length} marcadores):\n`;
  for (const r of normal) {
    const valueStr = r.value !== null ? `${r.value} ${r.unit}` : r.text_value ?? "—";
    prompt += `- ${r.marker_name}: ${valueStr} [${r.session_date}]\n`;
  }

  // If multiple sessions, add trend data
  if (sessionDates.length > 1) {
    prompt += `\nDADOS DE TENDÊNCIA (múltiplas sessões):\n`;
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

  // Add matched protocols for AI to evaluate
  if (matchedProtocols.length > 0) {
    prompt += `\nPROTOCOLOS ESSENTIA PHARMA DISPONÍVEIS NA CLÍNICA (avalie a pertinência clínica de cada um para este paciente):\n`;
    for (const p of matchedProtocols) {
      prompt += `- ${p.id} | ${p.name} | Via: ${p.via}\n  Composição: ${p.composition}\n  Indicado quando: ${p.markers_indicated.join(", ")}\n\n`;
    }
    prompt += `Para cada protocolo acima, inclua no campo "protocol_recommendations" do JSON: protocol_id, protocol_name, category, via, composition, uma justificativa clínica de 1-2 frases baseada nos marcadores alterados deste paciente, e a prioridade ("alta", "media" ou "baixa"). Omita protocolos que não sejam clinicamente justificados para este caso.\n`;
  } else {
    prompt += `\nNenhum protocolo específico foi pré-selecionado para este paciente. Retorne "protocol_recommendations" como array vazio.\n`;
  }

  // Add patient profile / objectives if provided
  if (req.patient_profile) {
    const p = req.patient_profile;
    const hasProfile = (p.objectives && p.objectives.length > 0) || p.activity_level || p.sport_modality || p.main_complaints || p.restrictions;
    if (hasProfile) {
      prompt += `\nPERFIL E OBJETIVOS DO PACIENTE (use para personalizar a prioridade dos protocolos):\n`;
      if (p.objectives && p.objectives.length > 0) {
        prompt += `- Objetivos principais: ${p.objectives.join(", ")}\n`;
      }
      if (p.activity_level) {
        prompt += `- Nível de atividade física: ${p.activity_level}\n`;
      }
      if (p.sport_modality) {
        prompt += `- Modalidade esportiva: ${p.sport_modality}\n`;
      }
      if (p.main_complaints) {
        prompt += `- Queixas principais: ${p.main_complaints}\n`;
      }
      if (p.restrictions) {
        prompt += `- Restrições / alergias: ${p.restrictions}\n`;
      }
      prompt += `\nIMPORTANTE: Ao recomendar protocolos, priorize aqueles alinhados com os objetivos e queixas do paciente acima, mesmo que os marcadores laboratoriais não estejam alterados. Um paciente atleta com objetivo de performance deve receber protocolos de performance mesmo com exames normais, se clinicamente justificável.\n`;
    }
  }

  // Mode-specific instructions
  const mode = req.mode ?? "full";
  if (mode === "analysis_only") {
    prompt += `\nMODO: Gere APENAS a análise clínica (summary, patterns, trends, suggestions, full_text). Retorne "protocol_recommendations" como array vazio.\n`;
  } else if (mode === "protocols_only") {
    prompt += `\nMODO: Gere APENAS as recomendações de protocolos Essentia. Retorne summary, patterns, trends, suggestions e full_text como strings vazias. Foque toda a análise em selecionar e justificar os protocolos mais relevantes para este paciente, considerando seus objetivos e marcadores alterados.\n`;
  }

  prompt += `\nPor favor, analise esses resultados e retorne um JSON com a análise clínica estruturada conforme o formato especificado.`;

  return prompt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body: AnalysisRequest = await req.json();

    if (!body.patient_name || !body.results || body.results.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: patient_name, results" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Identify abnormal marker IDs for protocol matching
    const abnormalIds = body.results
      .filter((r) => r.status === "low" || r.status === "high" || r.status === "critical_low" || r.status === "critical_high")
      .map((r) => r.marker_id);

    const patientObjectives = body.patient_profile?.objectives ?? [];
    const matchedProtocols = matchProtocols(abnormalIds, body.sex, patientObjectives);
    const userPrompt = buildUserPrompt(body, matchedProtocols);

    console.log(`Analyzing ${body.results.length} markers for ${body.patient_name} | ${abnormalIds.length} abnormal | ${matchedProtocols.length} protocols matched`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", errText);
      throw new Error(`AI gateway returned ${response.status}: ${errText}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) throw new Error("Empty response from AI");

    let analysis: AnalysisResponse;
    try {
      analysis = JSON.parse(content);
    } catch {
      analysis = {
        summary: content.slice(0, 300),
        patterns: [],
        trends: [],
        suggestions: [],
        full_text: content,
        protocol_recommendations: [],
      };
    }

    return new Response(
      JSON.stringify({ analysis }),
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
