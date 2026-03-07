ALTER TABLE public.analysis_reviews
  ADD COLUMN IF NOT EXISTS analysis_v2_hash text,
  ADD COLUMN IF NOT EXISTS schema_version integer NOT NULL DEFAULT 1;