
-- Table for imaging reports (ultrasound, densitometry, MRI, etc.)
CREATE TABLE public.imaging_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  exam_type text NOT NULL,           -- e.g. 'ultrassom_tireoide', 'densitometria', 'ressonancia'
  exam_region text,                  -- e.g. 'tireoide', 'coluna lombar', 'abdome'
  findings text,                     -- main findings from the report
  conclusion text,                   -- radiologist conclusion
  incidental_findings text,          -- incidental findings
  measurements jsonb DEFAULT '{}',   -- structured measurements (e.g. nodule sizes)
  classifications text,              -- e.g. TI-RADS, BI-RADS, T-score
  source_lab text,                   -- lab/clinic that performed the exam
  notes text,                        -- practitioner notes
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.imaging_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own imaging reports"
  ON public.imaging_reports
  FOR ALL
  TO authenticated
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());
