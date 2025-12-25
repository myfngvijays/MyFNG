## KB / RAG setup (Supabase)

Run these in **Supabase SQL Editor** in this order:

1) `database/kb_vector_setup.sql`
- Creates `kb_sources`, `kb_documents`, `kb_chunks`, and RPC `kb_search()`

2) `database/kb_vector_rls_lockdown.sql`
- Locks KB tables down (no anon/authenticated access). Service role only.

3) `database/kb_sources_seed.sql`
- Seeds sources for docs (URLs) + blog/scripts/workshop pages (tables)
- Update the URLs to your production domain before running.

Optional (Admin “self-learning” loop):

4) `database/kb_manual_faqs_setup.sql`
- Stores admin-curated Q/A pairs (from chatbot logs) and ingests via KB

Then deploy the Edge Function:

- `supabase/functions/kb-ingest/index.ts` (Edge Function: `kb-ingest`)
- Set secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`
- Trigger/schedule `kb-ingest`

Verification SQL:

```sql
select count(*) as documents from public.kb_documents;
select count(*) as chunks from public.kb_chunks;
```


