import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import path from 'path';

function loadEnv() {
  const raw = readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const DATED_AUTO_SLUG_SUFFIX = /-\d{8}-[a-z0-9]{8,}$/i;

function toBlogSlug(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function stripDatedAutoSlugSuffix(slug) {
  return toBlogSlug(String(slug || '').replace(DATED_AUTO_SLUG_SUFFIX, ''));
}

function legacySlugList(seo) {
  const raw = seo?.legacy_slugs;
  return Array.isArray(raw) ? raw.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

async function rewriteRenamedBlogLinks(db, renames) {
  const pageSize = 200;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db
      .from('blogs')
      .select('id, content, seo_data')
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = data || [];
    if (!rows.length) break;

    for (const row of rows) {
      let content = String(row.content || '');
      let seoText = JSON.stringify(row.seo_data || {});
      let changed = false;
      for (const rename of renames) {
        const needle = `/blogs/${rename.from}`;
        const next = `/blogs/${rename.to}`;
        if (content.includes(needle)) {
          content = content.replaceAll(needle, next);
          changed = true;
        }
        if (seoText.includes(needle)) {
          seoText = seoText.replaceAll(needle, next);
          changed = true;
        }
      }
      if (!changed) continue;
      let seoData = row.seo_data;
      try {
        seoData = JSON.parse(seoText);
      } catch {
        seoData = row.seo_data;
      }
      const { error: updateError } = await db
        .from('blogs')
        .update({ content, seo_data: seoData, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (updateError) throw updateError;
    }

    if (rows.length < pageSize) break;
  }
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase admin missing');
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await db
    .from('blogs')
    .select('id, slug, title, seo_data')
    .or('slug.like.%-2024%,slug.like.%-2025%,slug.like.%-2026%,slug.like.%-2027%,slug.like.%-2028%');
  if (error) throw error;

  const renames = [];
  for (const row of data || []) {
    const oldSlug = String(row.slug || '').trim();
    const root = stripDatedAutoSlugSuffix(oldSlug);
    if (!root || root === oldSlug) continue;

    let candidate = root;
    for (let n = 2; n < 40; n += 1) {
      const { data: hit, error: hitError } = await db.from('blogs').select('id').eq('slug', candidate).maybeSingle();
      if (hitError) throw hitError;
      if (!hit?.id || String(hit.id) === String(row.id)) break;
      candidate = `${root}-${n}`;
    }
    if (candidate === oldSlug) continue;

    const seo = { ...(row.seo_data || {}) };
    const legacy = legacySlugList(seo);
    if (!legacy.includes(oldSlug)) legacy.push(oldSlug);
    seo.legacy_slugs = legacy;
    if (typeof seo.canonical_url === 'string' && seo.canonical_url.includes(`/blogs/${oldSlug}`)) {
      seo.canonical_url = seo.canonical_url.replaceAll(`/blogs/${oldSlug}`, `/blogs/${candidate}`);
    }

    const { error: updateError } = await db
      .from('blogs')
      .update({ slug: candidate, seo_data: seo, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updateError) throw updateError;
    renames.push({ from: oldSlug, to: candidate, title: row.title });
    console.log(`${oldSlug} -> ${candidate}`);
  }

  if (renames.length) await rewriteRenamedBlogLinks(db, renames);
  console.log(`updated ${renames.length}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
