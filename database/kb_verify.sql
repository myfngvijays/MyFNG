-- KB Verify (run in Supabase SQL editor after ingest)

-- 1) Basic counts
select count(*) as kb_sources from public.kb_sources;
select count(*) as kb_documents from public.kb_documents;
select count(*) as kb_chunks from public.kb_chunks;

-- 2) Most recent sources run status
select
  source_key,
  title,
  is_active,
  last_run_at,
  last_run_status,
  left(coalesce(last_run_error, ''), 200) as last_run_error_preview
from public.kb_sources
order by last_run_at desc nulls last, updated_at desc
limit 50;

-- 3) Spot-check a document and its chunks
select id, title, doc_type, source, language, source_hash, created_at, updated_at
from public.kb_documents
order by updated_at desc
limit 10;

select document_id, chunk_index, length(chunk_text) as chars, metadata
from public.kb_chunks
order by updated_at desc
limit 20;


