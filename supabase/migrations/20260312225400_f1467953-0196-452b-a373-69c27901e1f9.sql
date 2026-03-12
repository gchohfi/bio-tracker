
-- Add practitioner_id to patient_analyses (nullable for backwards compat)
ALTER TABLE public.patient_analyses
  ADD COLUMN IF NOT EXISTS practitioner_id uuid;

-- Add source_context JSONB to track what data was used to generate the analysis
ALTER TABLE public.patient_analyses
  ADD COLUMN IF NOT EXISTS source_context jsonb DEFAULT NULL;

-- Add generated_at timestamp (distinct from created_at which is DB insert time)
ALTER TABLE public.patient_analyses
  ADD COLUMN IF NOT EXISTS generated_at timestamptz DEFAULT now();

-- Backfill practitioner_id from patients table for existing rows
UPDATE public.patient_analyses pa
SET practitioner_id = p.practitioner_id
FROM public.patients p
WHERE pa.patient_id = p.id
  AND pa.practitioner_id IS NULL;
