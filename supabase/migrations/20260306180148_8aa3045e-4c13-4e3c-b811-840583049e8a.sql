CREATE TABLE public.lab_historical_results (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.lab_sessions(id) ON DELETE CASCADE,
  marker_id text NOT NULL,
  result_date date NOT NULL,
  value numeric,
  text_value text,
  unit text,
  flag text,
  reference_text text,
  source_type text NOT NULL DEFAULT 'evolution_page',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_historical_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own historical results"
ON public.lab_historical_results
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM lab_sessions
    JOIN patients ON lab_sessions.patient_id = patients.id
    WHERE lab_sessions.id = lab_historical_results.session_id
    AND patients.practitioner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM lab_sessions
    JOIN patients ON lab_sessions.patient_id = patients.id
    WHERE lab_sessions.id = lab_historical_results.session_id
    AND patients.practitioner_id = auth.uid()
  )
);

CREATE INDEX idx_lab_historical_results_session ON public.lab_historical_results(session_id);
CREATE INDEX idx_lab_historical_results_marker_date ON public.lab_historical_results(marker_id, result_date);