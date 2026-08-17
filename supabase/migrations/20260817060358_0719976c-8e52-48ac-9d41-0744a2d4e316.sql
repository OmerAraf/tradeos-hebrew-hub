CREATE TABLE public.news_muted_symbols (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  symbol text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT news_muted_symbols_user_symbol_key UNIQUE (user_id, symbol)
);
GRANT SELECT, INSERT, DELETE ON public.news_muted_symbols TO authenticated;
GRANT ALL ON public.news_muted_symbols TO service_role;
ALTER TABLE public.news_muted_symbols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users select own muted symbols" ON public.news_muted_symbols FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own muted symbols" ON public.news_muted_symbols FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own muted symbols" ON public.news_muted_symbols FOR DELETE TO authenticated USING (auth.uid() = user_id);