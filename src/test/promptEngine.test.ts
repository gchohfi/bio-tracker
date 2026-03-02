/**
 * Testes para o Prompt Engine da edge function analyze-lab-results.
 *
 * Cobre:
 *   1. Seleção de especialidade e fallback para 'medicina_funcional'
 *   2. Lógica has_protocols: especialidades com/sem protocolos Essentia
 *   3. Modo effectiveMode: analysis_only para especialidades sem protocolos
 *   4. scoreActives: pontuação de ativos terapêuticos por marcadores alterados
 *   5. matchProtocolsByActives: mapeamento ativo → protocolo Essentia
 *   6. buildUserPrompt: conteúdo do prompt gerado para cada especialidade
 *   7. Integração: fluxo completo Nutrologia, Endocrinologia e Medicina Funcional
 *
 * Como a edge function é Deno/TypeScript sem exports, replicamos as funções
 * e estruturas de dados necessárias para os testes.
 * SYNC NOTE: manter sincronizado com supabase/functions/analyze-lab-results/index.ts
 */
import { describe, it, expect } from "vitest";

// ─── Tipos replicados ─────────────────────────────────────────────────────────
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
  specialty_id?: string;
}

interface ActiveTherapeutic {
  id: string;
  name: string;
  mechanism: string;
  markers_high: string[];
  markers_low: string[];
  markers_any: string[];
  objectives_boost: string[];
  contraindications?: string;
}

interface ScoredActive {
  active: ActiveTherapeutic;
  score: number;
  triggered_by: string[];
}

interface EssentiaProtocol {
  id: string;
  name: string;
  category: string;
  via: "Endovenoso" | "Intramuscular";
  composition: string;
  actives_contained: string[];
  sex_restriction?: "M" | "F";
}

// ─── Dados de especialidades simulando o banco de dados ───────────────────────
// Representa o que está na tabela analysis_prompts do Supabase
const MOCK_SPECIALTIES: Array<{
  specialty_id: string;
  specialty_name: string;
  has_protocols: boolean;
  is_active: boolean;
  system_prompt: string;
}> = [
  {
    specialty_id: "medicina_funcional",
    specialty_name: "Medicina Funcional",
    has_protocols: true,
    is_active: true,
    system_prompt: "Você é um assistente clínico especializado em medicina funcional e integrativa, com profundo conhecimento em interpretação de exames laboratoriais e protocolos de injetáveis terapêuticos.",
  },
  {
    specialty_id: "nutrologia",
    specialty_name: "Nutrologia",
    has_protocols: true,
    is_active: true,
    system_prompt: "Você é um assistente clínico especializado em nutrologia clínica, com foco em avaliação do estado nutricional, deficiências de micronutrientes, composição corporal e protocolos de suplementação terapêutica.",
  },
  {
    specialty_id: "endocrinologia",
    specialty_name: "Endocrinologia",
    has_protocols: true,
    is_active: true,
    system_prompt: "Você é um assistente clínico especializado em endocrinologia e metabolismo, com profundo conhecimento em interpretação de exames hormonais, metabólicos e de função glandular.",
  },
  {
    specialty_id: "dermatologia",
    specialty_name: "Dermatologia",
    has_protocols: false,
    is_active: false,
    system_prompt: "Você é um assistente clínico especializado em dermatologia.",
  },
];

const FALLBACK_SYSTEM_PROMPT = "FALLBACK_PROMPT_HARDCODED";

// ─── Função simulando a lógica de carregamento de prompt do banco ─────────────
// Espelha a lógica do handler em supabase/functions/analyze-lab-results/index.ts
function loadPromptForSpecialty(specialtyId: string): {
  activeSystemPrompt: string;
  specialtyHasProtocols: boolean;
} {
  const promptData = MOCK_SPECIALTIES.find(
    (s) => s.specialty_id === specialtyId && s.is_active === true
  );

  if (promptData?.system_prompt) {
    return {
      activeSystemPrompt: promptData.system_prompt,
      specialtyHasProtocols: promptData.has_protocols ?? false,
    };
  }

  // Fallback: prompt hardcoded
  return {
    activeSystemPrompt: FALLBACK_SYSTEM_PROMPT,
    specialtyHasProtocols: true,
  };
}

// ─── Função simulando effectiveMode ──────────────────────────────────────────
function getEffectiveMode(
  hasProtocols: boolean,
  requestedMode?: string
): "full" | "analysis_only" | "protocols_only" {
  if (!hasProtocols) return "analysis_only";
  return (requestedMode as any) ?? "full";
}

