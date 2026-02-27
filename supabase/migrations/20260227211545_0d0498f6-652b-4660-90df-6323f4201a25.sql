ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS objectives text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS activity_level text,
  ADD COLUMN IF NOT EXISTS sport_modality text,
  ADD COLUMN IF NOT EXISTS main_complaints text,
  ADD COLUMN IF NOT EXISTS restrictions text;