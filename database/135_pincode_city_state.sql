-- =====================================================
-- Migration: Pincode mapping table
-- Purpose: Store pincode -> district/state mapping (importable)
-- =====================================================

create table if not exists public.pincode_city_state (
  uuid uuid not null default gen_random_uuid(),
  pincode character varying(10) null,
  district text null,
  state text null,
  constraint pincode_city_state_pkey primary key (uuid)
) tablespace pg_default;

create unique index if not exists pincode_city_state_pincode_uniq
on public.pincode_city_state using btree (pincode) tablespace pg_default
where
  (
    (pincode is not null)
    and (btrim((pincode)::text) <> ''::text)
  );

-- =====================================================
-- RLS Policies
-- =====================================================
alter table public.pincode_city_state enable row level security;

drop policy if exists "Admins can manage pincode_city_state" on public.pincode_city_state;
create policy "Admins can manage pincode_city_state" on public.pincode_city_state
for all
using (
  exists (
    select 1
    from public.users_login ul
    join public.roles r on ul.role_id = r.id
    where
      (
        (coalesce(auth.jwt() ->> 'email', '') <> '' and lower(ul.email) = lower(auth.jwt() ->> 'email'))
        or (coalesce(auth.jwt() ->> 'phone', '') <> '' and ul.phone = (auth.jwt() ->> 'phone'))
        or (ul.id = auth.uid())
      )
      and (r.role_code in ('SUPER_ADMIN', 'SUB_ADMIN'))
  )
);

do $$
begin
  raise notice '✅ pincode_city_state table created with RLS';
end $$;
