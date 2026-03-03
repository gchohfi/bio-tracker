-- Simplifica a tabela patient_anamneses para usar apenas texto livre
-- Remove a versão anterior com 50+ campos e substitui por estrutura simples

DROP TABLE IF EXISTS public.patient_anamneses CASCADE;

CREATE TABLE public.patient_anamneses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  specialty_id TEXT NOT NULL,
  anamnese_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, specialty_id)
);

ALTER TABLE public.patient_anamneses ENABLE ROW LEVEL SECURITY;

CREATE POLICY anamneses_policy ON public.patient_anamneses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.patients
      WHERE patients.id = patient_anamneses.patient_id
        AND patients.practitioner_id = auth.uid()
    )
  );
