-- Segment title extras shown on the segments list: description and how many filters it used.
-- Safe to re-run.

ALTER TABLE public.wa_bulk_segments
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS condition_count int NOT NULL DEFAULT 1;
