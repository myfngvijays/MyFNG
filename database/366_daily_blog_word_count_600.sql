-- 366_daily_blog_word_count_600.sql
-- Daily auto-post target is 600 words.

ALTER TABLE public.daily_blog_settings
  ALTER COLUMN word_count SET DEFAULT 600;

UPDATE public.daily_blog_settings
SET word_count = 600, updated_at = NOW()
WHERE id = 1 AND word_count = 900;
