import { readFileSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

function openBlogLinksInNewTab(html) {
  return String(html || '').replace(/<a\b([^>]*?)>/gi, (full, attrs) => {
    const hrefMatch = String(attrs).match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) return full;
    const href = String(hrefMatch[1] || '').trim();
    if (!href || href.startsWith('#') || /^(mailto:|tel:)/i.test(href)) return full;

    let next = String(attrs);
    if (/\btarget=/i.test(next)) {
      next = next.replace(/\btarget=["'][^"']*["']/i, 'target="_blank"');
    } else {
      next += ' target="_blank"';
    }
    if (/\brel=/i.test(next)) {
      next = next.replace(/\brel=["']([^"']*)["']/i, (_all, rel) => {
        const parts = new Set(String(rel || '').split(/\s+/).filter(Boolean).map((p) => p.toLowerCase()));
        parts.add('noopener');
        parts.add('noreferrer');
        return `rel="${[...parts].join(' ')}"`;
      });
    } else {
      next += ' rel="noopener noreferrer"';
    }
    return `<a${next}>`;
  });
}

function countNavigableAnchors(html) {
  const tags = String(html || '').match(/<a\b[^>]*>/gi) || [];
  return tags.filter((tag) => {
    const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1] || '';
    return href && !href.startsWith('#') && !/^(mailto:|tel:)/i.test(href);
  }).length;
}

function countBlankTargets(html) {
  const tags = String(html || '').match(/<a\b[^>]*>/gi) || [];
  return tags.filter((tag) => {
    const href = (tag.match(/href=["']([^"']+)["']/i) || [])[1] || '';
    if (!href || href.startsWith('#') || /^(mailto:|tel:)/i.test(href)) return false;
    return /\btarget=["']_blank["']/i.test(tag);
  }).length;
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  // 16 Sep IST 00:00 → 18 Sep IST 00:00 (covers kal + aaj)
  const from = '2026-09-15T18:30:00.000Z';
  const to = '2026-09-17T18:30:00.000Z';

  const { data, error } = await supabase
    .from('blogs')
    .select('id, slug, title, published_at, content')
    .eq('status', 'published')
    .gte('published_at', from)
    .lt('published_at', to)
    .order('published_at', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = data || [];
  let updated = 0;
  let unchanged = 0;
  const samples = [];

  for (const row of rows) {
    const next = openBlogLinksInNewTab(row.content || '');
    if (next === row.content) {
      unchanged += 1;
      continue;
    }
    const { error: upErr } = await supabase
      .from('blogs')
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (upErr) throw new Error(`${row.slug}: ${upErr.message}`);
    updated += 1;
    if (samples.length < 8) {
      samples.push({
        slug: row.slug,
        title: row.title,
        before_blank: countBlankTargets(row.content || ''),
        after_blank: countBlankTargets(next),
        navigable: countNavigableAnchors(next),
      });
    }
  }

  console.log(JSON.stringify({
    window: { from, to },
    found: rows.length,
    updated,
    unchanged,
    samples,
  }, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
