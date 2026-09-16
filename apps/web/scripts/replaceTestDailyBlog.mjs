import { readFileSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const ROOT = process.cwd();
const SLUG = 'how-doorstep-car-service-works-and-what-to-expect';

function loadEnv() {
  const raw = readFileSync(path.join(ROOT, '.env.local'), 'utf8');
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

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data: blog, error } = await supabase
    .from('blogs')
    .select('id, title, slug')
    .eq('slug', SLUG)
    .maybeSingle();
  if (error) throw new Error(error.message);

  if (blog?.id) {
    await supabase.from('daily_blog_settings').update({ last_blog_id: null }).eq('last_blog_id', blog.id);
    await supabase.from('daily_blog_runs').delete().eq('blog_id', blog.id);
    const { error: delErr } = await supabase.from('blogs').delete().eq('id', blog.id);
    if (delErr) throw new Error(delErr.message);
    console.log(JSON.stringify({ deleted: true, id: blog.id, slug: blog.slug, title: blog.title }));
  } else {
    console.log(JSON.stringify({ deleted: false, reason: 'already_gone' }));
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