// ─── Ativos terapêuticos (subset para testes) ─────────────────────────────────
const THERAPEUTIC_ACTIVES: ActiveTherapeutic[] = [
  {
    id: "glutationa",
    name: "Glutationa (L-Glutathion)",
    mechanism: "Principal antioxidante intracelular.",
    markers_high: ["pcr", "vhs", "tgo", "tgp", "ggt", "homocisteina", "acido_urico"],
    markers_low: ["albumina"],
    markers_any: [],
    objectives_boost: ["desinflamacao", "longevidade", "saude_hormonal"],
  },
  {
    id: "nac",
    name: "NAC (N-Acetil Cisteína)",
    mechanism: "Precursor da glutationa.",
    markers_high: ["pcr", "vhs", "tgo", "tgp", "ggt", "homocisteina", "creatinina", "ureia"],
    markers_low: [],
    markers_any: [],
    objectives_boost: ["desinflamacao", "longevidade"],
  },
  {
    id: "curcumina",
    name: "Curcumina (Nanomicelas)",
    mechanism: "Potente anti-inflamatório.",
    markers_high: ["pcr", "vhs", "tgo", "tgp", "ggt", "acido_urico", "insulina_jejum", "homa_ir"],
    markers_low: [],
    markers_any: [],
    objectives_boost: ["desinflamacao", "longevidade", "saude_intestinal"],
    contraindications: "Cautela com anticoagulantes.",
  },
  {
    id: "resveratrol",
    name: "Resveratrol (Nanomicelas)",
    mechanism: "Ativa sirtuínas.",
    markers_high: ["ldl", "colesterol_total", "triglicerides", "glicose_jejum", "insulina_jejum", "hba1c", "pcr"],
    markers_low: ["hdl"],
    markers_any: [],
    objectives_boost: ["longevidade", "desinflamacao", "emagrecimento", "cognicao_foco"],
  },
  {
    id: "acido_alfa_lipoico",
    name: "Ácido Alfa-Lipóico (ALA)",
    mechanism: "Antioxidante universal.",
    markers_high: ["glicose_jejum", "insulina_jejum", "hba1c", "homa_ir", "glicemia_media_estimada", "tgo", "tgp"],
    markers_low: [],
    markers_any: [],
    objectives_boost: ["emagrecimento", "desinflamacao", "longevidade"],
  },
  {
    id: "vitamina_d",
    name: "Vitamina D3",
    mechanism: "Hormônio esteroidal com ação imunomoduladora.",
    markers_high: [],
    markers_low: ["vitamina_d"],
    markers_any: [],
    objectives_boost: ["longevidade", "saude_hormonal", "imunidade"],
  },
  {
    id: "complexo_b_b12",
    name: "Complexo B / Metil B12",
    mechanism: "Cofatores essenciais para metabolismo celular.",
    markers_high: ["homocisteina"],
    markers_low: ["vitamina_b12", "acido_folico"],
    markers_any: [],
    objectives_boost: ["energia_disposicao", "cognicao_foco"],
  },
  {
    id: "magnesio",
    name: "Magnésio",
    mechanism: "Cofator de mais de 300 reações enzimáticas.",
    markers_high: ["glicose_jejum", "insulina_jejum", "cortisol"],
    markers_low: ["magnesio"],
    markers_any: [],
    objectives_boost: ["energia_disposicao", "desinflamacao"],
  },
];

// ─── Protocolos Essentia (subset para testes) ─────────────────────────────────
const ESSENTIA_PROTOCOLS: EssentiaProtocol[] = [
  {
    id: "EV 1.1",
    name: "Protocolo adjuvante para Imunidade",
    category: "Imunidade e Antioxidante",
    via: "Endovenoso",
    composition: "Alanil Glutamina, NAC 300mg, L-Glutathion 100mg, Minerais",
    actives_contained: ["nac", "glutationa", "magnesio", "zinco", "selenio", "complexo_b_b12"],
  },
  {
    id: "EV 1.2",
    name: "Protocolo adjuvante Anti-inflamatório",
    category: "Imunidade e Antioxidante",
    via: "Endovenoso",
    composition: "MSM 750mg, NAC 300mg, Ácido Lipoico 600mg",
    actives_contained: ["dmts_msm", "nac", "acido_alfa_lipoico", "aminoacidos", "complexo_b_b12"],
  },
  {
    id: "EV 1.9",
    name: "Protocolo Antioxidante Plus (Curcumina + Resveratrol)",
    category: "Imunidade e Antioxidante",
    via: "Endovenoso",
    composition: "Nanomicelas de Curcumina 50mg, Nanomicelas de Resveratrol 10mg",
    actives_contained: ["curcumina", "resveratrol"],
  },
  {
    id: "EV 9.1_fem",
    name: "Protocolo adjuvante Saúde Feminina",
    category: "Saúde Feminina",
    via: "Endovenoso",
    composition: "Complexo B com Metil B12, Inositol 1g, Magnésio 1g",
    actives_contained: ["complexo_b_b12", "inositol", "magnesio", "l_carnitina", "zinco", "vitamina_d"],
    sex_restriction: "F",
  },
  {
    id: "EV 10.1",
    name: "Protocolo adjuvante Saúde Masculina",
    category: "Saúde Masculina",
    via: "Endovenoso",
    composition: "Zinco 20mg, L-Carnitina 600mg, Vit D3 50.000 UI",
    actives_contained: ["zinco", "l_carnitina", "vitamina_d", "complexo_b_b12", "nac"],
    sex_restriction: "M",
  },
  {
    id: "IM 9.1",
    name: "Protocolo IM adjuvante Saúde Feminina",
    category: "Saúde Feminina",
    via: "Intramuscular",
    composition: "Vit D3 50.000 UI, Vit B12 2500mcg",
    actives_contained: ["vitamina_d", "complexo_b_b12", "coq10"],
    sex_restriction: "F",
  },
  {
    id: "IM 11.1",
    name: "Protocolo IM adjuvante Saúde Masculina",
    category: "Saúde Masculina",
    via: "Intramuscular",
    composition: "Zinco 20mg, Selênio 200mcg, Vit D3 50.000 UI",
    actives_contained: ["zinco", "selenio", "vitamina_d"],
    sex_restriction: "M",
  },
];

