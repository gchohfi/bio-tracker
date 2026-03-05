-- Patient shares table: allows practitioners to share patient access with colleagues
CREATE TABLE public.patient_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shared_with_email TEXT NOT NULL,
  shared_with_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(patient_id, shared_with_email)
);

ALTER TABLE public.patient_shares ENABLE ROW LEVEL SECURITY;

-- The patient owner can manage all shares for their patients
CREATE POLICY "Owners can manage patient shares"
  ON public.patient_shares
  FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Shared practitioners can view shares addressed to them
CREATE POLICY "Shared practitioners can view shares"
  ON public.patient_shares
  FOR SELECT
  USING (auth.uid() = shared_with_id);

-- Allow shared practitioners (by user ID) to view patients shared with them
CREATE POLICY "Shared practitioners can view patients"
  ON public.patients
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_shares
      WHERE patient_shares.patient_id = patients.id
        AND patient_shares.shared_with_id = auth.uid()
    )
  );

-- Allow shared practitioners to view lab_sessions of patients shared with them
CREATE POLICY "Shared practitioners can view sessions"
  ON public.lab_sessions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_shares
      JOIN public.patients ON patients.id = lab_sessions.patient_id
      WHERE patient_shares.patient_id = lab_sessions.patient_id
        AND patient_shares.shared_with_id = auth.uid()
    )
  );

-- Allow shared practitioners to view lab_results of patients shared with them
CREATE POLICY "Shared practitioners can view results"
  ON public.lab_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.lab_sessions
      JOIN public.patient_shares ON patient_shares.patient_id = lab_sessions.patient_id
      WHERE lab_sessions.id = lab_results.session_id
        AND patient_shares.shared_with_id = auth.uid()
    )
  );

-- Trigger function: when a new share is inserted, immediately resolve shared_with_id
-- by looking up auth.users for a matching email
CREATE OR REPLACE FUNCTION public.resolve_share_recipient_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT id INTO NEW.shared_with_id
  FROM auth.users
  WHERE email = NEW.shared_with_email
  LIMIT 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_patient_share_insert
  BEFORE INSERT ON public.patient_shares
  FOR EACH ROW EXECUTE FUNCTION public.resolve_share_recipient_on_insert();

-- Trigger function: when a new user signs up, resolve any pending shares for their email
CREATE OR REPLACE FUNCTION public.resolve_pending_shares_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.patient_shares
  SET shared_with_id = NEW.id
  WHERE shared_with_email = NEW.email
    AND shared_with_id IS NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_resolve_shares
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.resolve_pending_shares_on_signup();
