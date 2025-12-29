## Supabase Edge Function: `kb-ingest`

This function builds your Supabase Vector Knowledge Base from:
- Supabase **tables** (FAQ/policy/scripts)
- Website **URLs** (HTML pages)

It can also ingest **manual documents/FAQs** via a POST JSON payload (useful for Excel uploads).

### 1) SQL setup (run once)
Run:
- `database/kb_vector_setup.sql`

### 2) Create KB sources
Insert rows into `public.kb_sources`.

#### A) Table source example
```sql
insert into public.kb_sources (source_type, source_key, title, config)
values (
  'table',
  'table:telecaller_scripts',
  'Telecaller scripts (objections/FAQs)',
  jsonb_build_object(
    'table', 'telecaller_scripts',
    'id_column', 'id',
    'title_column', 'script_title',
    'content_column', 'script_content',
    'doc_type', 'faq',
    'language', 'mixed',
    'limit', 500
  )
)
on conflict (source_key) do update set
  is_active = true,
  config = excluded.config,
  updated_at = now();
```

#### B) URL source example
```sql
insert into public.kb_sources (source_type, source_key, title, config)
values (
  'url',
  'url:https://myfng.astric.ai/about',
  'About MY FNG',
  jsonb_build_object(
    'url', 'https://myfng.astric.ai/about',
    'doc_type', 'marketing',
    'language', 'en'
  )
)
on conflict (source_key) do update set
  is_active = true,
  config = excluded.config,
  updated_at = now();
```

### 3) Deploy function
From project root (after `supabase login` + `supabase link`):
```bash
supabase functions deploy kb-ingest
```

### 4) Set secrets (Supabase dashboard → Edge Functions → Secrets)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- optional: `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`
- optional (disable auto-chunking/ingest): `KB_INGEST_DISABLED=true`
- optional (manual override when disabled): `KB_INGEST_SECRET=<random>`

### 5) Schedule it (Supabase dashboard → Edge Functions → Schedules)
Example cron:
- Every 6 hours: `0 */6 * * *`

### 6) Trigger manually
```bash
curl -X POST '<your-supabase-edge-function-url>/kb-ingest' \
  -H 'Authorization: Bearer <service_role_or_anon_if allowed>' \
  -H 'x-kb-ingest-secret: <KB_INGEST_SECRET_if_set>'
```

---

## Manual ingest (Excel/text → chunks → embeddings)

### A) Upload FAQs (rows) → one KB document
Requires `KB_INGEST_SECRET` and header `x-kb-ingest-secret`.

```bash
curl -X POST '<your-supabase-edge-function-url>/kb-ingest' \
  -H 'Content-Type: application/json' \
  -H 'x-kb-ingest-secret: <KB_INGEST_SECRET>' \
  -d '{
    "mode": "manual_faqs",
    "title": "Excel FAQs (Dec 2025)",
    "source": "manual:excel_faqs_dec_2025",
    "docType": "faq",
    "language": "mixed",
    "upsertIntoManualFaqs": true,
    "faqs": [
      { "question": "Q1?", "answer": "A1" },
      { "question": "Q2?", "answer": "A2" }
    ]
  }'
```

### B) Upload a free-form document

```bash
curl -X POST '<your-supabase-edge-function-url>/kb-ingest' \
  -H 'Content-Type: application/json' \
  -H 'x-kb-ingest-secret: <KB_INGEST_SECRET>' \
  -d '{
    "mode": "manual_text",
    "title": "Policy / Script",
    "source": "manual:policy_v1",
    "docType": "general",
    "language": "en",
    "text": ".... large text ...."
  }'
```