// ─── Replicação de scoreActives ───────────────────────────────────────────────
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

    for (const m of active.markers_high) {
      if (highIds.has(m)) {
        score += 2;
        const r = abnormalResults.find((x) => x.marker_id === m);
        if (r?.status === "critical_high") score += 1;
        triggered.push(m);
      }
    }
    for (const m of active.markers_low) {
      if (lowIds.has(m)) {
        score += 2;
        const r = abnormalResults.find((x) => x.marker_id === m);
        if (r?.status === "critical_low") score += 1;
        triggered.push(m);
      }
    }
    for (const m of active.markers_any) {
      if (anyIds.has(m)) {
        score += 1;
        triggered.push(m);
      }
    }
    for (const obj of active.objectives_boost) {
      if (objectiveSet.has(obj)) {
        score += 1.5;
      }
    }

    if (score > 0) {
      scored.push({ active, score, triggered_by: [...new Set(triggered)] });
    }
  }

  return scored.sort((a, b) => b.score - a.score);
}

// ─── Replicação de matchProtocolsByActives ────────────────────────────────────
function matchProtocolsByActives(
  topActiveIds: string[],
  sex: "M" | "F"
): Array<{ protocol: EssentiaProtocol; coverage: number; matched_actives: string[] }> {
  const activeSet = new Set(topActiveIds);
  return ESSENTIA_PROTOCOLS
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
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      if (a.protocol.via === "Endovenoso" && b.protocol.via === "Intramuscular") return -1;
      if (a.protocol.via === "Intramuscular" && b.protocol.via === "Endovenoso") return 1;
      return 0;
    })
    .slice(0, 5);
}

// ─── Replicação simplificada de buildUserPrompt ───────────────────────────────
function buildUserPromptContains(
  req: AnalysisRequest,
  scoredActives: ScoredActive[],
  matchedProtocols: Array<{ protocol: EssentiaProtocol; coverage: number; matched_actives: string[] }>
): string {
  const mode = req.mode ?? "full";
  let prompt = `PACIENTE: ${req.patient_name} | Sexo: ${req.sex}\n`;

  const abnormal = req.results.filter(
    (r) => r.status === "low" || r.status === "high" || r.status === "critical_low" || r.status === "critical_high"
  );
  const normal = req.results.filter((r) => r.status === "normal" || r.status === "qualitative");

  prompt += `\nMARCADORES ALTERADOS (${abnormal.length}):\n`;
  for (const r of abnormal) {
    prompt += `- ${r.marker_name}: ${r.value} ${r.unit} ${r.status}\n`;
  }

  prompt += `\nMARCADORES DENTRO DA FAIXA LABORATORIAL (${normal.length}):\n`;
  for (const r of normal) {
    prompt += `- ${r.marker_name}: ${r.value} ${r.unit}\n`;
  }

  if (mode !== "analysis_only" && scoredActives.length > 0) {
    prompt += `\n(A) ATIVOS TERAPÊUTICOS MAIS RELEVANTES PARA ESTE PACIENTE:\n`;
    for (const sa of scoredActives.slice(0, 8)) {
      prompt += `• ${sa.active.name} (score: ${sa.score.toFixed(1)})\n`;
      prompt += `  Mecanismo: ${sa.active.mechanism}\n`;
      prompt += `  Ativado por: ${sa.triggered_by.join(", ")}\n`;
      if (sa.active.contraindications) {
        prompt += `  ⚠ Contraindicações: ${sa.active.contraindications}\n`;
      }
    }
    prompt += `\n(B) PROTOCOLOS ESSENTIA QUE CONTÊM ESSES ATIVOS:\n`;
    for (const mp of matchedProtocols) {
      prompt += `• ${mp.protocol.id} | ${mp.protocol.name} | Via: ${mp.protocol.via}\n`;
      prompt += `  Composição: ${mp.protocol.composition}\n`;
      prompt += `  Ativos em comum: ${mp.matched_actives.join(", ")} (${mp.coverage} ativos)\n`;
    }
  }

  if (mode === "analysis_only") {
    prompt += `\nMODO: Gere APENAS a análise clínica. Retorne "protocol_recommendations" como array vazio.\n`;
  }

  return prompt;
}

// ─── Helpers de teste ─────────────────────────────────────────────────────────
function mkMarker(
  marker_id: string,
  marker_name: string,
  value: number,
  unit: string,
  status: MarkerResult["status"],
  session_date = "2026-03-01"
): MarkerResult {
  return { marker_id, marker_name, value, text_value: undefined, unit, status, session_date };
}

// ─── TESTES ───────────────────────────────────────────────────────────────────

