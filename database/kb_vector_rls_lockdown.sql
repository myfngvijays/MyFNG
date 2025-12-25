-- KB Vector Security Lockdown (RLS + grants)
-- Run AFTER database/kb_vector_setup.sql
-- Goal: KB tables/chunks are NOT readable by anon/authenticated clients.
-- Access is intended via service_role (server/edge function) only.

-- Enable RLS
alter table if exists public.kb_sources enable row level security;
alter table if exists public.kb_documents enable row level security;
alter table if exists public.kb_chunks enable row level security;

-- Revoke table privileges from anon/authenticated
revoke all on table public.kb_sources from anon, authenticated;
revoke all on table public.kb_documents from anon, authenticated;
revoke all on table public.kb_chunks from anon, authenticated;

-- Ensure service_role can read/write
grant select, insert, update, delete on table public.kb_sources to service_role;
grant select, insert, update, delete on table public.kb_documents to service_role;
grant select, insert, update, delete on table public.kb_chunks to service_role;

-- Drop existing policies (idempotent)
drop policy if exists "service_role_manage_kb_sources" on public.kb_sources;
drop policy if exists "service_role_manage_kb_documents" on public.kb_documents;
drop policy if exists "service_role_manage_kb_chunks" on public.kb_chunks;

-- service_role full access policies
create policy "service_role_manage_kb_sources"
on public.kb_sources
for all
to service_role
using (true)
with check (true);

create policy "service_role_manage_kb_documents"
on public.kb_documents
for all
to service_role
using (true)
with check (true);

create policy "service_role_manage_kb_chunks"
on public.kb_chunks
for all
to service_role
using (true)
with check (true);

-- Lock down RPC access too: only service_role can call kb_search
revoke all on function public.kb_search(vector, int) from public, anon, authenticated;
grant execute on function public.kb_search(vector, int) to service_role;


