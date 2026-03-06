
-- Add missing columns to lab_historical_results for full normalized + raw audit trail
ALTER TABLE public.lab_historical_results
  ADD COLUMN IF NOT EXISTS marker_name text,
  ADD COLUMN IF NOT EXISTS raw_value numeric,
  ADD COLUMN IF NOT EXISTS raw_unit text,
  ADD COLUMN IF NOT EXISTS raw_text_value text,
  ADD COLUMN IF NOT EXISTS raw_ref_text text,
  ADD COLUMN IF NOT EXISTS conversion_applied boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS conversion_reason text,
  ADD COLUMN IF NOT EXISTS source_lab text,
  ADD COLUMN IF NOT EXISTS source_document text;

-- Unique constraint for idempotent upsert (same marker + date + source + raw_value in same session)
CREATE UNIQUE INDEX IF NOT EXISTS idx_hist_dedup
  ON public.lab_historical_results (session_id, marker_id, result_date, source_type, COALESCE(source_lab, ''), COALESCE(source_document, ''), COALESCE(raw_value, -999999));
