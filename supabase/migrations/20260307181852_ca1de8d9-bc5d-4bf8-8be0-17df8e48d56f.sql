
-- Encounter status enum
CREATE TYPE public.encounter_status AS ENUM ('draft', 'finalized');

-- Clinical encounters (one per visit/date)
CREATE TABLE public.clinical_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL,
  specialty_id text NOT NULL DEFAULT 'medicina_funcional',
  encounter_date date NOT NULL DEFAULT CURRENT_DATE,
  status encounter_status NOT NULL DEFAULT 'draft',
  chief_complaint text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_encounters_patient_date ON public.clinical_encounters(patient_id, encounter_date DESC);

ALTER TABLE public.clinical_encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own encounters"
  ON public.clinical_encounters FOR ALL TO authenticated
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());

-- SOAP evolution notes (one per encounter)
CREATE TABLE public.clinical_evolution_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.clinical_encounters(id) ON DELETE CASCADE,
  subjective text,
  objective text,
  assessment text,
  plan text,
  exams_requested text,
  medications text,
  free_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clinical_evolution_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own evolution notes"
  ON public.clinical_evolution_notes FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clinical_encounters e
    WHERE e.id = clinical_evolution_notes.encounter_id
    AND e.practitioner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.clinical_encounters e
    WHERE e.id = clinical_evolution_notes.encounter_id
    AND e.practitioner_id = auth.uid()
  ));

-- Auto-update updated_at
CREATE TRIGGER update_encounters_updated_at
  BEFORE UPDATE ON public.clinical_encounters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_evolution_notes_updated_at
  BEFORE UPDATE ON public.clinical_evolution_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
