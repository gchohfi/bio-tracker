-- Add patient profile/objectives fields to patients table
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS objectives TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS activity_level TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sport_modality TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS main_complaints TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS restrictions TEXT DEFAULT NULL;
