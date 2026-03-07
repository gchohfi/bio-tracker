-- Create prescription status enum
CREATE TYPE public.prescription_status AS ENUM ('draft', 'finalized');

-- Create clinical_prescriptions table
CREATE TABLE public.clinical_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.clinical_encounters(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL,
  specialty_id text NOT NULL DEFAULT 'medicina_funcional',
  status prescription_status NOT NULL DEFAULT 'draft',
  prescription_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_analysis_id uuid REFERENCES public.patient_analyses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.clinical_prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own prescriptions"
  ON public.clinical_prescriptions FOR ALL
  TO authenticated
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

-- Indexes
CREATE INDEX idx_clinical_prescriptions_encounter ON public.clinical_prescriptions(encounter_id);
CREATE INDEX idx_clinical_prescriptions_patient ON public.clinical_prescriptions(patient_id);

-- Auto-update updated_at
CREATE TRIGGER update_clinical_prescriptions_updated_at
  BEFORE UPDATE ON public.clinical_prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();