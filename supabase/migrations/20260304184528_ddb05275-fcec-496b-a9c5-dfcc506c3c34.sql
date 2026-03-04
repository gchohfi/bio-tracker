ALTER TABLE public.lab_sessions 
  ADD COLUMN quality_score numeric DEFAULT NULL,
  ADD COLUMN extraction_issues jsonb DEFAULT '[]'::jsonb;