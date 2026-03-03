-- Migration: Tabela de anamneses por especialidade
-- Cada paciente pode ter uma anamnese por especialidade (cardiologia, nutrologia, endocrinologia, medicina_funcional)
-- Os campos comuns ficam na raiz; os específicos por especialidade ficam em JSONB

CREATE TABLE IF NOT EXISTS public.patient_anamneses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  specialty_id TEXT NOT NULL, -- 'cardiologia' | 'nutrologia' | 'endocrinologia' | 'medicina_funcional'

  -- ══════════════════════════════════════════════════════════════
  -- SEÇÃO 1: DADOS GERAIS (comuns a todas as especialidades)
  -- ══════════════════════════════════════════════════════════════
  -- Queixas e objetivos
  expectativa_consulta TEXT,
  queixas_principais TEXT,
  objetivos TEXT,

  -- Histórico de saúde
  nota_saude INTEGER CHECK (nota_saude BETWEEN 0 AND 10),
  o_que_melhoraria TEXT,
  fase_melhor TEXT,
  evento_marcante TEXT,
  comorbidades TEXT,
  peso_altura TEXT,
  suplementacao TEXT,
  medicamentos_continuos TEXT,
  tipo_sanguineo TEXT,

  -- Avaliação tegumentar
  estado_pele TEXT,
  estado_cabelos TEXT,
  estado_unhas TEXT,
  memoria_concentracao TEXT,
  imunidade TEXT,
  consumo_cafe TEXT,

  -- Hábitos
  habitos TEXT[], -- ['etilismo', 'tabagismo', 'adiccao']
  sintomas_atuais TEXT[], -- lista de sintomas marcados no checklist

  -- ══════════════════════════════════════════════════════════════
  -- SEÇÃO 2: HÁBITO INTESTINAL
  -- ══════════════════════════════════════════════════════════════
  evacuacoes_por_dia TEXT,
  tipo_fezes TEXT, -- Bristol 1-7
  uso_antibiotico_2anos TEXT,
  estufamento_gases TEXT,
  litros_agua_dia TEXT,

  -- ══════════════════════════════════════════════════════════════
  -- SEÇÃO 3: SONO E ESTRESSE
  -- ══════════════════════════════════════════════════════════════
  dorme_bem TEXT,
  horario_sono TEXT,
  acorda_cansado TEXT,
  dificuldade_dormir TEXT,
  nivel_estresse INTEGER CHECK (nivel_estresse BETWEEN 0 AND 10),
  faz_terapia TEXT,
  atividade_relaxamento TEXT,
  hobbies TEXT,

  -- ══════════════════════════════════════════════════════════════
  -- SEÇÃO 4: ATIVIDADE FÍSICA
  -- ══════════════════════════════════════════════════════════════
  atividade_fisica TEXT,

  -- ══════════════════════════════════════════════════════════════
  -- SEÇÃO 5: ALIMENTAÇÃO
  -- ══════════════════════════════════════════════════════════════
  recordatorio_alimentar TEXT,
  intolerancias_alimentares TEXT,
  episodios_compulsao TEXT,
  culpa_apos_comer TEXT,
  preferencias_alimentares TEXT,
  aversoes_alimentares TEXT,

  -- ══════════════════════════════════════════════════════════════
  -- SEÇÃO 6: CICLO MENSTRUAL (apenas para pacientes do sexo F)
  -- ══════════════════════════════════════════════════════════════
  ciclo_regular TEXT,
  metodo_contraceptivo TEXT,
  deseja_engravidar TEXT,
  tem_tpm TEXT,

  -- ══════════════════════════════════════════════════════════════
  -- SEÇÃO 7: CAMPOS ESPECÍFICOS POR ESPECIALIDADE (JSONB)
  -- ══════════════════════════════════════════════════════════════
  -- Cardiologia: pressao_arterial, historico_familiar_cv, sintomas_cardiacos, tabagismo_anos, etc.
  -- Nutrologia: circunferencia_abdominal, relacao_emocional_comida, dietas_anteriores, etc.
  -- Endocrinologia: sintomas_tireoide, sintomas_adrenal, historico_hormonal, etc.
  -- Medicina Funcional: timeline_eventos, exposicoes_ambientais, 7_sistemas, etc.
  specialty_data JSONB DEFAULT '{}'::jsonb,

  -- ══════════════════════════════════════════════════════════════
  -- METADADOS
  -- ══════════════════════════════════════════════════════════════
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Garante uma anamnese por paciente por especialidade
  UNIQUE (patient_id, specialty_id)
);

-- RLS: médico só vê anamneses dos seus próprios pacientes
ALTER TABLE public.patient_anamneses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners can manage their patient anamneses"
  ON public.patient_anamneses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.patients
      WHERE patients.id = patient_anamneses.patient_id
        AND patients.practitioner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patients
      WHERE patients.id = patient_anamneses.patient_id
        AND patients.practitioner_id = auth.uid()
    )
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_patient_anamneses_patient_id ON public.patient_anamneses(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_anamneses_specialty ON public.patient_anamneses(patient_id, specialty_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_patient_anamneses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_patient_anamneses_updated_at
  BEFORE UPDATE ON public.patient_anamneses
  FOR EACH ROW EXECUTE FUNCTION update_patient_anamneses_updated_at();
