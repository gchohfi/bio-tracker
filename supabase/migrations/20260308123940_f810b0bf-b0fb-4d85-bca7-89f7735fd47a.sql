ALTER TABLE public.imaging_reports
  ADD COLUMN IF NOT EXISTS raw_text text,
  ADD COLUMN IF NOT EXISTS original_file_name text;