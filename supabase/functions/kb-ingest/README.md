## Supabase Edge Function: `kb-ingest`

This function builds your Supabase Vector Knowledge Base from:
- Supabase **tables** (FAQ/policy/scripts)
- Website **URLs** (HTML pages)

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

### 5) Schedule it (Supabase dashboard → Edge Functions → Schedules)
Example cron:
- Every 6 hours: `0 */6 * * *`

### 6) Trigger manually
```bash
curl -X POST '<your-supabase-edge-function-url>/kb-ingest' -H 'Authorization: Bearer <service_role_or_anon_if allowed>'
```


