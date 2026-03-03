-- Tabela de notas rápidas do médico por paciente e especialidade
-- Permite que o médico registre observações clínicas rápidas antes/durante a consulta
-- Estas notas são injetadas no prompt da análise IA junto com a anamnese

CREATE TABLE IF NOT EXISTS public.doctor_specialty_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  specialty_id TEXT NOT NULL DEFAULT 'medicina_funcional',
  
  -- Observações clínicas rápidas (preenchidas pelo médico durante/antes da consulta)
  impressao_clinica TEXT,           -- Impressão clínica geral do médico
  hipoteses_diagnosticas TEXT,      -- Hipóteses diagnósticas
  foco_consulta TEXT,               -- Foco principal desta consulta
  observacoes_exames TEXT,          -- Observações sobre os exames laboratoriais
  conduta_planejada TEXT,           -- Conduta planejada pelo médico
  pontos_atencao TEXT,              -- Pontos de atenção / alertas
  medicamentos_prescritos TEXT,     -- Medicamentos já prescritos anteriormente
  resposta_tratamento TEXT,         -- Como o paciente respondeu ao tratamento anterior
  proximos_passos TEXT,             -- Próximos passos / retorno planejado
  notas_livres TEXT,                -- Campo livre para anotações diversas
  
  -- Checklist rápido (campos booleanos para avaliação rápida)
  exames_em_dia BOOLEAN DEFAULT false,
  adesao_tratamento TEXT,           -- 'boa' | 'regular' | 'ruim'
  motivacao_paciente TEXT,          -- 'alta' | 'media' | 'baixa'
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(patient_id, specialty_id)
);

-- RLS
ALTER TABLE public.doctor_specialty_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own doctor notes"
  ON public.doctor_specialty_notes
  FOR ALL
  USING (
    patient_id IN (
      SELECT id FROM public.patients WHERE user_id = auth.uid()
    )
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_doctor_notes_patient ON public.doctor_specialty_notes(patient_id);
CREATE INDEX IF NOT EXISTS idx_doctor_notes_specialty ON public.doctor_specialty_notes(specialty_id);
