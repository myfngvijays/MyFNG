-- Track each successful login for profile "login history"
CREATE TABLE IF NOT EXISTS public.user_login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users_login(id) ON DELETE CASCADE,
  logged_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  platform TEXT NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web', 'mobile', 'unknown')),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_login_history_user_time
  ON public.user_login_history (user_id, logged_in_at DESC);

COMMENT ON TABLE public.user_login_history IS
  'One row per successful login; shown on user profile as login history.';

ALTER TABLE public.user_login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_login_history_select_own ON public.user_login_history;
CREATE POLICY user_login_history_select_own ON public.user_login_history
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM public.users_login
      WHERE id = auth.uid()
         OR email = auth.jwt() ->> 'email'
    )
  );

DROP POLICY IF EXISTS user_login_history_insert_own ON public.user_login_history;
CREATE POLICY user_login_history_insert_own ON public.user_login_history
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM public.users_login
      WHERE id = auth.uid()
         OR email = auth.jwt() ->> 'email'
    )
  );

GRANT SELECT, INSERT ON public.user_login_history TO authenticated;
GRANT ALL ON public.user_login_history TO service_role;