describe("Prompt Engine — Seleção de Especialidade e Carregamento de Prompt", () => {

  describe("Carregamento de prompt por specialty_id", () => {
    it("carrega prompt de Medicina Funcional corretamente", () => {
      const result = loadPromptForSpecialty("medicina_funcional");
      expect(result.activeSystemPrompt).toContain("medicina funcional");
      expect(result.specialtyHasProtocols).toBe(true);
    });

    it("carrega prompt de Nutrologia corretamente", () => {
      const result = loadPromptForSpecialty("nutrologia");
      expect(result.activeSystemPrompt).toContain("nutrologia");
      expect(result.specialtyHasProtocols).toBe(true);
    });

    it("carrega prompt de Endocrinologia corretamente", () => {
      const result = loadPromptForSpecialty("endocrinologia");
      expect(result.activeSystemPrompt).toContain("endocrinologia");
      expect(result.specialtyHasProtocols).toBe(true);
    });

    it("Dermatologia (inativa) cai no fallback", () => {
      const result = loadPromptForSpecialty("dermatologia");
      // Dermatologia is_active=false → não encontra → fallback
      expect(result.activeSystemPrompt).toBe(FALLBACK_SYSTEM_PROMPT);
      expect(result.specialtyHasProtocols).toBe(true); // fallback usa has_protocols=true
    });

    it("especialidade inexistente cai no fallback", () => {
      const result = loadPromptForSpecialty("cardiologia_inexistente");
      expect(result.activeSystemPrompt).toBe(FALLBACK_SYSTEM_PROMPT);
    });

    it("specialty_id undefined usa fallback (default medicina_funcional)", () => {
      // Simula: const specialtyId = body.specialty_id ?? "medicina_funcional"
      const specialtyId = undefined ?? "medicina_funcional";
      const result = loadPromptForSpecialty(specialtyId);
      expect(result.activeSystemPrompt).toContain("medicina funcional");
      expect(result.specialtyHasProtocols).toBe(true);
    });
  });

  describe("has_protocols: modo effectiveMode por especialidade", () => {
    it("Medicina Funcional (has_protocols=true) → modo 'full' por padrão", () => {
      const { specialtyHasProtocols } = loadPromptForSpecialty("medicina_funcional");
      const mode = getEffectiveMode(specialtyHasProtocols, undefined);
      expect(mode).toBe("full");
    });

    it("Nutrologia (has_protocols=true) → modo 'full' por padrão", () => {
      const { specialtyHasProtocols } = loadPromptForSpecialty("nutrologia");
      const mode = getEffectiveMode(specialtyHasProtocols, undefined);
      expect(mode).toBe("full");
    });

    it("Endocrinologia (has_protocols=true) → modo 'full' por padrão", () => {
      const { specialtyHasProtocols } = loadPromptForSpecialty("endocrinologia");
      const mode = getEffectiveMode(specialtyHasProtocols, undefined);
      expect(mode).toBe("full");
    });

    it("Especialidade sem protocolos → forçado para 'analysis_only'", () => {
      const mode = getEffectiveMode(false, "full");
      expect(mode).toBe("analysis_only");
    });

    it("Especialidade sem protocolos ignora modo 'protocols_only' e força 'analysis_only'", () => {
      const mode = getEffectiveMode(false, "protocols_only");
      expect(mode).toBe("analysis_only");
    });

    it("Especialidade com protocolos respeita modo 'analysis_only' solicitado", () => {
      const mode = getEffectiveMode(true, "analysis_only");
      expect(mode).toBe("analysis_only");
    });

    it("Especialidade com protocolos respeita modo 'protocols_only' solicitado", () => {
      const mode = getEffectiveMode(true, "protocols_only");
      expect(mode).toBe("protocols_only");
    });
  });
});

