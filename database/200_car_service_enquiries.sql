-- Car service enquiry submissions from telecaller UI

create table if not exists public.car_service_enquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  customer_name text not null,
  customer_phone_raw text,
  customer_phone_norm text not null,
  car_model text,
  remark text,
  leadtag text not null default 'DL-Service',
  source_note text not null default 'Lead Source: delhi_service',
  external_status int,
  external_response jsonb,
  external_error text,
  external_request jsonb
);

alter table public.car_service_enquiries enable row level security;

drop policy if exists "telecaller_select_own_enquiries" on public.car_service_enquiries;
create policy "telecaller_select_own_enquiries"
on public.car_service_enquiries
for select
to authenticated
using (created_by = auth.uid());

drop policy if exists "telecaller_insert_own_enquiries" on public.car_service_enquiries;
create policy "telecaller_insert_own_enquiries"
on public.car_service_enquiries
for insert
to authenticated
with check (created_by = auth.uid());
