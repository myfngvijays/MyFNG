-- MISA AI usage + billing telemetry (OpenAI token usage per request)
create extension if not exists pgcrypto;

create table if not exists public.misa_ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  channel text not null default 'WEBSITE' check (channel in ('WEBSITE', 'APP', 'WHATSAPP', 'ADMIN', 'UNKNOWN')),
  model text not null default 'gpt-4o',
  prompt_tokens integer not null default 0,
  completion_tokens integer not null default 0,
  total_tokens integer not null default 0,
  tool_calls_count integer not null default 0,
  iterations integer not null default 1,
  estimated_cost_usd numeric(12, 6) not null default 0,
  user_message_preview text,
  created_at timestamptz not null default now()
);

create index if not exists misa_ai_usage_logs_created_at_idx
  on public.misa_ai_usage_logs(created_at desc);

create index if not exists misa_ai_usage_logs_channel_created_at_idx
  on public.misa_ai_usage_logs(channel, created_at desc);

create index if not exists misa_ai_usage_logs_model_created_at_idx
  on public.misa_ai_usage_logs(model, created_at desc);

alter table public.misa_ai_usage_logs enable row level security;
revoke all on table public.misa_ai_usage_logs from anon, authenticated;
grant select, insert, update, delete on table public.misa_ai_usage_logs to service_role;

drop policy if exists "service_role_manage_misa_ai_usage_logs" on public.misa_ai_usage_logs;
create policy "service_role_manage_misa_ai_usage_logs"
on public.misa_ai_usage_logs
for all
to service_role
using (true)
with check (true);