describe("Prompt Engine — scoreActives (pontuação de ativos terapêuticos)", () => {

  describe("Perfil inflamatório — ativa Glutationa, NAC, Curcumina", () => {
    const abnormal = [
      mkMarker("pcr", "PCR", 8.5, "mg/L", "high"),
      mkMarker("tgo", "TGO", 55, "U/L", "high"),
      mkMarker("tgp", "TGP", 62, "U/L", "high"),
    ];

    it("Glutationa deve ser ativada por PCR, TGO, TGP altos", () => {
      const scored = scoreActives(abnormal, "F", []);
      const glut = scored.find((s) => s.active.id === "glutationa");
      expect(glut).toBeDefined();
      expect(glut!.score).toBeGreaterThan(0);
      expect(glut!.triggered_by).toContain("pcr");
    });

    it("NAC deve ser ativado por PCR, TGO, TGP altos", () => {
      const scored = scoreActives(abnormal, "F", []);
      const nac = scored.find((s) => s.active.id === "nac");
      expect(nac).toBeDefined();
      expect(nac!.triggered_by).toContain("pcr");
    });

    it("Curcumina deve ser ativada por PCR, TGO, TGP altos", () => {
      const scored = scoreActives(abnormal, "F", []);
      const curc = scored.find((s) => s.active.id === "curcumina");
      expect(curc).toBeDefined();
      expect(curc!.triggered_by).toContain("pcr");
    });

    it("ativos são ordenados por score decrescente", () => {
      const scored = scoreActives(abnormal, "F", []);
      for (let i = 0; i < scored.length - 1; i++) {
        expect(scored[i].score).toBeGreaterThanOrEqual(scored[i + 1].score);
      }
    });
  });

  describe("Perfil metabólico — ativa Resveratrol, ALA, Curcumina (Nutrologia/Endocrinologia)", () => {
    const abnormal = [
      mkMarker("glicose_jejum", "Glicose Jejum", 115, "mg/dL", "high"),
      mkMarker("insulina_jejum", "Insulina Jejum", 18, "µUI/mL", "high"),
      mkMarker("hba1c", "HbA1c", 6.1, "%", "high"),
      mkMarker("triglicerides", "Triglicerídeos", 220, "mg/dL", "high"),
      mkMarker("hdl", "HDL", 38, "mg/dL", "low"),
    ];

    it("Resveratrol deve ser ativado por glicose, insulina, TG altos e HDL baixo", () => {
      const scored = scoreActives(abnormal, "F", []);
      const resv = scored.find((s) => s.active.id === "resveratrol");
      expect(resv).toBeDefined();
      expect(resv!.score).toBeGreaterThan(4); // glicose(2) + insulina(2) + TG(2) + HDL_low(2) = 8
      expect(resv!.triggered_by).toContain("glicose_jejum");
      expect(resv!.triggered_by).toContain("hdl");
    });

    it("Ácido Alfa-Lipóico deve ser ativado por glicose, insulina, HbA1c altos", () => {
      const scored = scoreActives(abnormal, "F", []);
      const ala = scored.find((s) => s.active.id === "acido_alfa_lipoico");
      expect(ala).toBeDefined();
      expect(ala!.triggered_by).toContain("glicose_jejum");
      expect(ala!.triggered_by).toContain("insulina_jejum");
    });

    it("Curcumina deve ser ativada por glicose e insulina altos", () => {
      const scored = scoreActives(abnormal, "F", []);
      const curc = scored.find((s) => s.active.id === "curcumina");
      expect(curc).toBeDefined();
      expect(curc!.triggered_by).toContain("insulina_jejum");
    });
  });

  describe("Deficiência de Vitamina D — ativa Vitamina D3", () => {
    const abnormal = [
      mkMarker("vitamina_d", "Vitamina D", 18, "ng/mL", "low"),
    ];

    it("Vitamina D3 deve ser ativada por vitamina_d baixa", () => {
      const scored = scoreActives(abnormal, "F", []);
      const vitD = scored.find((s) => s.active.id === "vitamina_d");
      expect(vitD).toBeDefined();
      expect(vitD!.score).toBe(2);
      expect(vitD!.triggered_by).toContain("vitamina_d");
    });
  });

  describe("Amplificação por objetivos do paciente", () => {
    const abnormal = [
      mkMarker("pcr", "PCR", 5.0, "mg/L", "high"),
    ];

    it("objetivo 'desinflamacao' amplifica score de Glutationa, NAC e Curcumina", () => {
      const semObj = scoreActives(abnormal, "F", []);
      const comObj = scoreActives(abnormal, "F", ["desinflamacao"]);

      const glutSem = semObj.find((s) => s.active.id === "glutationa")!.score;
      const glutCom = comObj.find((s) => s.active.id === "glutationa")!.score;
      expect(glutCom).toBeGreaterThan(glutSem);

      const nacSem = semObj.find((s) => s.active.id === "nac")!.score;
      const nacCom = comObj.find((s) => s.active.id === "nac")!.score;
      expect(nacCom).toBeGreaterThan(nacSem);
    });

    it("objetivo 'longevidade' amplifica score de Resveratrol", () => {
      const abnormalMeta = [mkMarker("ldl", "LDL", 160, "mg/dL", "high")];
      const semObj = scoreActives(abnormalMeta, "F", []);
      const comObj = scoreActives(abnormalMeta, "F", ["longevidade"]);

      const resvSem = semObj.find((s) => s.active.id === "resveratrol")!.score;
      const resvCom = comObj.find((s) => s.active.id === "resveratrol")!.score;
      expect(resvCom).toBeGreaterThan(resvSem);
    });

    it("marcador crítico vale mais que marcador alto normal", () => {
      const alto = [mkMarker("pcr", "PCR", 5.0, "mg/L", "high")];
      const critico = [mkMarker("pcr", "PCR", 50.0, "mg/L", "critical_high")];

      const scoredAlto = scoreActives(alto, "F", []);
      const scoredCritico = scoreActives(critico, "F", []);

      const glutAlto = scoredAlto.find((s) => s.active.id === "glutationa")!.score;
      const glutCritico = scoredCritico.find((s) => s.active.id === "glutationa")!.score;
      expect(glutCritico).toBeGreaterThan(glutAlto);
    });
  });

  describe("Sem marcadores alterados", () => {
    it("retorna array vazio quando não há marcadores alterados", () => {
      const scored = scoreActives([], "F", []);
      expect(scored).toEqual([]);
    });
  });
});

