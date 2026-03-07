
-- Add encounter_id to patient_analyses (nullable for legacy analyses)
ALTER TABLE public.patient_analyses
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.clinical_encounters(id) ON DELETE SET NULL;

-- Add encounter_id to analysis_reviews (nullable for legacy reviews)
ALTER TABLE public.analysis_reviews
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.clinical_encounters(id) ON DELETE SET NULL;

-- Index for fast lookup by encounter
CREATE INDEX IF NOT EXISTS idx_patient_analyses_encounter_id ON public.patient_analyses(encounter_id);
CREATE INDEX IF NOT EXISTS idx_analysis_reviews_encounter_id ON public.analysis_reviews(encounter_id);
