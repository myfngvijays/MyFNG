-- Chatbot logging + human-in-the-loop learning tables
-- Run in Supabase SQL Editor
--
-- Notes:
-- - These tables should NOT be readable by anon/authenticated clients.
-- - Writes are intended from server/service-role only.

-- Needed for gen_random_uuid()
create extension if not exists pgcrypto;

-- 1) Conversation header
create table if not exists public.chatbot_conversations (
  id uuid primary key,
  customer_phone text,
  customer_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists chatbot_conversations_updated_at_idx on public.chatbot_conversations(updated_at desc);

-- 2) Conversation messages
create table if not exists public.chatbot_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chatbot_conversations(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  message_text text not null,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists chatbot_messages_conversation_id_idx on public.chatbot_messages(conversation_id, created_at asc);

-- 3) Unknown question capture for improvement loop
create table if not exists public.kb_question_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid,
  source text not null default 'chatbot',
  user_message text not null,
  assistant_message text,
  intent jsonb,
  context jsonb,
  status text not null default 'new' check (status in ('new','triaged','answered','added_to_kb','ignored')),
  triage_notes text,
  resolved_answer text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists kb_question_events_status_idx on public.kb_question_events(status, created_at desc);
create index if not exists kb_question_events_created_at_idx on public.kb_question_events(created_at desc);

-- 4) Lockdown (RLS + grants)
alter table public.chatbot_conversations enable row level security;
alter table public.chatbot_messages enable row level security;
alter table public.kb_question_events enable row level security;

revoke all on table public.chatbot_conversations from anon, authenticated;
revoke all on table public.chatbot_messages from anon, authenticated;
revoke all on table public.kb_question_events from anon, authenticated;

grant select, insert, update, delete on table public.chatbot_conversations to service_role;
grant select, insert, update, delete on table public.chatbot_messages to service_role;
grant select, insert, update, delete on table public.kb_question_events to service_role;

drop policy if exists "service_role_manage_chatbot_conversations" on public.chatbot_conversations;
drop policy if exists "service_role_manage_chatbot_messages" on public.chatbot_messages;
drop policy if exists "service_role_manage_kb_question_events" on public.kb_question_events;

create policy "service_role_manage_chatbot_conversations"
on public.chatbot_conversations
for all
to service_role
using (true)
with check (true);

create policy "service_role_manage_chatbot_messages"
on public.chatbot_messages
for all
to service_role
using (true)
with check (true);

create policy "service_role_manage_kb_question_events"
on public.kb_question_events
for all
to service_role
using (true)
with check (true);


