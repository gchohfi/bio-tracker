ALTER TABLE public.patient_analyses
  ADD COLUMN IF NOT EXISTS technical_analysis TEXT,
  ADD COLUMN IF NOT EXISTS patient_plan TEXT,
  ADD COLUMN IF NOT EXISTS prescription_table JSONB DEFAULT '[]'::jsonb;