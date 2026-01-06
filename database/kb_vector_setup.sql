-- KB Vector Setup for MY FNG (pgvector + RAG tables + search RPC)
-- Run this in Supabase SQL editor.

create extension if not exists vector;

create table if not exists public.kb_sources (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('table', 'url')),
  source_key text not null unique,
  title text not null,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_run_at timestamptz,
  last_run_status text,
  last_run_error text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  doc_type text not null default 'general',
  source text not null,
  language text default 'mixed',
  source_hash text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(source)
);

create table if not exists public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.kb_documents(id) on delete cascade,
  chunk_index int not null,
  chunk_text text not null,
  embedding vector(1536), -- text-embedding-3-small
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(document_id, chunk_index)
);

create index if not exists kb_chunks_document_id_idx on public.kb_chunks(document_id);

-- Vector index (tune lists as your dataset grows)
create index if not exists kb_chunks_embedding_ivfflat
on public.kb_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Simple semantic search RPC (can be extended with metadata filters)
create or replace function public.kb_search(
  query_embedding vector(1536),
  match_count int default 8
)
returns table (
  document_id uuid,
  chunk_id uuid,
  chunk_text text,
  similarity float,
  metadata jsonb
)
language sql stable
as $$
  select
    c.document_id,
    c.id as chunk_id,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) as similarity,
    c.metadata
  from public.kb_chunks c
  where c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;










