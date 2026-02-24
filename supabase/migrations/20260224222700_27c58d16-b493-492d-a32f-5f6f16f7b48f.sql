
-- Drop restrictive policies and recreate as permissive

-- lab_sessions
DROP POLICY IF EXISTS "Practitioners manage own sessions" ON public.lab_sessions;
CREATE POLICY "Practitioners manage own sessions"
ON public.lab_sessions
FOR ALL
USING (EXISTS (
  SELECT 1 FROM patients
  WHERE patients.id = lab_sessions.patient_id
    AND patients.practitioner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM patients
  WHERE patients.id = lab_sessions.patient_id
    AND patients.practitioner_id = auth.uid()
));

-- lab_results
DROP POLICY IF EXISTS "Practitioners manage own results" ON public.lab_results;
CREATE POLICY "Practitioners manage own results"
ON public.lab_results
FOR ALL
USING (EXISTS (
  SELECT 1 FROM lab_sessions
  JOIN patients ON lab_sessions.patient_id = patients.id
  WHERE lab_sessions.id = lab_results.session_id
    AND patients.practitioner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM lab_sessions
  JOIN patients ON lab_sessions.patient_id = patients.id
  WHERE lab_sessions.id = lab_results.session_id
    AND patients.practitioner_id = auth.uid()
));

-- patients
DROP POLICY IF EXISTS "Practitioners manage own patients" ON public.patients;
CREATE POLICY "Practitioners manage own patients"
ON public.patients
FOR ALL
USING (auth.uid() = practitioner_id)
WITH CHECK (auth.uid() = practitioner_id);
