CREATE TABLE public.virtual_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  identity_prompt TEXT NOT NULL DEFAULT '',
  seed BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','ready','failed')),
  error TEXT,
  headshot_path TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.virtual_models TO authenticated;
GRANT ALL ON public.virtual_models TO service_role;
ALTER TABLE public.virtual_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own virtual models" ON public.virtual_models FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX virtual_models_user_created_idx ON public.virtual_models (user_id, created_at DESC);
CREATE TRIGGER virtual_models_set_updated_at BEFORE UPDATE ON public.virtual_models FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image','video','audio')),
  model TEXT NOT NULL,
  prompt TEXT NOT NULL DEFAULT '',
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','running','completed','failed')),
  error TEXT,
  storage_path TEXT,
  thumb_path TEXT,
  virtual_model_id UUID REFERENCES public.virtual_models(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generations TO authenticated;
GRANT ALL ON public.generations TO service_role;
ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own generations" ON public.generations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX generations_user_created_idx ON public.generations (user_id, created_at DESC);
CREATE TRIGGER generations_set_updated_at BEFORE UPDATE ON public.generations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();