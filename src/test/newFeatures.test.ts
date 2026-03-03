/**
 * Testes para as novas funcionalidades implementadas:
 *
 *   1. Restrição de referências funcionais: apenas Nutrologia usa faixas funcionais
 *   2. Integração da anamnese no prompt (contexto clínico do paciente)
 *   3. Integração das notas clínicas do médico no prompt
 *   4. Tabela de prescrição no PDF (formato planilha)
 *   5. Modo "full" na análise IA (geração dos 3 documentos)
 *
 * SYNC NOTE: manter sincronizado com:
 *   - supabase/functions/analyze-lab-results/index.ts (buildUserPrompt, anamneseContext, doctorNotesContext)
 *   - src/pages/PatientDetail.tsx (buildEnrichedResults)
 *   - src/lib/generateReport.ts (tabela de prescrição)
 */
import { describe, it, expect } from "vitest";

// ─── Tipos replicados ─────────────────────────────────────────────────────────
interface MarkerResult {
  marker_id: string;
  marker_name: string;
  value: number | null;
  text_value?: string;
  unit: string;
  lab_min?: number;
  lab_max?: number;
  functional_min?: number;
  functional_max?: number;
  status: "normal" | "low" | "high" | "critical_low" | "critical_high" | "qualitative";
  session_date: string;
}

interface AnalysisRequest {
  patient_name: string;
  patient_id?: string;
  sex: "M" | "F";
  birth_date?: string;
  results: MarkerResult[];
  specialty_id?: string;
  mode?: string;
  patient_profile?: {
    objectives?: string[];
    main_complaints?: string;
    activity_level?: string;
    restrictions?: string;
  };
}

// ─── Replicação de buildUserPrompt com suporte a specialtyIdOverride ──────────
function buildUserPrompt(
  req: AnalysisRequest,
  specialtyIdOverride?: string
): string {
  // Referências funcionais apenas para Nutrologia
  const activeSpecialty = specialtyIdOverride ?? req.specialty_id ?? "medicina_funcional";
  const useFunctionalRefs = activeSpecialty === "nutrologia";

  const abnormal = req.results.filter(
    (r) => r.status === "low" || r.status === "high" || r.status === "critical_low" || r.status === "critical_high"
  );
  const normal = req.results.filter((r) => r.status === "normal");

  let prompt = `DADOS DO PACIENTE:\n- Nome: ${req.patient_name}\n`;

  prompt += `\nMARCADORES FORA DA FAIXA LABORATORIAL (${abnormal.length}):\n`;
  for (const r of abnormal) {
    const valueStr = r.value !== null ? `${r.value} ${r.unit}` : r.text_value ?? "—";
    const labRefStr = r.lab_min !== undefined && r.lab_max !== undefined
      ? `(ref. lab: ${r.lab_min}–${r.lab_max} ${r.unit})`
      : "";
    const funcRefStr = useFunctionalRefs && r.functional_min !== undefined && r.functional_max !== undefined
      ? `[faixa funcional: ${r.functional_min}–${r.functional_max}]`
      : "";
    prompt += `- ${r.marker_name}: ${valueStr} ${labRefStr} ${funcRefStr}\n`;
  }

  prompt += `\nMARCADORES DENTRO DA FAIXA LABORATORIAL (${normal.length}):\n`;
  for (const r of normal) {
    const valueStr = r.value !== null ? `${r.value} ${r.unit}` : r.text_value ?? "—";
    const funcRefStr = useFunctionalRefs && r.functional_min !== undefined && r.functional_max !== undefined
      ? `[faixa funcional: ${r.functional_min}–${r.functional_max}]`
      : "";
    prompt += `- ${r.marker_name}: ${valueStr} ${funcRefStr}\n`;
  }

  return prompt;
}

