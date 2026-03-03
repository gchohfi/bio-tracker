import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-info, x-supabase-client-platform, x-supabase-client-platform-version",
};

// ── Schema dos campos que a IA deve extrair ──────────────────────────────────
const ANAMNESE_SCHEMA = `
Extraia do texto abaixo os dados clínicos do paciente e retorne um JSON com os campos disponíveis.
Retorne APENAS os campos que você conseguir identificar no texto — não invente dados.
Todos os valores devem ser strings, exceto nota_saude e nivel_estresse (números inteiros 0-10),
habitos e sintomas_atuais (arrays de strings).

Campos disponíveis:
- expectativa_consulta: string — o que o paciente espera da consulta
- queixas_principais: string — queixas principais do paciente
- objetivos: string — objetivos do paciente (emagrecimento, energia, etc.)
- nota_saude: number (0-10) — nota que o paciente dá para sua saúde
- o_que_melhoraria: string — o que precisaria acontecer para melhorar 1 ponto
- fase_melhor: string — época em que se sentia melhor
- evento_marcante: string — evento marcante nessa época
- comorbidades: string — doenças, cirurgias, histórico familiar
- peso_altura: string — peso e altura
- tipo_sanguineo: string — tipo sanguíneo
- suplementacao: string — suplementos que usa atualmente
- medicamentos_continuos: string — medicamentos de uso contínuo
- estado_pele: string — condição da pele
- estado_cabelos: string — condição dos cabelos
- estado_unhas: string — condição das unhas
- memoria_concentracao: string — memória e concentração
- imunidade: string — imunidade (quantas vezes fica doente por ano)
- consumo_cafe: string — consumo de café
- habitos: string[] — lista de hábitos (valores possíveis: "Etilismo", "Tabagismo", "Adicção")
- sintomas_atuais: string[] — lista de sintomas presentes (ex: ["Fadiga", "Ansiedade", "Queda de cabelo"])
- evacuacoes_por_dia: string — quantas vezes evacua por dia
- tipo_fezes: string — tipo de fezes (escala de Bristol, ex: "4")
- uso_antibiotico_2anos: string — uso de antibiótico nos últimos 2 anos
- estufamento_gases: string — estufamento e gases
- litros_agua_dia: string — litros de água por dia
- dorme_bem: string — dorme bem? (sim/não/às vezes)
- horario_sono: string — horário que dorme e acorda
- acorda_cansado: string — como acorda (descansado/cansado)
- dificuldade_dormir: string — dificuldade para dormir
- nivel_estresse: number (0-10) — nível de estresse
- faz_terapia: string — faz terapia?
- atividade_relaxamento: string — atividade de relaxamento
- hobbies: string — hobbies
- atividade_fisica: string — atividade física que pratica
- recordatorio_alimentar: string — o que come no dia a dia
- intolerancias_alimentares: string — intolerâncias alimentares
- episodios_compulsao: string — episódios de compulsão alimentar
- culpa_apos_comer: string — sente culpa após comer
- preferencias_alimentares: string — alimentos preferidos
- aversoes_alimentares: string — alimentos que não gosta
- ciclo_regular: string — ciclo menstrual regular?
- metodo_contraceptivo: string — método contraceptivo
- deseja_engravidar: string — deseja engravidar?
- tem_tpm: string — tem TPM? como é?

Retorne SOMENTE o JSON, sem markdown, sem explicações.
Exemplo de retorno: {"queixas_principais": "fadiga e queda de cabelo", "nota_saude": 6, "sintomas_atuais": ["Fadiga", "Queda de cabelo"]}
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text, specialty_id } = await req.json();

    if (!text || text.trim().length < 10) {
      return new Response(
        JSON.stringify({ error: "Texto muito curto para processar" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const specialtyLabel: Record<string, string> = {
      medicina_funcional: "Medicina Funcional",
      nutrologia: "Nutrologia",
      endocrinologia: "Endocrinologia",
      cardiologia: "Cardiologia",
    };

    const systemPrompt = `Você é um assistente médico especializado em ${specialtyLabel[specialty_id] ?? "medicina"}. 
Sua tarefa é extrair dados clínicos de textos de anamnese preenchidos por pacientes.
Seja preciso e conservador — extraia apenas o que está claramente presente no texto.
Normalize os sintomas para os nomes padrão da lista quando possível.`;

    const userPrompt = `${ANAMNESE_SCHEMA}

TEXTO DO PACIENTE:
${text}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.1,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI error: ${response.status} — ${errText}`);
    }

    const aiResponse = await response.json();
    const rawContent = aiResponse.choices?.[0]?.message?.content ?? "{}";

    let fields: Record<string, unknown> = {};
    try {
      fields = JSON.parse(rawContent);
    } catch {
      // Tenta extrair JSON do texto
      const match = rawContent.match(/\{[\s\S]*\}/);
      if (match) fields = JSON.parse(match[0]);
    }

    // Remove campos nulos ou vazios
    const cleanFields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) {
        cleanFields[k] = v;
      }
    }

    console.log(`parse-patient-anamnese: extracted ${Object.keys(cleanFields).length} fields for specialty ${specialty_id}`);

    return new Response(
      JSON.stringify({ fields: cleanFields, field_count: Object.keys(cleanFields).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("parse-patient-anamnese error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
