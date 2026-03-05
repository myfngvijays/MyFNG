import fs from 'node:fs/promises';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
  const out = {
    file: '',
    execute: false,
    limit: 0,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--file' && argv[i + 1]) {
      out.file = String(argv[i + 1]);
      i += 1;
      continue;
    }
    if (a === '--execute') {
      out.execute = true;
      continue;
    }
    if (a === '--limit' && argv[i + 1]) {
      out.limit = Math.max(0, Number.parseInt(String(argv[i + 1]), 10) || 0);
      i += 1;
    }
  }
  return out;
}

function tryLoadEnvFromFile(filePath) {
  return fs
    .readFile(filePath, 'utf8')
    .then((raw) => {
      const lines = String(raw || '').split('\n');
      for (const line of lines) {
        const clean = line.trim();
        if (!clean || clean.startsWith('#')) continue;
        const idx = clean.indexOf('=');
        if (idx <= 0) continue;
        const key = clean.slice(0, idx).trim();
        let val = clean.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    })
    .catch(() => undefined);
}

function envOr(...names) {
  for (const n of names) {
    const v = process.env[n];
    if (v && String(v).trim()) return String(v).trim();
  }
  return '';
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function parseCsv(raw) {
  const text = String(raw || '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  row.push(field);
  if (row.some((x) => String(x).length > 0)) rows.push(row);
  return rows;
}

function normalizeText(s) {
  return String(s || '')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function toExcerpt(html) {
  const plain = stripHtml(html);
  if (!plain) return null;
  const words = plain.split(/\s+/).filter(Boolean).slice(0, 60).join(' ');
  return words || null;
}

function splitCsvList(value) {
  return String(value || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseSeoText(seoText, slug, fallbackTitle) {
  const src = String(seoText || '');
  if (!src.trim()) {
    return {
      canonical_url: `https://myfng.in/blogs/${encodeURIComponent(slug)}`,
      meta_title: fallbackTitle || undefined,
    };
  }

  const getMetaByName = (name) => {
    const re = new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i');
    const m = src.match(re);
    return m ? String(m[1]).trim() : '';
  };
  const getMetaByProp = (prop) => {
    const re = new RegExp(`<meta[^>]*property=["']${prop}["'][^>]*content=["']([^"']*)["'][^>]*>`, 'i');
    const m = src.match(re);
    return m ? String(m[1]).trim() : '';
  };
  const titleMatch = src.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? normalizeText(titleMatch[1]) : '';

  return {
    canonical_url: `https://myfng.in/blogs/${encodeURIComponent(slug)}`,
    meta_title: title || fallbackTitle || undefined,
    meta_description: getMetaByName('description') || undefined,
    keywords: getMetaByName('keywords') || undefined,
    keyphrase: getMetaByName('keyphrase') || undefined,
    keyphrase_description: getMetaByName('keyphrase description') || undefined,
    og_title: getMetaByProp('og:title') || undefined,
    og_description: getMetaByProp('og:description') || undefined,
  };
}

function buildContentFromRow(row) {
  const ordered = [
    row.paragraph_1,
    row.paragraph_2,
    row.paragraph_3,
    row.paragraph_4,
    row.paragraph_5,
    row.subtitle_1,
    row.subtitle_2,
  ];
  const seen = new Set();
  const parts = [];
  for (const raw of ordered) {
    const value = String(raw || '').trim();
    if (!value) continue;
    const key = normalizeText(value).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    parts.push(value);
  }
  return parts.join('\n\n').trim();
}

function buildStatus(rawStatus, isActiveRaw) {
  const status = String(rawStatus || '').trim().toLowerCase();
  const isActive = ['1', 'true', 'yes'].includes(String(isActiveRaw || '').trim().toLowerCase());
  if (!isActive) return 'archived';
  if (status.includes('publish')) return 'published';
  if (status.includes('archive')) return 'archived';
  if (status.includes('pending')) return 'pending_review';
  return 'draft';
}

function parseDate(input) {
  const d = new Date(String(input || '').trim());
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function resolveFeaturedImage(row) {
  const candidates = [row.image_layout_url, row.image_url_1, row.image_url_2, row.image_url_3, row.image_url_4, row.image_url_5];
  for (const c of candidates) {
    const v = String(c || '').trim();
    if (!v) continue;
    if (/^https?:\/\//i.test(v)) return v;
  }
  return null;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchExistingSlugSet(supabase, slugs) {
  const out = new Set();
  const batches = chunk(slugs, 200);
  for (const batch of batches) {
    const { data, error } = await supabase.from('blogs').select('slug').in('slug', batch);
    if (error) throw new Error(`Failed to fetch existing slugs: ${error.message}`);
    for (const r of data || []) out.add(String(r.slug || '').trim());
  }
  return out;
}

async function fetchNameMaps(supabase) {
  const categoryMap = new Map();
  const tagMap = new Map();

  const { data: categories, error: cErr } = await supabase.from('blog_categories').select('id,name');
  if (cErr) throw new Error(`Failed to fetch categories: ${cErr.message}`);
  for (const c of categories || []) {
    const key = String(c.name || '').trim().toLowerCase();
    if (key && !categoryMap.has(key)) categoryMap.set(key, String(c.id));
  }

  const { data: tags, error: tErr } = await supabase.from('blog_tags').select('id,name,slug');
  if (tErr) throw new Error(`Failed to fetch tags: ${tErr.message}`);
  for (const t of tags || []) {
    const byName = String(t.name || '').trim().toLowerCase();
    const bySlug = String(t.slug || '').trim().toLowerCase();
    if (byName && !tagMap.has(byName)) tagMap.set(byName, String(t.id));
    if (bySlug && !tagMap.has(bySlug)) tagMap.set(bySlug, String(t.id));
  }

  return { categoryMap, tagMap };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const defaultCsv = '/Users/roadserve/Downloads/frontend_blogs1.csv';
  const filePath = path.resolve(args.file || defaultCsv);

  await tryLoadEnvFromFile(path.resolve(process.cwd(), '.env.local'));
  await tryLoadEnvFromFile(path.resolve(process.cwd(), '..', '.env.local'));

  const csvText = await fs.readFile(filePath, 'utf8');
  const rows = parseCsv(csvText);
  if (!rows.length) throw new Error('CSV is empty.');

  const header = rows[0].map((x) => String(x || '').trim());
  const dataRows = rows.slice(1);
  const records = dataRows.map((r, idx) => {
    const obj = {};
    for (let i = 0; i < header.length; i += 1) {
      obj[header[i]] = r[i] ?? '';
    }
    obj.__row = idx + 2;
    return obj;
  });

  const scopedRecords = args.limit > 0 ? records.slice(0, args.limit) : records;
  const duplicateRows = new Set();
  const firstBySlug = new Map();
  for (const rec of scopedRecords) {
    const slug = String(rec.slug || '').trim();
    if (!slug) continue;
    if (!firstBySlug.has(slug)) {
      firstBySlug.set(slug, rec.__row);
    } else {
      duplicateRows.add(rec.__row);
    }
  }

  const SUPABASE_URL = envOr('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = envOr('SUPABASE_SERVICE_ROLE_KEY');
  const hasDb = Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
  const shouldWrite = Boolean(args.execute);
  if (shouldWrite && !hasDb) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for --execute mode.');
  }

  const summary = {
    file: filePath,
    mode: shouldWrite ? 'execute' : 'dry-run',
    totalRows: scopedRecords.length,
    duplicatesInFile: [...duplicateRows].length,
    dbCheckEnabled: hasDb,
    created: 0,
    skipped: 0,
    failed: 0,
    skippedReasons: {},
    failures: [],
  };

  let supabase = null;
  let existingSlugSet = new Set();
  let categoryMap = new Map();
  let tagMap = new Map();
  if (hasDb) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    const allSlugs = scopedRecords.map((x) => String(x.slug || '').trim()).filter(Boolean);
    existingSlugSet = await fetchExistingSlugSet(supabase, allSlugs);
    const maps = await fetchNameMaps(supabase);
    categoryMap = maps.categoryMap;
    tagMap = maps.tagMap;
  }

  for (const row of scopedRecords) {
    const title = normalizeText(row.main_title);
    const slug = normalizeText(row.slug);
    const content = buildContentFromRow(row);
    const rowLabel = `row ${row.__row}`;

    const skip = (reason) => {
      summary.skipped += 1;
      summary.skippedReasons[reason] = (summary.skippedReasons[reason] || 0) + 1;
      console.log(`[skip] ${rowLabel} (${slug || 'no-slug'}): ${reason}`);
    };

    if (!title) {
      skip('missing_title');
      continue;
    }
    if (!slug) {
      skip('missing_slug');
      continue;
    }
    if (!slugify(slug)) {
      skip('invalid_slug');
      continue;
    }
    if (!content) {
      skip('missing_content');
      continue;
    }
    if (duplicateRows.has(row.__row)) {
      skip('duplicate_slug_in_file');
      continue;
    }
    if (existingSlugSet.has(slug)) {
      skip('slug_exists_in_db');
      continue;
    }

    const plain = stripHtml(content);
    const readTime = Math.max(1, Math.ceil(wordCount(plain) / 100));
    const status = buildStatus(row.status, row.is_active);
    const createdAt = parseDate(row.created_at) || new Date().toISOString();
    const updatedAt = parseDate(row.updated_at) || createdAt;
    const seoData = parseSeoText(row.seo_text, slug, title);
    const excerpt = toExcerpt(content);
    const featuredImage = resolveFeaturedImage(row);

    const categories = splitCsvList(row.category);
    const tags = splitCsvList(row.tags);
    const categoryIds = categories
      .map((x) => categoryMap.get(String(x).toLowerCase()) || null)
      .filter(Boolean);
    const tagIds = tags
      .map((x) => {
        const t = String(x).toLowerCase();
        return tagMap.get(t) || tagMap.get(slugify(t)) || null;
      })
      .filter(Boolean);

    if (!shouldWrite) {
      summary.created += 1;
      continue;
    }

    try {
      const payload = {
        title,
        slug,
        excerpt,
        content,
        seo_data: seoData,
        category_id: categoryIds[0] || null,
        read_time: readTime,
        featured_image: featuredImage,
        status,
        is_featured: false,
        is_premium: false,
        published_at: status === 'published' ? createdAt : null,
        created_at: createdAt,
        updated_at: updatedAt,
      };

      const { data: inserted, error: insErr } = await supabase.from('blogs').insert(payload).select('id').single();
      if (insErr) throw new Error(insErr.message);
      const blogId = inserted?.id;
      if (!blogId) throw new Error('Insert succeeded but no blog id returned.');

      if (categoryIds.length) {
        const rowsToInsert = categoryIds.map((cid, idx) => ({
          blog_id: blogId,
          category_id: cid,
          is_primary: idx === 0,
        }));
        await supabase.from('blog_category_mapping').insert(rowsToInsert);
      }

      if (tagIds.length) {
        const uniqueTagIds = [...new Set(tagIds)];
        const rowsToInsert = uniqueTagIds.map((tid) => ({ blog_id: blogId, tag_id: tid }));
        await supabase.from('blog_tag_mapping').insert(rowsToInsert);
      }

      existingSlugSet.add(slug);
      summary.created += 1;
      console.log(`[ok] ${rowLabel} (${slug})`);
    } catch (e) {
      const msg = e?.message || String(e);
      summary.failed += 1;
      summary.failures.push({ row: row.__row, slug, error: msg });
      console.error(`[fail] ${rowLabel} (${slug}): ${msg}`);
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(JSON.stringify(summary, null, 2));
  if (summary.duplicatesInFile > 0) {
    console.log('\nDuplicate slug rows were skipped (only first occurrence eligible).');
  }
}

main().catch((e) => {
  console.error('[blog csv import] failed:', e?.message || e);
  process.exit(1);
});
