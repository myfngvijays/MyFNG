# Legacy Blog CSV Import

One-time importer for old blog CSV data while preserving existing slugs/URLs.

Script: `scripts/importLegacyBlogsCsv.mjs`

## Required env

- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`

The script tries to auto-load env values from `.env.local` in `apps/web`.

## CSV file

Default input file:

- `/Users/roadserve/Downloads/frontend_blogs1.csv`

Override with:

- `--file /absolute/or/relative/path/to/file.csv`

## Commands

Dry-run (recommended first):

```bash
npm run blogs:import-legacy-csv
```

Execute real import:

```bash
npm run blogs:import-legacy-csv -- --execute
```

Optional limit (for smoke test):

```bash
npm run blogs:import-legacy-csv -- --limit 10
npm run blogs:import-legacy-csv -- --limit 10 --execute
```

## Behavior

- Preserves `slug` exactly from CSV (no regeneration).
- Validates and skips:
  - missing title/slug/content
  - duplicate slug in same CSV (keeps first, skips later rows)
  - slug already present in DB
- Dry-run reports what would be created.
- Execute mode inserts blogs idempotently by slug checks.
- Maps categories/tags only when matching records already exist in DB.

## Post-import checks

1. Open 5 random posts at `https://myfng.in/blogs/{slug}`.
2. Open old-style URL `https://myfng.in/blog/{slug}` and confirm redirect to `/blogs/{slug}`.
3. Review script summary for `skippedReasons` and `failures`.
