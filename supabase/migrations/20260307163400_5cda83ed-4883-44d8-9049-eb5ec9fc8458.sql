
CREATE TABLE public.analysis_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.patient_analyses(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL,
  specialty_id text NOT NULL DEFAULT 'medicina_funcional',
  review_state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (analysis_id, practitioner_id)
);

ALTER TABLE public.analysis_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own reviews"
  ON public.analysis_reviews
  FOR ALL
  TO authenticated
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

CREATE TRIGGER update_analysis_reviews_updated_at
  BEFORE UPDATE ON public.analysis_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