// ─── Replicação de buildEnrichedResults (frontend) ───────────────────────────
function buildEnrichedResults(
  results: Array<{ marker_id: string; value: number; unit: string; status: MarkerResult["status"]; session_date: string }>,
  selectedSpecialty: string,
  markerRefRanges: Record<string, { labMin?: number; labMax?: number; funcMin?: number; funcMax?: number }>
): MarkerResult[] {
  const isNutrologia = selectedSpecialty === "nutrologia";
  return results.map((r) => {
    const ref = markerRefRanges[r.marker_id] ?? {};
    return {
      marker_id: r.marker_id,
      marker_name: r.marker_id,
      value: r.value,
      unit: r.unit,
      lab_min: ref.labMin,
      lab_max: ref.labMax,
      functional_min: isNutrologia ? ref.funcMin : undefined,
      functional_max: isNutrologia ? ref.funcMax : undefined,
      status: r.status,
      session_date: r.session_date,
    };
  });
}

// ─── Replicação de buildAnamneseContext ───────────────────────────────────────
function buildAnamneseContext(anamneseData: Record<string, unknown>, specialtyId: string): string {
  const lines: string[] = [];
  if (anamneseData.queixas_principais) lines.push(`Queixas principais: ${anamneseData.queixas_principais}`);
  if (anamneseData.objetivos) lines.push(`Objetivos: ${anamneseData.objetivos}`);
  if (anamneseData.nota_saude !== null && anamneseData.nota_saude !== undefined) lines.push(`Nota de saude (0-10): ${anamneseData.nota_saude}`);
  if (anamneseData.comorbidades) lines.push(`Comorbidades/historico: ${anamneseData.comorbidades}`);
  if (anamneseData.medicamentos_continuos) lines.push(`Medicamentos continuos: ${anamneseData.medicamentos_continuos}`);
  if (Array.isArray(anamneseData.sintomas_atuais) && (anamneseData.sintomas_atuais as string[]).length > 0) {
    lines.push(`Sintomas atuais: ${(anamneseData.sintomas_atuais as string[]).join(", ")}`);
  }
  if (anamneseData.nivel_estresse !== null && anamneseData.nivel_estresse !== undefined) {
    lines.push(`Nivel de estresse (0-10): ${anamneseData.nivel_estresse}`);
  }
  if (anamneseData.recordatorio_alimentar) lines.push(`Recordatorio alimentar: ${anamneseData.recordatorio_alimentar}`);
  if (lines.length === 0) return "";
  return `\nANAMNESE DO PACIENTE (${specialtyId.replace(/_/g, " ")}):\n` + lines.map(l => `- ${l}`).join("\n") + "\n";
}

