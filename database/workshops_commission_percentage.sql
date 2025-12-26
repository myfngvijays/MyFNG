-- Add commission_percentage to public.workshops
-- Fixes: "Could not find the 'commission_percentage' column of 'workshops' in the schema cache"
--
-- Run this in Supabase SQL editor (or psql) on the target project.
-- After running, also reload PostgREST schema cache (SQL included at bottom).

alter table public.workshops
  add column if not exists commission_percentage numeric(5,2);

comment on column public.workshops.commission_percentage is
  'Workshop commission percentage for payouts (0..100). Null means use system default.';

-- Optional safety constraint (won’t fail if already present)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'workshops_commission_percentage_range'
  ) then
    alter table public.workshops
      add constraint workshops_commission_percentage_range
      check (commission_percentage is null or (commission_percentage >= 0 and commission_percentage <= 100));
  end if;
end$$;

-- Reload PostgREST schema cache (Supabase API uses PostgREST)
-- If you still see the schema cache error after adding the column, run this once:
notify pgrst, 'reload schema';


