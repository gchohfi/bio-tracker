-- Fase B: Remove redundant encounter_id from analysis_reviews
-- The encounter is always derivable via analysis_id → patient_analyses.encounter_id
ALTER TABLE public.analysis_reviews DROP COLUMN IF EXISTS encounter_id;