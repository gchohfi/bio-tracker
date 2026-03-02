CREATE TABLE IF NOT EXISTS public.analysis_prompts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  specialty_id TEXT NOT NULL UNIQUE,
  specialty_name TEXT NOT NULL,
  specialty_icon TEXT DEFAULT '🔬',
  description TEXT,
  system_prompt TEXT NOT NULL,
  has_protocols BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  version TEXT DEFAULT '1.0',
  author TEXT DEFAULT 'sistema',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.analysis_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read prompts" ON public.analysis_prompts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can update prompts" ON public.analysis_prompts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert prompts" ON public.analysis_prompts FOR INSERT TO authenticated WITH CHECK (true);