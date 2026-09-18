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

const AUTHOR = 'My FNG Auto Expert';
const CONTRIBUTOR = 'Nikhil Yelligetti';
const DAYS = 3;

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Supabase admin missing');

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };

  const since = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();
  const users = await fetch(
    `${url}/rest/v1/users_login?select=id,full_name,email&full_name=ilike.*Nikhil*Yelligetti*&limit=5`,
    { headers },
  ).then((r) => r.json());
  const nikhil = Array.isArray(users) ? users[0] : null;

  const blogs = await fetch(
    `${url}/rest/v1/blogs?select=id,slug,title,published_at,author_id,seo_data&status=eq.published&published_at=gte.${since}&order=published_at.desc&limit=400`,
    { headers },
  ).then((r) => r.json());

  const autoBlogs = (Array.isArray(blogs) ? blogs : []).filter((b) => {
    const seo = b.seo_data || {};
    return Boolean(seo.ai_daily_post || seo.ai_batch_post || seo.ai_rsa_post || seo.ai_generated);
  });

  let updated = 0;
  for (const blog of autoBlogs) {
    const seo = { ...(blog.seo_data || {}) };
    seo.author_name = AUTHOR;
    seo.contributor_name = CONTRIBUTOR;
    seo.reviewed_by = CONTRIBUTOR;
    const patch = {
      seo_data: seo,
      updated_at: new Date().toISOString(),
    };
    if (nikhil?.id) patch.author_id = nikhil.id;
    const res = await fetch(`${url}/rest/v1/blogs?id=eq.${blog.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(patch),
    });
    if (res.ok) updated += 1;
  }

  if (nikhil?.id) {
    await fetch(`${url}/rest/v1/daily_blog_settings?id=eq.1`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ author_id: nikhil.id, updated_at: new Date().toISOString() }),
    });
  }

  console.log(
    JSON.stringify({
      since,
      matched_user: nikhil ? { id: nikhil.id, name: nikhil.full_name } : null,
      auto_blogs: autoBlogs.length,
      updated,
    }),
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
