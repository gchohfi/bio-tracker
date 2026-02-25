ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS lab_ref_min numeric,
  ADD COLUMN IF NOT EXISTS lab_ref_max numeric,
  ADD COLUMN IF NOT EXISTS lab_ref_text text;