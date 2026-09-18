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

function normalize(pathValue) {
  const trimmed = String(pathValue || '').trim();
  if (!trimmed || trimmed === '/') return '/';
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

const SERVICES = [
  ['periodic-service', 'periodic-car-service'],
  ['engine-service', 'car-engine-service'],
  ['ac-service', 'car-ac-service'],
  ['battery-service', 'car-battery-service'],
  ['brake-service', 'car-brake-service'],
  ['clutch-service', 'car-clutch-service'],
  ['tyre-wheel-care', 'tyre-wheel-care'],
  ['detailing-service', 'car-detailing-service'],
  ['denting-painting', 'car-denting-painting'],
  ['electrical-battery-service', 'car-electrical-battery-service'],
  ['suspension-steering-service', 'car-suspension-steering-service'],
  ['custom-repair', 'car-custom-repair'],
];

const CITIES = [
  'mumbai', 'pune', 'thane', 'navi-mumbai', 'vashi', 'nerul', 'koparkhairane', 'kharghar',
  'belapur', 'airoli', 'sanpada', 'seawoods', 'ulwe', 'kamothe', 'panvel', 'kalamboli',
  'ghansoli', 'juinagar', 'khandeshwar', 'mansarovar', 'turbhe', 'rabale', 'taloja',
  'dombivli', 'kalyan', 'ambernath', 'badlapur', 'titwala', 'ulhasnagar',
];

const BRANDS = ['maruti-suzuki', 'hyundai', 'honda', 'tata', 'mahindra', 'toyota', 'kia', 'skoda', 'volkswagen'];

const STATIC_PAGES = [
  '/', '/about-us', '/contact-us', '/faqs', '/car-services', '/book-service', '/workshop-locator',
  '/misa-ai', '/car-roadside-assistance', '/car-loan', '/car-service-and-repairs', '/blogs',
  '/privacy-policy', '/privacy-notice', '/data-rights', '/terms-and-conditions',
];

function cityName(slug) {
  if (slug === 'navi-mumbai') return 'Navi Mumbai';
  if (slug === 'belapur') return 'CBD Belapur';
  return slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function buildMap() {
  const map = new Map();
  const add = (from, to) => {
    const source = normalize(from);
    const target = normalize(to);
    if (source && target && source !== target) map.set(source, target);
  };
  for (const [internal, marketing] of SERVICES) {
    add(`/car-services/${internal}`, `/car-services/${marketing}`);
    add(`/services/${internal}`, `/car-services/${marketing}`);
  }
  add('/car-services/car-battery', '/car-services/car-battery-service');
  for (const slug of CITIES) add(`/car-service-in/${slug}`, `/car-service-in-${slug}`);
  add('/about', '/about-us');
  add('/contact', '/contact-us');
  add('/faq', '/faqs');
  add('/blog', '/blogs');
  add('/services', '/car-services');
  add('/rsa_landing', '/car-roadside-assistance');
  add('/roadside-assistance', '/car-roadside-assistance');
  add('/car-roadside-assitance', '/car-roadside-assistance');
  return map;
}

function cityInsert(slug) {
  const name = cityName(slug);
  const pagePath = `/car-service-in-${slug}`;
  return {
    page_path: pagePath,
    page_label: `Car Service ${name}`,
    title: `Best Car Service in ${name} | Periodic, AC & Engine Repair | MyFNG`,
    description: `Book car service in ${name} at verified MYFNG workshops. Periodic service, AC repair, engine service, brake service with transparent pricing and free pickup & delivery.`,
    keywords: `car service ${name}, car repair ${name}, best mechanic ${name}, car workshop ${name}, MYFNG`,
    keyphrase: `car service ${name}`,
    canonical_path: pagePath,
    og_type: 'website',
    city: name,
    noindex: false,
    active: true,
    display_order: 200,
    notes: '',
    updated_at: new Date().toISOString(),
  };
}

function serviceInsert(internal, marketing) {
  const pagePath = `/car-services/${marketing}`;
  const label = marketing.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    page_path: pagePath,
    page_label: label,
    title: `${label} | MyFNG`,
    description: `Book ${label.toLowerCase()} at verified MYFNG workshops across Mumbai, Pune and Thane. Transparent pricing and free pickup & delivery.`,
    keywords: `${label.toLowerCase()}, ${label.toLowerCase()} near me, MYFNG`,
    keyphrase: `${label.toLowerCase()} near me`,
    canonical_path: pagePath,
    og_type: 'website',
    city: 'Mumbai',
    noindex: false,
    active: true,
    display_order: 100,
    notes: '',
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const db = createClient(url, key, { auth: { persistSession: false } });
  const map = buildMap();
  const { data: rows, error } = await db.from('site_page_seo').select('id, page_path, canonical_path');
  if (error) throw error;

  const byPath = new Map((rows || []).map((row) => [normalize(row.page_path), row]));
  const remapped = [];
  const removed = [];

  for (const row of rows || []) {
    const from = normalize(row.page_path);
    const to = map.get(from);
    if (!to) continue;
    const conflict = byPath.get(to);
    if (conflict && conflict.id !== row.id) {
      const del = await db.from('site_page_seo').delete().eq('id', row.id);
      if (del.error) throw del.error;
      byPath.delete(from);
      removed.push(from);
      continue;
    }
    const nextCanonical = map.get(normalize(row.canonical_path || from)) || to;
    const upd = await db
      .from('site_page_seo')
      .update({ page_path: to, canonical_path: nextCanonical, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (upd.error) throw upd.error;
    byPath.delete(from);
    byPath.set(to, { ...row, page_path: to, canonical_path: nextCanonical });
    remapped.push(`${from} -> ${to}`);
  }

  const inserts = [];
  for (const [internal, marketing] of SERVICES) {
    const pagePath = `/car-services/${marketing}`;
    if (!byPath.has(pagePath)) inserts.push(serviceInsert(internal, marketing));
  }
  for (const slug of CITIES) {
    const pagePath = `/car-service-in-${slug}`;
    if (!byPath.has(pagePath)) inserts.push(cityInsert(slug));
  }
  for (const slug of BRANDS) {
    const pagePath = `/popular-brands/${slug}`;
    if (byPath.has(pagePath)) continue;
    const name = slug.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
    inserts.push({
      page_path: pagePath,
      page_label: `${name} Car Service`,
      title: `${name} Car Service & Repair | Periodic, AC, Brake | MyFNG`,
      description: `Book periodic service, AC repair, brake work and more for your ${name} at verified MYFNG workshops across Mumbai, Thane, Navi Mumbai and Pune.`,
      keywords: `${name} service, ${name} repair, MYFNG`,
      keyphrase: `${name} car service`,
      canonical_path: pagePath,
      og_type: 'website',
      city: 'Mumbai',
      noindex: false,
      active: true,
      display_order: 210,
      notes: '',
      updated_at: new Date().toISOString(),
    });
  }
  for (const pagePath of STATIC_PAGES) {
    if (byPath.has(pagePath)) continue;
    inserts.push({
      page_path: pagePath,
      page_label: pagePath === '/' ? 'Home' : pagePath.slice(1),
      title: `${pagePath === '/' ? 'Home' : pagePath.slice(1)} | MyFNG`,
      description: 'Book car service online at verified MYFNG workshops across Mumbai, Pune and Thane.',
      keywords: 'MYFNG, car service',
      keyphrase: 'car service',
      canonical_path: pagePath,
      og_type: 'website',
      city: 'Mumbai',
      noindex: false,
      active: true,
      display_order: 10,
      notes: '',
      updated_at: new Date().toISOString(),
    });
  }

  const leftover = [...map.keys()].filter((from) => byPath.has(from));
  for (const from of leftover) {
    const row = byPath.get(from);
    const del = await db.from('site_page_seo').delete().eq('id', row.id);
    if (del.error) throw del.error;
    byPath.delete(from);
    removed.push(from);
  }

  let inserted = [];
  if (inserts.length) {
    const ins = await db.from('site_page_seo').insert(inserts).select('page_path');
    if (ins.error) throw ins.error;
    inserted = (ins.data || []).map((r) => r.page_path);
  }

  console.log(JSON.stringify({ remapped, removed, inserted }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
