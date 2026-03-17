
-- Add optional encounter_id to lab_sessions
ALTER TABLE public.lab_sessions
ADD COLUMN encounter_id uuid REFERENCES public.clinical_encounters(id) ON DELETE SET NULL;

-- Add optional encounter_id to body_composition_sessions
ALTER TABLE public.body_composition_sessions
ADD COLUMN encounter_id uuid REFERENCES public.clinical_encounters(id) ON DELETE SET NULL;

-- Add optional encounter_id to imaging_reports
ALTER TABLE public.imaging_reports
ADD COLUMN encounter_id uuid REFERENCES public.clinical_encounters(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX idx_lab_sessions_encounter_id ON public.lab_sessions(encounter_id);
CREATE INDEX idx_body_composition_sessions_encounter_id ON public.body_composition_sessions(encounter_id);
CREATE INDEX idx_imaging_reports_encounter_id ON public.imaging_reports(encounter_id);
