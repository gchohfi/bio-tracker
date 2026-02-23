
-- Profiles table (auto-created on signup)
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Patients table
CREATE TABLE public.patients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practitioner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('M', 'F')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own patients" ON public.patients FOR ALL USING (auth.uid() = practitioner_id) WITH CHECK (auth.uid() = practitioner_id);

-- Lab sessions table
CREATE TABLE public.lab_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own sessions" ON public.lab_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.patients WHERE patients.id = lab_sessions.patient_id AND patients.practitioner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.patients WHERE patients.id = lab_sessions.patient_id AND patients.practitioner_id = auth.uid()));

-- Lab results table
CREATE TABLE public.lab_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.lab_sessions(id) ON DELETE CASCADE,
  marker_id TEXT NOT NULL,
  value NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own results" ON public.lab_results FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.lab_sessions
    JOIN public.patients ON lab_sessions.patient_id = patients.id
    WHERE lab_sessions.id = lab_results.session_id AND patients.practitioner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.lab_sessions
    JOIN public.patients ON lab_sessions.patient_id = patients.id
    WHERE lab_sessions.id = lab_results.session_id AND patients.practitioner_id = auth.uid()
  ));

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
