
-- Table: body_composition_sessions
CREATE TABLE public.body_composition_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Core metrics
  weight_kg NUMERIC,
  bmi NUMERIC,
  skeletal_muscle_kg NUMERIC,
  body_fat_kg NUMERIC,
  body_fat_pct NUMERIC,
  visceral_fat_level NUMERIC,
  total_body_water_l NUMERIC,
  ecw_tbw_ratio NUMERIC,
  bmr_kcal NUMERIC,
  
  -- Anthropometric (optional)
  waist_cm NUMERIC,
  hip_cm NUMERIC,
  waist_hip_ratio NUMERIC,
  
  -- Device / source
  device_model TEXT,
  source_type TEXT NOT NULL DEFAULT 'manual',
  
  -- Free notes
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.body_composition_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own body composition sessions"
ON public.body_composition_sessions
FOR ALL
TO authenticated
USING (practitioner_id = auth.uid())
WITH CHECK (practitioner_id = auth.uid());

-- updated_at trigger
CREATE TRIGGER update_body_composition_updated_at
  BEFORE UPDATE ON public.body_composition_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
