-- Add pickup observation fields to public.service_leads
-- Used by Pickup Boy screen: "Observation" button beside "Arrived at Workshop"
--
-- Run in Supabase SQL editor (or psql) on the target project.
-- After running, reload PostgREST schema cache (SQL at bottom).

alter table public.service_leads
  add column if not exists pickup_observation text,
  add column if not exists pickup_observation_updated_at timestamptz,
  add column if not exists pickup_observation_by uuid;

comment on column public.service_leads.pickup_observation is
  'Pickup boy observation/notes captured during pickup or at workshop arrival.';

comment on column public.service_leads.pickup_observation_updated_at is
  'When pickup_observation was last updated.';

comment on column public.service_leads.pickup_observation_by is
  'users_login.id of the user who last updated pickup_observation.';

-- Optional FK (add only if users_login is the correct user table in your schema)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'service_leads_pickup_observation_by_fkey'
  ) then
    alter table public.service_leads
      add constraint service_leads_pickup_observation_by_fkey
      foreign key (pickup_observation_by) references public.users_login(id)
      on delete set null;
  end if;
end$$;

-- Reload PostgREST schema cache (Supabase API uses PostgREST)
notify pgrst, 'reload schema';


