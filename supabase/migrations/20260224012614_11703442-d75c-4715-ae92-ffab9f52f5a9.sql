-- Add text_value column for qualitative results (urine, stool, FAN, etc.)
ALTER TABLE public.lab_results ADD COLUMN text_value TEXT;

-- Add comment for clarity
COMMENT ON COLUMN public.lab_results.text_value IS 'Qualitative/text result for non-numeric markers like FAN, Urina Tipo 1, Coprológico';