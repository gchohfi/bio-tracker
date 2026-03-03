-- Add specialty_id to lab_sessions so each session knows which specialty it belongs to
-- This allows the system to determine whether to use functional or lab reference ranges

ALTER TABLE public.lab_sessions
  ADD COLUMN IF NOT EXISTS specialty_id TEXT DEFAULT 'medicina_funcional';

-- Update existing sessions to have a default specialty
UPDATE public.lab_sessions
  SET specialty_id = 'medicina_funcional'
  WHERE specialty_id IS NULL;
