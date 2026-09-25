import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { renderWorkshopLocationCover, workshopCoverFileSlug, workshopLocationCoverTitle } from './locationCoverRuntime.mjs';

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv(path.join(process.cwd(), '.env.local'));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing Supabase env');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const outDir = path.join(process.cwd(), 'public', 'media', 'workshop-covers');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const defaultPng = await renderWorkshopLocationCover('My FNG');
writeFileSync(path.join(outDir, 'default.png'), defaultPng);

const { data: pages, error } = await db
  .from('workshop_public_pages')
  .select('id, slug, gmb_data, workshop:workshops(id, name, workshop_name, city)');
if (error) {
  console.error(error.message);
  process.exit(1);
}

let ok = 0;
let fail = 0;
for (const page of pages || []) {
  const workshop = page.workshop || {};
  const title = workshopLocationCoverTitle({
    workshop_name: workshop.workshop_name,
    name: workshop.name,
    city: workshop.city,
    gmb_business_name: page.gmb_data?.business_name,
  });
  try {
    const png = await renderWorkshopLocationCover(title);
    const slug = workshopCoverFileSlug(title, page.slug);
    writeFileSync(path.join(outDir, `${slug}.png`), png);
    const filePath = `workshop-public-pages/location-covers/${slug}.png`;
    let cover_image = `/media/workshop-covers/${slug}.png?v=${Date.now()}`;
    const up = await db.storage.from('workshop-assets').upload(filePath, png, {
      contentType: 'image/png',
      upsert: true,
      cacheControl: '3600',
    });
    if (!up.error) {
      const { data: pub } = db.storage.from('workshop-assets').getPublicUrl(filePath);
      cover_image = `${pub.publicUrl}?v=${Date.now()}`;
    }
    const save = await db
      .from('workshop_public_pages')
      .update({ cover_image, updated_at: new Date().toISOString() })
      .eq('id', page.id);
    if (save.error) throw save.error;
    ok += 1;
    console.log('OK', title);
  } catch (e) {
    fail += 1;
    console.error('FAIL', title, e?.message || e);
  }
}

console.log(`DONE ok=${ok} fail=${fail} total=${(pages || []).length}`);
