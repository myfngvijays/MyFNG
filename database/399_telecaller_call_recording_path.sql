-- Folder the telecaller picks on the phone for call recordings (SAF URI + label).
ALTER TABLE public.users_login
  ADD COLUMN IF NOT EXISTS call_recording_path text;
