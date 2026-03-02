
CREATE TABLE public.ai_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  specialty_id text,
  mode text,
  input_tokens int,
  output_tokens int,
  finish_reason text,
  success boolean DEFAULT true,
  error_type text,
  duration_ms int,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners view own logs"
  ON public.ai_call_logs
  FOR SELECT
  TO authenticated
  USING (practitioner_id = auth.uid());

CREATE POLICY "Practitioners insert own logs"
  ON public.ai_call_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (practitioner_id = auth.uid());
