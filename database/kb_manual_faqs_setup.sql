-- Manual FAQs for KB (admin curated)
-- Purpose:
-- - Store verified Q/A pairs from kb_question_events triage
-- - Ingest via kb_sources table-source into kb_documents/kb_chunks
--
-- Run in Supabase SQL Editor AFTER:
-- - database/kb_vector_setup.sql
-- - database/kb_vector_rls_lockdown.sql

create extension if not exists pgcrypto;

create table if not exists public.kb_manual_faqs (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text not null,
  is_active boolean not null default true,
  source_event_id uuid, -- optional link to kb_question_events.id
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(question)
);

-- Only expose active rows to the ingest function (simple filtering).
create or replace view public.kb_manual_faqs_active as
select
  id,
  question,
  answer
from public.kb_manual_faqs
where is_active = true;

-- Lock down (service_role only)
alter table public.kb_manual_faqs enable row level security;

revoke all on table public.kb_manual_faqs from anon, authenticated;
revoke all on table public.kb_manual_faqs_active from anon, authenticated;

grant select, insert, update, delete on table public.kb_manual_faqs to service_role;
grant select on table public.kb_manual_faqs_active to service_role;

drop policy if exists "service_role_manage_kb_manual_faqs" on public.kb_manual_faqs;
create policy "service_role_manage_kb_manual_faqs"
on public.kb_manual_faqs
for all
to service_role
using (true)
with check (true);

-- Ensure kb_sources entry exists for this view
insert into public.kb_sources (source_type, source_key, title, config, is_active, updated_at)
values (
  'table',
  'table:kb_manual_faqs_active',
  'Manual FAQs (Admin curated)',
  jsonb_build_object(
    'table', 'kb_manual_faqs_active',
    'id_column', 'id',
    'title_column', 'question',
    'content_column', 'answer',
    'doc_type', 'faq',
    'language', 'mixed',
    'limit', 1000
  ),
  true,
  now()
)
on conflict (source_key) do update
set
  title = excluded.title,
  config = excluded.config,
  is_active = excluded.is_active,
  updated_at = now();