describe("Prompt Engine — matchProtocolsByActives (mapeamento ativo → protocolo)", () => {

  describe("Filtro por sexo", () => {
    it("protocolo feminino (EV 9.1_fem) não aparece para paciente masculino", () => {
      const actives = ["complexo_b_b12", "magnesio", "vitamina_d"];
      const result = matchProtocolsByActives(actives, "M");
      const ids = result.map((r) => r.protocol.id);
      expect(ids).not.toContain("EV 9.1_fem");
      expect(ids).not.toContain("IM 9.1");
    });

    it("protocolo masculino (EV 10.1) não aparece para paciente feminina", () => {
      const actives = ["zinco", "vitamina_d", "nac"];
      const result = matchProtocolsByActives(actives, "F");
      const ids = result.map((r) => r.protocol.id);
      expect(ids).not.toContain("EV 10.1");
      expect(ids).not.toContain("IM 11.1");
    });

    it("protocolo feminino (EV 9.1_fem) aparece para paciente feminina", () => {
      const actives = ["complexo_b_b12", "magnesio", "vitamina_d", "l_carnitina"];
      const result = matchProtocolsByActives(actives, "F");
      const ids = result.map((r) => r.protocol.id);
      expect(ids).toContain("EV 9.1_fem");
    });

    it("protocolo masculino (EV 10.1) aparece para paciente masculino", () => {
      const actives = ["zinco", "vitamina_d", "nac", "complexo_b_b12"];
      const result = matchProtocolsByActives(actives, "M");
      const ids = result.map((r) => r.protocol.id);
      expect(ids).toContain("EV 10.1");
    });
  });

  describe("Cobertura e ordenação", () => {
    it("protocolo com mais ativos em comum aparece primeiro", () => {
      // EV 1.1 tem nac, glutationa, magnesio, complexo_b_b12 = 4 ativos em comum
      // EV 1.9 tem curcumina, resveratrol = 0 ativos em comum (não está na lista)
      const actives = ["nac", "glutationa", "magnesio", "complexo_b_b12"];
      const result = matchProtocolsByActives(actives, "F");
      expect(result.length).toBeGreaterThan(0);
      expect(result[0].coverage).toBeGreaterThanOrEqual(result[result.length - 1].coverage);
    });

    it("retorna no máximo 5 protocolos", () => {
      const actives = ["nac", "glutationa", "magnesio", "complexo_b_b12", "curcumina", "resveratrol", "acido_alfa_lipoico", "vitamina_d"];
      const result = matchProtocolsByActives(actives, "F");
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it("retorna array vazio quando nenhum ativo corresponde a protocolos", () => {
      const result = matchProtocolsByActives(["ativo_inexistente"], "F");
      expect(result).toEqual([]);
    });

    it("Endovenoso tem prioridade sobre Intramuscular com mesma cobertura", () => {
      // EV 9.1_fem e IM 9.1 têm vitamina_d e complexo_b_b12 em comum para paciente F
      const actives = ["vitamina_d", "complexo_b_b12"];
      const result = matchProtocolsByActives(actives, "F");
      const evIdx = result.findIndex((r) => r.protocol.via === "Endovenoso");
      const imIdx = result.findIndex((r) => r.protocol.via === "Intramuscular");
      if (evIdx !== -1 && imIdx !== -1) {
        expect(evIdx).toBeLessThan(imIdx);
      }
    });

    it("matched_actives lista corretamente os ativos em comum", () => {
      const actives = ["nac", "glutationa"];
      const result = matchProtocolsByActives(actives, "F");
      const ev11 = result.find((r) => r.protocol.id === "EV 1.1");
      expect(ev11).toBeDefined();
      expect(ev11!.matched_actives).toContain("nac");
      expect(ev11!.matched_actives).toContain("glutationa");
    });
  });
});

describe("Prompt Engine — buildUserPrompt (conteúdo do prompt por especialidade)", () => {

  const baseRequest: AnalysisRequest = {
    patient_name: "Maria Silva",
    sex: "F",
    sessions: [{ id: "s1", session_date: "2026-03-01" }],
    results: [
      mkMarker("pcr", "PCR", 8.5, "mg/L", "high"),
      mkMarker("vitamina_d", "Vitamina D", 18, "ng/mL", "low"),
      mkMarker("glicose_jejum", "Glicose Jejum", 92, "mg/dL", "normal"),
    ],
    patient_profile: { objectives: ["desinflamacao", "longevidade"] },
  };

  describe("Modo 'full' (Medicina Funcional / Nutrologia / Endocrinologia)", () => {
    it("prompt contém nome do paciente e sexo", () => {
      const abnormal = baseRequest.results.filter(
        (r) => r.status === "high" || r.status === "low"
      );
      const scored = scoreActives(abnormal, "F", ["desinflamacao", "longevidade"]);
      const topIds = scored.slice(0, 8).map((s) => s.active.id);
      const protocols = matchProtocolsByActives(topIds, "F");
      const prompt = buildUserPromptContains(baseRequest, scored, protocols);

      expect(prompt).toContain("Maria Silva");
      expect(prompt).toContain("F");
    });

    it("prompt lista marcadores alterados corretamente", () => {
      const abnormal = baseRequest.results.filter(
        (r) => r.status === "high" || r.status === "low"
      );
      const scored = scoreActives(abnormal, "F", ["desinflamacao"]);
      const protocols = matchProtocolsByActives(scored.slice(0, 8).map((s) => s.active.id), "F");
      const prompt = buildUserPromptContains(baseRequest, scored, protocols);

      expect(prompt).toContain("PCR");
      expect(prompt).toContain("Vitamina D");
      expect(prompt).toContain("MARCADORES ALTERADOS (2)");
    });

    it("prompt inclui seção de ativos terapêuticos no modo 'full'", () => {
      const abnormal = baseRequest.results.filter(
        (r) => r.status === "high" || r.status === "low"
      );
      const scored = scoreActives(abnormal, "F", ["desinflamacao"]);
      const protocols = matchProtocolsByActives(scored.slice(0, 8).map((s) => s.active.id), "F");
      const prompt = buildUserPromptContains(baseRequest, scored, protocols);

      expect(prompt).toContain("ATIVOS TERAPÊUTICOS");
      expect(prompt).toContain("PROTOCOLOS ESSENTIA");
    });

    it("prompt inclui contraindicações quando ativo tem contraindicações", () => {
      const abnormal = [
        mkMarker("pcr", "PCR", 8.5, "mg/L", "high"),
        mkMarker("insulina_jejum", "Insulina Jejum", 20, "µUI/mL", "high"),
      ];
      const scored = scoreActives(abnormal, "F", []);
      const protocols = matchProtocolsByActives(scored.slice(0, 8).map((s) => s.active.id), "F");
      const prompt = buildUserPromptContains({ ...baseRequest, results: abnormal }, scored, protocols);

      // Curcumina tem contraindicação com anticoagulantes
      const curcumina = scored.find((s) => s.active.id === "curcumina");
      if (curcumina) {
        expect(prompt).toContain("Contraindicações");
      }
    });
  });

  describe("Modo 'analysis_only' (especialidade sem protocolos)", () => {
    it("prompt NÃO inclui seção de ativos e protocolos no modo analysis_only", () => {
      const req = { ...baseRequest, mode: "analysis_only" as const };
      const abnormal = req.results.filter((r) => r.status === "high" || r.status === "low");
      const scored = scoreActives(abnormal, "F", []);
      const protocols = matchProtocolsByActives([], "F");
      const prompt = buildUserPromptContains(req, scored, protocols);

      expect(prompt).not.toContain("ATIVOS TERAPÊUTICOS");
      expect(prompt).not.toContain("PROTOCOLOS ESSENTIA");
    });

    it("prompt inclui instrução de array vazio para protocol_recommendations", () => {
      const req = { ...baseRequest, mode: "analysis_only" as const };
      const prompt = buildUserPromptContains(req, [], []);
      expect(prompt).toContain("protocol_recommendations");
      expect(prompt).toContain("array vazio");
    });
  });
});

describe("Prompt Engine — Integração completa por especialidade", () => {

  describe("Nutrologia: paciente com deficiências nutricionais", () => {
    const nutroRequest: AnalysisRequest = {
      patient_name: "Ana Oliveira",
      sex: "F",
      sessions: [{ id: "s1", session_date: "2026-03-01" }],
      results: [
        mkMarker("vitamina_d", "Vitamina D", 15, "ng/mL", "low"),
        mkMarker("vitamina_b12", "Vitamina B12", 180, "pg/mL", "low"),
        mkMarker("ferritina", "Ferritina", 8, "ng/mL", "low"),
        mkMarker("albumina", "Albumina", 3.2, "g/dL", "low"),
        mkMarker("glicose_jejum", "Glicose Jejum", 88, "mg/dL", "normal"),
      ],
      patient_profile: { objectives: ["energia_disposicao", "longevidade"] },
      specialty_id: "nutrologia",
    };

    it("carrega prompt de Nutrologia com has_protocols=true", () => {
      const { specialtyHasProtocols } = loadPromptForSpecialty("nutrologia");
      expect(specialtyHasProtocols).toBe(true);
    });

    it("modo efetivo é 'full' para Nutrologia", () => {
      const { specialtyHasProtocols } = loadPromptForSpecialty("nutrologia");
      expect(getEffectiveMode(specialtyHasProtocols)).toBe("full");
    });

    it("Vitamina D3 e Complexo B são ativados pelas deficiências", () => {
      const abnormal = nutroRequest.results.filter(
        (r) => r.status === "low" || r.status === "high"
      );
      const scored = scoreActives(abnormal, "F", ["energia_disposicao", "longevidade"]);
      const ids = scored.map((s) => s.active.id);
      expect(ids).toContain("vitamina_d");
      expect(ids).toContain("complexo_b_b12");
    });

    it("Glutationa é ativada por albumina baixa", () => {
      const abnormal = nutroRequest.results.filter((r) => r.status === "low");
      const scored = scoreActives(abnormal, "F", []);
      const glut = scored.find((s) => s.active.id === "glutationa");
      expect(glut).toBeDefined();
      expect(glut!.triggered_by).toContain("albumina");
    });

    it("protocolos femininos são sugeridos para paciente F com deficiência de vitamina D", () => {
      const abnormal = nutroRequest.results.filter((r) => r.status === "low");
      const scored = scoreActives(abnormal, "F", []);
      const topIds = scored.slice(0, 8).map((s) => s.active.id);
      const protocols = matchProtocolsByActives(topIds, "F");
      const ids = protocols.map((p) => p.protocol.id);
      // EV 9.1_fem contém vitamina_d e complexo_b_b12
      expect(ids).toContain("EV 9.1_fem");
    });
  });

  describe("Endocrinologia: paciente com resistência insulínica", () => {
    const endoRequest: AnalysisRequest = {
      patient_name: "Carlos Mendes",
      sex: "M",
      sessions: [{ id: "s1", session_date: "2026-03-01" }],
      results: [
        mkMarker("glicose_jejum", "Glicose Jejum", 118, "mg/dL", "high"),
        mkMarker("insulina_jejum", "Insulina Jejum", 22, "µUI/mL", "high"),
        mkMarker("hba1c", "HbA1c", 6.2, "%", "high"),
        mkMarker("homa_ir", "HOMA-IR", 6.4, "", "high"),
        mkMarker("triglicerides", "Triglicerídeos", 195, "mg/dL", "high"),
        mkMarker("hdl", "HDL", 35, "mg/dL", "low"),
      ],
      patient_profile: { objectives: ["emagrecimento", "longevidade"] },
      specialty_id: "endocrinologia",
    };

    it("carrega prompt de Endocrinologia com has_protocols=true", () => {
      const { specialtyHasProtocols } = loadPromptForSpecialty("endocrinologia");
      expect(specialtyHasProtocols).toBe(true);
    });

    it("modo efetivo é 'full' para Endocrinologia", () => {
      const { specialtyHasProtocols } = loadPromptForSpecialty("endocrinologia");
      expect(getEffectiveMode(specialtyHasProtocols)).toBe("full");
    });

    it("Resveratrol, ALA e Curcumina são os top ativos para resistência insulínica", () => {
      const abnormal = endoRequest.results.filter(
        (r) => r.status === "high" || r.status === "low"
      );
      const scored = scoreActives(abnormal, "M", ["emagrecimento", "longevidade"]);
      const topIds = scored.slice(0, 3).map((s) => s.active.id);
      // Resveratrol: glicose(2)+insulina(2)+hba1c(2)+TG(2)+HDL_low(2)+emagrecimento(1.5)+longevidade(1.5) = 13
      // ALA: glicose(2)+insulina(2)+hba1c(2)+homa_ir(2)+emagrecimento(1.5)+longevidade(1.5) = 11
      // Curcumina: insulina(2)+homa_ir(2)+longevidade(1.5) = 5.5
      expect(topIds).toContain("resveratrol");
      expect(topIds).toContain("acido_alfa_lipoico");
    });

    it("protocolos masculinos são sugeridos para paciente M", () => {
      const abnormal = endoRequest.results.filter(
        (r) => r.status === "high" || r.status === "low"
      );
      const scored = scoreActives(abnormal, "M", []);
      const topIds = scored.slice(0, 8).map((s) => s.active.id);
      const protocols = matchProtocolsByActives(topIds, "M");
      const ids = protocols.map((p) => p.protocol.id);
      // EV 10.1 é masculino e contém nac que pode ser ativado
      // Verificar que não há protocolos femininos
      expect(ids).not.toContain("EV 9.1_fem");
      expect(ids).not.toContain("IM 9.1");
    });

    it("prompt no modo 'full' inclui ativos e protocolos para Endocrinologia", () => {
      const abnormal = endoRequest.results.filter(
        (r) => r.status === "high" || r.status === "low"
      );
      const scored = scoreActives(abnormal, "M", ["emagrecimento"]);
      const topIds = scored.slice(0, 8).map((s) => s.active.id);
      const protocols = matchProtocolsByActives(topIds, "M");
      const prompt = buildUserPromptContains(endoRequest, scored, protocols);

      expect(prompt).toContain("Carlos Mendes");
      expect(prompt).toContain("ATIVOS TERAPÊUTICOS");
      expect(prompt).toContain("PROTOCOLOS ESSENTIA");
      expect(prompt).toContain("Resveratrol");
    });
  });

  describe("Medicina Funcional: perfil completo com múltiplos sistemas", () => {
    const funcRequest: AnalysisRequest = {
      patient_name: "Beatriz Costa",
      sex: "F",
      sessions: [{ id: "s1", session_date: "2026-03-01" }],
      results: [
        mkMarker("pcr", "PCR", 6.2, "mg/L", "high"),
        mkMarker("homocisteina", "Homocisteína", 18, "µmol/L", "high"),
        mkMarker("vitamina_d", "Vitamina D", 22, "ng/mL", "low"),
        mkMarker("vitamina_b12", "Vitamina B12", 250, "pg/mL", "low"),
        mkMarker("tsh", "TSH", 2.1, "mUI/L", "normal"),
      ],
      patient_profile: { objectives: ["desinflamacao", "saude_hormonal"] },
      specialty_id: "medicina_funcional",
    };

    it("carrega prompt de Medicina Funcional corretamente", () => {
      const { activeSystemPrompt, specialtyHasProtocols } = loadPromptForSpecialty("medicina_funcional");
      expect(activeSystemPrompt).toContain("medicina funcional");
      expect(specialtyHasProtocols).toBe(true);
    });

    it("Glutationa e NAC são ativados por PCR e homocisteína altos", () => {
      const abnormal = funcRequest.results.filter(
        (r) => r.status === "high" || r.status === "low"
      );
      const scored = scoreActives(abnormal, "F", ["desinflamacao", "saude_hormonal"]);
      const glut = scored.find((s) => s.active.id === "glutationa");
      const nac = scored.find((s) => s.active.id === "nac");
      expect(glut).toBeDefined();
      expect(nac).toBeDefined();
      expect(glut!.triggered_by).toContain("pcr");
      expect(nac!.triggered_by).toContain("homocisteina");
    });

    it("Complexo B é ativado por homocisteína alta e vitamina B12 baixa", () => {
      const abnormal = funcRequest.results.filter(
        (r) => r.status === "high" || r.status === "low"
      );
      const scored = scoreActives(abnormal, "F", []);
      const complexoB = scored.find((s) => s.active.id === "complexo_b_b12");
      expect(complexoB).toBeDefined();
      expect(complexoB!.triggered_by).toContain("homocisteina");
      expect(complexoB!.triggered_by).toContain("vitamina_b12");
    });

    it("objetivo 'saude_hormonal' amplifica score de Glutationa", () => {
      const abnormal = funcRequest.results.filter((r) => r.status === "high");
      const semObj = scoreActives(abnormal, "F", []);
      const comObj = scoreActives(abnormal, "F", ["saude_hormonal"]);

      const glutSem = semObj.find((s) => s.active.id === "glutationa")?.score ?? 0;
      const glutCom = comObj.find((s) => s.active.id === "glutationa")?.score ?? 0;
      expect(glutCom).toBeGreaterThan(glutSem);
    });
  });
});
