
CREATE TABLE public.tutor_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  problem_text TEXT NOT NULL,
  problem_image_url TEXT,
  domain TEXT,
  difficulty TEXT,
  plan JSONB NOT NULL DEFAULT '[]'::jsonb,
  step_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_step_index INT NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'direct',
  final_answer TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tutor_sessions TO authenticated;
GRANT ALL ON public.tutor_sessions TO service_role;

ALTER TABLE public.tutor_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sessions" ON public.tutor_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tutor_sessions_updated_at
  BEFORE UPDATE ON public.tutor_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX tutor_sessions_user_created ON public.tutor_sessions(user_id, created_at DESC);
