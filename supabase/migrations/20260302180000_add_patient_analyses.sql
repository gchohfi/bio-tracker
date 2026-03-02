-- Migration: Tabela para armazenar análises IA geradas dentro do app
-- Permite salvar, visualizar e reutilizar análises sem exportar/importar manualmente

CREATE TABLE IF NOT EXISTS public.patient_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  specialty_id TEXT NOT NULL DEFAULT 'medicina_funcional',
  specialty_name TEXT,
  mode TEXT NOT NULL DEFAULT 'full',
  -- Campos da análise (espelham o schema JSON da edge function)
  summary TEXT,
  patterns JSONB DEFAULT '[]'::jsonb,
  trends JSONB DEFAULT '[]'::jsonb,
  suggestions JSONB DEFAULT '[]'::jsonb,
  full_text TEXT,
  protocol_recommendations JSONB DEFAULT '[]'::jsonb,
  -- Metadados
  model_used TEXT DEFAULT 'gpt-4.1-mini',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: médico só vê análises dos seus próprios pacientes
ALTER TABLE public.patient_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners can manage their patient analyses"
  ON public.patient_analyses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.patients
      WHERE patients.id = patient_analyses.patient_id
        AND patients.practitioner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patients
      WHERE patients.id = patient_analyses.patient_id
        AND patients.practitioner_id = auth.uid()
    )
  );

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_patient_analyses_patient_id ON public.patient_analyses(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_analyses_created_at ON public.patient_analyses(created_at DESC);
