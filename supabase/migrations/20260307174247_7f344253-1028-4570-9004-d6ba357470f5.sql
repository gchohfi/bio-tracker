
CREATE TABLE public.review_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.patient_analyses(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL,
  analysis_v2_hash text,
  schema_version integer NOT NULL DEFAULT 1,
  review_state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_reason text NOT NULL DEFAULT 'auto_save',
  saved_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_snapshots_analysis ON public.review_snapshots(analysis_id, practitioner_id, saved_at DESC);

ALTER TABLE public.review_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own snapshots"
  ON public.review_snapshots
  FOR ALL
  TO authenticated
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());