// ─── Replicação de buildDoctorNotesContext ────────────────────────────────────
function buildDoctorNotesContext(notesData: Record<string, unknown>, specialtyId: string): string {
  const noteLines: string[] = [];
  if (notesData.impressao_clinica) noteLines.push(`Impressao clinica: ${notesData.impressao_clinica}`);
  if (notesData.hipoteses_diagnosticas) noteLines.push(`Hipoteses diagnosticas: ${notesData.hipoteses_diagnosticas}`);
  if (notesData.foco_consulta) noteLines.push(`Foco desta consulta: ${notesData.foco_consulta}`);
  if (notesData.conduta_planejada) noteLines.push(`Conduta planejada: ${notesData.conduta_planejada}`);
  if (notesData.pontos_atencao) noteLines.push(`Pontos de atencao: ${notesData.pontos_atencao}`);
  if (notesData.medicamentos_prescritos) noteLines.push(`Medicamentos ja prescritos: ${notesData.medicamentos_prescritos}`);
  if (notesData.resposta_tratamento) noteLines.push(`Resposta ao tratamento anterior: ${notesData.resposta_tratamento}`);
  if (notesData.proximos_passos) noteLines.push(`Proximos passos planejados: ${notesData.proximos_passos}`);
  if (notesData.notas_livres) noteLines.push(`Notas adicionais: ${notesData.notas_livres}`);
  if (notesData.adesao_tratamento) noteLines.push(`Adesao ao tratamento: ${notesData.adesao_tratamento}`);
  if (notesData.motivacao_paciente) noteLines.push(`Motivacao do paciente: ${notesData.motivacao_paciente}`);
  if (notesData.exames_em_dia !== null && notesData.exames_em_dia !== undefined) {
    noteLines.push(`Exames em dia: ${notesData.exames_em_dia ? "sim" : "nao"}`);
  }
  if (noteLines.length === 0) return "";
  return `\nNOTAS CLINICAS DO MEDICO (${specialtyId.replace(/_/g, " ")}):\n` + noteLines.map(l => `- ${l}`).join("\n") + "\n";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function mkMarker(
  id: string,
  value: number,
  unit: string,
  status: MarkerResult["status"],
  labMin?: number,
  labMax?: number,
  funcMin?: number,
  funcMax?: number
): MarkerResult {
  return {
    marker_id: id,
    marker_name: id,
    value,
    unit,
    lab_min: labMin,
    lab_max: labMax,
    functional_min: funcMin,
    functional_max: funcMax,
    status,
    session_date: "2026-03-03",
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1: Restrição de Referências Funcionais
// ═══════════════════════════════════════════════════════════════════════════════
describe("Referências Funcionais — Restrição por Especialidade", () => {
  const vitD = mkMarker("vitamina_d", 18, "ng/mL", "low", 20, 60, 50, 80);
  const ferritina = mkMarker("ferritina", 12, "ng/mL", "low", 15, 150, 50, 100);
  const tsh = mkMarker("tsh", 3.5, "mUI/L", "normal", 0.5, 4.5, 1.0, 2.5);

  const req: AnalysisRequest = {
    patient_name: "Paciente Teste",
    sex: "F",
    results: [vitD, ferritina, tsh],
  };

  describe("Nutrologia — deve incluir faixas funcionais", () => {
    it("inclui [faixa funcional] para marcadores alterados em Nutrologia", () => {
      const prompt = buildUserPrompt({ ...req, specialty_id: "nutrologia" }, "nutrologia");
      expect(prompt).toContain("faixa funcional");
    });

    it("inclui faixa funcional da Vitamina D (50–80) para Nutrologia", () => {
      const prompt = buildUserPrompt({ ...req, specialty_id: "nutrologia" }, "nutrologia");
      expect(prompt).toContain("50–80");
    });

    it("inclui faixa funcional da Ferritina (50–100) para Nutrologia", () => {
      const prompt = buildUserPrompt({ ...req, specialty_id: "nutrologia" }, "nutrologia");
      expect(prompt).toContain("50–100");
    });

    it("inclui faixa funcional do TSH (1.0–2.5) nos marcadores normais para Nutrologia", () => {
      const prompt = buildUserPrompt({ ...req, specialty_id: "nutrologia" }, "nutrologia");
      expect(prompt).toContain("1–2.5");
    });
  });

  describe("Medicina Funcional — NÃO deve incluir faixas funcionais", () => {
    it("NÃO inclui [faixa funcional] para Medicina Funcional", () => {
      const prompt = buildUserPrompt({ ...req, specialty_id: "medicina_funcional" }, "medicina_funcional");
      expect(prompt).not.toContain("faixa funcional");
    });

    it("inclui apenas referência laboratorial (ref. lab) para Medicina Funcional", () => {
      const prompt = buildUserPrompt({ ...req, specialty_id: "medicina_funcional" }, "medicina_funcional");
      expect(prompt).toContain("ref. lab: 20–60");
    });
  });

  describe("Cardiologia — NÃO deve incluir faixas funcionais", () => {
    it("NÃO inclui [faixa funcional] para Cardiologia", () => {
      const prompt = buildUserPrompt({ ...req, specialty_id: "cardiologia" }, "cardiologia");
      expect(prompt).not.toContain("faixa funcional");
    });
  });

  describe("Endocrinologia — NÃO deve incluir faixas funcionais", () => {
    it("NÃO inclui [faixa funcional] para Endocrinologia", () => {
      const prompt = buildUserPrompt({ ...req, specialty_id: "endocrinologia" }, "endocrinologia");
      expect(prompt).not.toContain("faixa funcional");
    });
  });

  describe("Fallback para medicina_funcional — NÃO deve incluir faixas funcionais", () => {
    it("NÃO inclui [faixa funcional] quando specialty_id não é informado", () => {
      const prompt = buildUserPrompt(req); // sem specialty_id
      expect(prompt).not.toContain("faixa funcional");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2: buildEnrichedResults (frontend) — Restrição por Especialidade
// ═══════════════════════════════════════════════════════════════════════════════
describe("buildEnrichedResults (frontend) — Restrição de Referências Funcionais", () => {
  const rawResults = [
    { marker_id: "vitamina_d", value: 18, unit: "ng/mL", status: "low" as const, session_date: "2026-03-03" },
    { marker_id: "tsh", value: 3.5, unit: "mUI/L", status: "normal" as const, session_date: "2026-03-03" },
  ];
  const markerRefs = {
    vitamina_d: { labMin: 20, labMax: 60, funcMin: 50, funcMax: 80 },
    tsh: { labMin: 0.5, labMax: 4.5, funcMin: 1.0, funcMax: 2.5 },
  };

  it("Nutrologia: functional_min e functional_max são preenchidos", () => {
    const enriched = buildEnrichedResults(rawResults, "nutrologia", markerRefs);
    const vitD = enriched.find(r => r.marker_id === "vitamina_d")!;
    expect(vitD.functional_min).toBe(50);
    expect(vitD.functional_max).toBe(80);
  });

  it("Medicina Funcional: functional_min e functional_max são undefined", () => {
    const enriched = buildEnrichedResults(rawResults, "medicina_funcional", markerRefs);
    const vitD = enriched.find(r => r.marker_id === "vitamina_d")!;
    expect(vitD.functional_min).toBeUndefined();
    expect(vitD.functional_max).toBeUndefined();
  });

  it("Cardiologia: functional_min e functional_max são undefined", () => {
    const enriched = buildEnrichedResults(rawResults, "cardiologia", markerRefs);
    const tsh = enriched.find(r => r.marker_id === "tsh")!;
    expect(tsh.functional_min).toBeUndefined();
    expect(tsh.functional_max).toBeUndefined();
  });

  it("lab_min e lab_max são sempre preenchidos independente da especialidade", () => {
    for (const specialty of ["nutrologia", "medicina_funcional", "cardiologia", "endocrinologia"]) {
      const enriched = buildEnrichedResults(rawResults, specialty, markerRefs);
      const vitD = enriched.find(r => r.marker_id === "vitamina_d")!;
      expect(vitD.lab_min).toBe(20);
      expect(vitD.lab_max).toBe(60);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3: Anamnese — Construção do Contexto para o Prompt
// ═══════════════════════════════════════════════════════════════════════════════
describe("Anamnese — Contexto para o Prompt da IA", () => {
  const anamneseCompleta = {
    queixas_principais: "Fadiga crônica, queda de cabelo",
    objetivos: "Melhorar energia e disposição",
    nota_saude: 5,
    comorbidades: "Hipotireoidismo subclínico",
    medicamentos_continuos: "Levotiroxina 25mcg",
    sintomas_atuais: ["fadiga", "ansiedade", "insônia"],
    nivel_estresse: 8,
    recordatorio_alimentar: "Café da manhã: pão e café. Almoço: arroz, feijão e frango.",
  };

  it("gera contexto com queixas principais", () => {
    const ctx = buildAnamneseContext(anamneseCompleta, "nutrologia");
    expect(ctx).toContain("Fadiga crônica, queda de cabelo");
  });

  it("gera contexto com objetivos do paciente", () => {
    const ctx = buildAnamneseContext(anamneseCompleta, "nutrologia");
    expect(ctx).toContain("Melhorar energia e disposição");
  });

  it("gera contexto com nota de saúde", () => {
    const ctx = buildAnamneseContext(anamneseCompleta, "nutrologia");
    expect(ctx).toContain("Nota de saude (0-10): 5");
  });

  it("gera contexto com comorbidades", () => {
    const ctx = buildAnamneseContext(anamneseCompleta, "nutrologia");
    expect(ctx).toContain("Hipotireoidismo subclínico");
  });

  it("gera contexto com medicamentos contínuos", () => {
    const ctx = buildAnamneseContext(anamneseCompleta, "nutrologia");
    expect(ctx).toContain("Levotiroxina 25mcg");
  });

  it("gera contexto com lista de sintomas atuais", () => {
    const ctx = buildAnamneseContext(anamneseCompleta, "nutrologia");
    expect(ctx).toContain("fadiga");
    expect(ctx).toContain("ansiedade");
    expect(ctx).toContain("insônia");
  });

  it("gera contexto com nível de estresse", () => {
    const ctx = buildAnamneseContext(anamneseCompleta, "nutrologia");
    expect(ctx).toContain("Nivel de estresse (0-10): 8");
  });

  it("inclui o nome da especialidade no cabeçalho do contexto", () => {
    const ctx = buildAnamneseContext(anamneseCompleta, "medicina_funcional");
    expect(ctx).toContain("ANAMNESE DO PACIENTE (medicina funcional)");
  });

  it("retorna string vazia quando anamnese está vazia", () => {
    const ctx = buildAnamneseContext({}, "nutrologia");
    expect(ctx).toBe("");
  });

  it("não inclui campos nulos ou undefined", () => {
    const parcial = { queixas_principais: "Dor de cabeça", objetivos: null };
    const ctx = buildAnamneseContext(parcial, "nutrologia");
    expect(ctx).toContain("Dor de cabeça");
    expect(ctx).not.toContain("null");
    expect(ctx).not.toContain("undefined");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 4: Notas Clínicas do Médico — Contexto para o Prompt
// ═══════════════════════════════════════════════════════════════════════════════
describe("Notas Clínicas do Médico — Contexto para o Prompt da IA", () => {
  const notasCompletas = {
    impressao_clinica: "Paciente com síndrome metabólica em evolução",
    hipoteses_diagnosticas: "Resistência insulínica, dislipidemia mista",
    foco_consulta: "Revisão de exames e ajuste de suplementação",
    conduta_planejada: "Iniciar berberina 500mg 2x/dia, revisar dieta",
    pontos_atencao: "Triglicerídeos muito elevados, risco cardiovascular",
    medicamentos_prescritos: "Berberina 500mg, Ômega-3 2g/dia",
    resposta_tratamento: "Boa adesão ao protocolo anterior, redução de 10% no peso",
    proximos_passos: "Repetir exames em 90 dias",
    notas_livres: "Paciente muito motivada, boa compreensão do tratamento",
    adesao_tratamento: "Excelente",
    motivacao_paciente: "Alta",
    exames_em_dia: true,
  };

  it("gera contexto com impressão clínica", () => {
    const ctx = buildDoctorNotesContext(notasCompletas, "nutrologia");
    expect(ctx).toContain("síndrome metabólica");
  });

  it("gera contexto com hipóteses diagnósticas", () => {
    const ctx = buildDoctorNotesContext(notasCompletas, "nutrologia");
    expect(ctx).toContain("Resistência insulínica");
  });

  it("gera contexto com conduta planejada", () => {
    const ctx = buildDoctorNotesContext(notasCompletas, "nutrologia");
    expect(ctx).toContain("berberina 500mg");
  });

  it("gera contexto com pontos de atenção", () => {
    const ctx = buildDoctorNotesContext(notasCompletas, "nutrologia");
    expect(ctx).toContain("Triglicerídeos muito elevados");
  });

  it("gera contexto com medicamentos já prescritos", () => {
    const ctx = buildDoctorNotesContext(notasCompletas, "nutrologia");
    expect(ctx).toContain("Ômega-3 2g/dia");
  });

  it("gera contexto com resposta ao tratamento anterior", () => {
    const ctx = buildDoctorNotesContext(notasCompletas, "nutrologia");
    expect(ctx).toContain("redução de 10% no peso");
  });

  it("gera contexto com exames em dia (true → 'sim')", () => {
    const ctx = buildDoctorNotesContext(notasCompletas, "nutrologia");
    expect(ctx).toContain("Exames em dia: sim");
  });

  it("gera contexto com exames em dia (false → 'nao')", () => {
    const ctx = buildDoctorNotesContext({ exames_em_dia: false }, "nutrologia");
    expect(ctx).toContain("Exames em dia: nao");
  });

  it("inclui o nome da especialidade no cabeçalho", () => {
    const ctx = buildDoctorNotesContext(notasCompletas, "cardiologia");
    expect(ctx).toContain("NOTAS CLINICAS DO MEDICO (cardiologia)");
  });

  it("retorna string vazia quando notas estão vazias", () => {
    const ctx = buildDoctorNotesContext({}, "nutrologia");
    expect(ctx).toBe("");
  });

  it("substitui underscores por espaços no nome da especialidade", () => {
    const ctx = buildDoctorNotesContext({ impressao_clinica: "Teste" }, "medicina_funcional");
    expect(ctx).toContain("NOTAS CLINICAS DO MEDICO (medicina funcional)");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 5: Combinação de Contextos no Prompt Final
// ═══════════════════════════════════════════════════════════════════════════════
describe("Combinação de Anamnese + Notas Clínicas no Prompt", () => {
  const req: AnalysisRequest = {
    patient_name: "Maria Silva",
    sex: "F",
    specialty_id: "nutrologia",
    results: [
      mkMarker("vitamina_d", 18, "ng/mL", "low", 20, 60, 50, 80),
    ],
  };

  const anamnese = {
    queixas_principais: "Fadiga e queda de cabelo",
    nota_saude: 4,
  };

  const notas = {
    impressao_clinica: "Deficiência nutricional múltipla",
    conduta_planejada: "Reposição de Vitamina D 10.000UI/dia",
  };

  it("prompt com anamnese contém dados clínicos do paciente", () => {
    const basePrompt = buildUserPrompt(req, "nutrologia");
    const anamneseCtx = buildAnamneseContext(anamnese, "nutrologia");
    const combined = basePrompt.replace("\nMARCADORES FORA DA FAIXA", anamneseCtx + "\nMARCADORES FORA DA FAIXA");
    expect(combined).toContain("Fadiga e queda de cabelo");
    expect(combined).toContain("Nota de saude (0-10): 4");
  });

  it("prompt com notas clínicas contém observações do médico", () => {
    const basePrompt = buildUserPrompt(req, "nutrologia");
    const notasCtx = buildDoctorNotesContext(notas, "nutrologia");
    const combined = basePrompt.replace("\nMARCADORES FORA DA FAIXA", notasCtx + "\nMARCADORES FORA DA FAIXA");
    expect(combined).toContain("Deficiência nutricional múltipla");
    expect(combined).toContain("Reposição de Vitamina D");
  });

  it("prompt com ambos os contextos contém anamnese E notas clínicas", () => {
    const basePrompt = buildUserPrompt(req, "nutrologia");
    const anamneseCtx = buildAnamneseContext(anamnese, "nutrologia");
    const notasCtx = buildDoctorNotesContext(notas, "nutrologia");
    const combined = basePrompt.replace(
      "\nMARCADORES FORA DA FAIXA",
      anamneseCtx + notasCtx + "\nMARCADORES FORA DA FAIXA"
    );
    expect(combined).toContain("ANAMNESE DO PACIENTE");
    expect(combined).toContain("NOTAS CLINICAS DO MEDICO");
    expect(combined).toContain("Fadiga e queda de cabelo");
    expect(combined).toContain("Deficiência nutricional múltipla");
  });

  it("contextos vazios não adicionam texto desnecessário ao prompt", () => {
    const basePrompt = buildUserPrompt(req, "nutrologia");
    const anamneseCtx = buildAnamneseContext({}, "nutrologia");
    const notasCtx = buildDoctorNotesContext({}, "nutrologia");
    const combined = (anamneseCtx || "") + (notasCtx || "");
    expect(combined).toBe("");
    // Prompt base não deve ser modificado
    expect(basePrompt).not.toContain("ANAMNESE DO PACIENTE");
    expect(basePrompt).not.toContain("NOTAS CLINICAS DO MEDICO");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 6: Tabela de Prescrição — Estrutura dos Dados
// ═══════════════════════════════════════════════════════════════════════════════
describe("Tabela de Prescrição — Estrutura e Validação dos Dados", () => {
  interface PrescriptionRow {
    substance: string;
    dose: string;
    route: string;
    frequency: string;
    duration: string;
    conditions?: string;
    monitoring?: string;
  }

  function validatePrescriptionRow(row: PrescriptionRow): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    if (!row.substance || row.substance.trim() === "") errors.push("substance é obrigatório");
    if (!row.dose || row.dose.trim() === "") errors.push("dose é obrigatório");
    if (!row.route || row.route.trim() === "") errors.push("route é obrigatório");
    if (!row.frequency || row.frequency.trim() === "") errors.push("frequency é obrigatório");
    if (!row.duration || row.duration.trim() === "") errors.push("duration é obrigatório");
    return { valid: errors.length === 0, errors };
  }

  const rowValida: PrescriptionRow = {
    substance: "Vitamina D3",
    dose: "10.000 UI",
    route: "Oral",
    frequency: "1x/dia",
    duration: "90 dias",
    conditions: "Tomar com refeição gordurosa",
    monitoring: "Dosagem de 25-OH-D3 em 90 dias",
  };

  it("linha de prescrição válida passa na validação", () => {
    const { valid } = validatePrescriptionRow(rowValida);
    expect(valid).toBe(true);
  });

  it("linha sem substance falha na validação", () => {
    const { valid, errors } = validatePrescriptionRow({ ...rowValida, substance: "" });
    expect(valid).toBe(false);
    expect(errors).toContain("substance é obrigatório");
  });

  it("linha sem dose falha na validação", () => {
    const { valid, errors } = validatePrescriptionRow({ ...rowValida, dose: "" });
    expect(valid).toBe(false);
    expect(errors).toContain("dose é obrigatório");
  });

  it("linha sem route falha na validação", () => {
    const { valid, errors } = validatePrescriptionRow({ ...rowValida, route: "" });
    expect(valid).toBe(false);
    expect(errors).toContain("route é obrigatório");
  });

  it("linha sem frequency falha na validação", () => {
    const { valid, errors } = validatePrescriptionRow({ ...rowValida, frequency: "" });
    expect(valid).toBe(false);
    expect(errors).toContain("frequency é obrigatório");
  });

  it("linha sem duration falha na validação", () => {
    const { valid, errors } = validatePrescriptionRow({ ...rowValida, duration: "" });
    expect(valid).toBe(false);
    expect(errors).toContain("duration é obrigatório");
  });

  it("conditions e monitoring são opcionais", () => {
    const semOpcional: PrescriptionRow = {
      substance: "Magnésio",
      dose: "300mg",
      route: "Oral",
      frequency: "1x/dia",
      duration: "60 dias",
    };
    const { valid } = validatePrescriptionRow(semOpcional);
    expect(valid).toBe(true);
  });

  it("tabela com múltiplas linhas válidas é aceita", () => {
    const tabela: PrescriptionRow[] = [
      { substance: "Vitamina D3", dose: "10.000 UI", route: "Oral", frequency: "1x/dia", duration: "90 dias" },
      { substance: "Ômega-3", dose: "2g", route: "Oral", frequency: "2x/dia", duration: "90 dias" },
      { substance: "Magnésio Bisglicinato", dose: "300mg", route: "Oral", frequency: "1x/noite", duration: "60 dias" },
      { substance: "Zinco", dose: "30mg", route: "Oral", frequency: "1x/dia", duration: "60 dias" },
    ];
    const results = tabela.map(validatePrescriptionRow);
    expect(results.every(r => r.valid)).toBe(true);
  });

  it("tabela vazia não causa erro", () => {
    const tabela: PrescriptionRow[] = [];
    expect(tabela.length).toBe(0);
    expect(() => tabela.map(validatePrescriptionRow)).not.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 7: Modo "full" — Geração dos 3 Documentos
// ═══════════════════════════════════════════════════════════════════════════════
describe("Modo 'full' — Geração dos 3 Documentos de Análise IA", () => {
  // Simula a estrutura de resposta esperada da IA no modo full
  interface AIAnalysisResponse {
    technical_analysis?: string;
    patient_plan?: string;
    prescription_table?: Array<{
      substance: string;
      dose: string;
      route: string;
      frequency: string;
      duration: string;
      conditions?: string;
      monitoring?: string;
    }>;
    protocol_recommendations?: unknown[];
  }

  function validateFullModeResponse(response: AIAnalysisResponse): { valid: boolean; missing: string[] } {
    const missing: string[] = [];
    if (!response.technical_analysis || response.technical_analysis.trim() === "") {
      missing.push("technical_analysis");
    }
    if (!response.patient_plan || response.patient_plan.trim() === "") {
      missing.push("patient_plan");
    }
    if (!Array.isArray(response.prescription_table)) {
      missing.push("prescription_table (deve ser array)");
    }
    return { valid: missing.length === 0, missing };
  }

  it("resposta completa no modo full é válida", () => {
    const response: AIAnalysisResponse = {
      technical_analysis: "Análise técnica detalhada dos marcadores...",
      patient_plan: "Plano de saúde personalizado para o paciente...",
      prescription_table: [
        { substance: "Vitamina D3", dose: "10.000 UI", route: "Oral", frequency: "1x/dia", duration: "90 dias" },
      ],
      protocol_recommendations: [],
    };
    const { valid } = validateFullModeResponse(response);
    expect(valid).toBe(true);
  });

  it("resposta sem technical_analysis é inválida", () => {
    const response: AIAnalysisResponse = {
      patient_plan: "Plano...",
      prescription_table: [],
    };
    const { valid, missing } = validateFullModeResponse(response);
    expect(valid).toBe(false);
    expect(missing).toContain("technical_analysis");
  });

  it("resposta sem patient_plan é inválida", () => {
    const response: AIAnalysisResponse = {
      technical_analysis: "Análise...",
      prescription_table: [],
    };
    const { valid, missing } = validateFullModeResponse(response);
    expect(valid).toBe(false);
    expect(missing).toContain("patient_plan");
  });

  it("prescription_table como array vazio é válido (sem prescrições)", () => {
    const response: AIAnalysisResponse = {
      technical_analysis: "Análise...",
      patient_plan: "Plano...",
      prescription_table: [],
    };
    const { valid } = validateFullModeResponse(response);
    expect(valid).toBe(true);
  });

  it("prescription_table como undefined é inválido", () => {
    const response: AIAnalysisResponse = {
      technical_analysis: "Análise...",
      patient_plan: "Plano...",
    };
    const { valid, missing } = validateFullModeResponse(response);
    expect(valid).toBe(false);
    expect(missing).toContain("prescription_table (deve ser array)");
  });
});
