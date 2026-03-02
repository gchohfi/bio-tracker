-- Migration: Adicionar colunas dos 3 documentos à tabela patient_analyses
-- Documento 1: Análise Técnica Completa (faixas funcionais, cálculos mostrados)
-- Documento 2: Plano de Condutas (estilo de vida, suplementação, injetáveis)
-- Documento 3: Prescrição em Tabela (substância, dose, via, frequência, duração, CI, monitorização)

ALTER TABLE public.patient_analyses
  ADD COLUMN IF NOT EXISTS technical_analysis TEXT,
  ADD COLUMN IF NOT EXISTS patient_plan TEXT,
  ADD COLUMN IF NOT EXISTS prescription_table JSONB DEFAULT '[]'::jsonb;

-- Comentários explicativos
COMMENT ON COLUMN public.patient_analyses.technical_analysis IS 'Documento 1: Análise técnica completa com faixas funcionais e cálculos mostrados';
COMMENT ON COLUMN public.patient_analyses.patient_plan IS 'Documento 2: Plano de condutas resumido para o paciente';
COMMENT ON COLUMN public.patient_analyses.prescription_table IS 'Documento 3: Prescrição detalhada em formato tabular (array de objetos com substancia, dose, via, frequencia, duracao, condicoes_ci, monitorizacao)';
