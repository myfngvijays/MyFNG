## Deploy `kb-ingest` (Supabase Edge Function)

### Prereqs
- Run `database/kb_vector_setup.sql`
- Run `database/kb_vector_rls_lockdown.sql`
- Run `database/kb_sources_seed.sql` (after updating URLs)

### Dashboard deploy (no CLI)
1) Supabase Dashboard → **Edge Functions**
2) Create function: **`kb-ingest`**
3) Paste code from `supabase/functions/kb-ingest/index.ts`
4) Set Secrets (Edge Functions → Secrets):
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - optional: `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`
5) Deploy

### Schedule
Supabase Dashboard → Edge Functions → Schedules
- Example: `0 */6 * * *` (every 6 hours)

### Manual trigger
Use the “Invoke” button in dashboard, or curl:
```bash
curl -X POST '<your-edge-function-url>/kb-ingest' \
  -H 'Authorization: Bearer <service_role_key_or_jwt>'
```

### Verify
Run `database/kb_verify.sql` in SQL editor.


