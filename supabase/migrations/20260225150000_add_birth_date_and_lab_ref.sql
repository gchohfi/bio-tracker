-- Migration: adicionar birth_date em patients e campos de referência do laboratório em lab_results
--
-- 1. birth_date em patients
--    Permite calcular a idade do paciente para contextualizar faixas funcionais por faixa etária.
--    Campo opcional (nullable) para não quebrar registros existentes.
--
-- 2. lab_ref_* em lab_results
--    Armazenam a faixa de referência impressa no laudo (já contextualizada pelo laboratório
--    para o sexo e idade do paciente), permitindo comparação com a faixa funcional do LabTrack.

-- ── patients ──────────────────────────────────────────────────────────────────
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS birth_date DATE;

-- ── lab_results ───────────────────────────────────────────────────────────────
ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS lab_ref_min  NUMERIC,
  ADD COLUMN IF NOT EXISTS lab_ref_max  NUMERIC,
  ADD COLUMN IF NOT EXISTS lab_ref_text TEXT;

-- Índice para facilitar consultas de marcadores fora da faixa do laboratório
CREATE INDEX IF NOT EXISTS idx_lab_results_ref
  ON public.lab_results (marker_id, lab_ref_min, lab_ref_max)
  WHERE lab_ref_min IS NOT NULL OR lab_ref_max IS NOT NULL;
