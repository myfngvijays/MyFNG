-- Fix: notifications inserts fail because code writes related_user_id / related_user_name
-- Adds the missing columns to match current app insert payloads.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_user_id uuid REFERENCES public.users_login(id) ON DELETE SET NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_user_name text;

-- Optional indexes (safe to keep; helps filtering/debugging)
CREATE INDEX IF NOT EXISTS idx_notifications_related_user_id ON public.notifications(related_user_id);


