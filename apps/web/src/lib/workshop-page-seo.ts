import { isBlogIndexable } from '@/lib/blog/seo';
import { unstable_cache } from 'next/cache';
import type { Metadata } from 'next';
import { buildPageMetadata, SITE_URL, type PageSeoConfig } from '@/lib/seo/metadata';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export type WorkshopPageSeoRecord = {
  slug: string;
  meta_title: string;
  meta_description: string;
  meta_keywords: string[];
  short_description: string;
  profile_image: string;
  cover_image: string;
  is_published: boolean;
  noindex: boolean;
  updated_at?: string;
  published_at?: string;
  workshop_name: string;
  workshop_city: string;
  workshop_address: string;
  workshop_state: string;
  workshop_pincode: string;
  gmb_data: Record<string, unknown> | null;
};

function keywordsToString(keywords: string[] | null | undefined): string {
  return (keywords || []).map((k) => String(k).trim()).filter(Boolean).join(', ');
}

function pickWorkshopImage(record: WorkshopPageSeoRecord): string | undefined {
  const candidates = [record.cover_image, record.profile_image];
  for (const value of candidates) {
    if (!value) continue;
    return value.startsWith('http') ? value : `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
  }

  const gmbPhotos = (record.gmb_data?.photos as Array<{ photo_reference?: string }> | undefined) || [];
  const firstPhoto = gmbPhotos[0]?.photo_reference;
  if (firstPhoto?.startsWith('http')) return firstPhoto;

  return undefined;
}

export function buildWorkshopPageSeoFallback(record: WorkshopPageSeoRecord): PageSeoConfig {
  const gmb = record.gmb_data || {};
  const businessName = String(record.meta_title || gmb.business_name || record.workshop_name || 'MYFNG Workshop').trim();
  const city = String(record.workshop_city || 'Mumbai').trim() || 'Mumbai';
  const title = record.meta_title?.trim() || `${businessName} ${city} - Best Car Service Center | MyFNG`;
  const description =
    record.meta_description?.trim() ||
    record.short_description?.trim() ||
    String(gmb.description || '').trim() ||
    `Book car service at ${businessName} in ${city}. Verified MYFNG workshop with transparent pricing and expert technicians.`;

  const keywords = record.meta_keywords?.length
    ? record.meta_keywords
    : [
        `${businessName} car service`,
        `car service ${city}`,
        'MYFNG workshop',
        'car repair near me',
      ];

  return {
    title,
    description,
    keywords,
    keyphrase: `car service ${city}`,
    canonicalPath: `/workshop/${record.slug}`,
    ogImage: pickWorkshopImage(record),
    city,
    noindex: record.noindex,
  };
}

async function fetchWorkshopPageSeoRaw(slug: string): Promise<WorkshopPageSeoRecord | null> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const { data, error } = await supabaseAdmin
    .from('workshop_public_pages')
    .select(
      'slug, meta_title, meta_description, meta_keywords, short_description, profile_image, cover_image, is_published, noindex, updated_at, published_at, gmb_data, workshop:workshops(name, city, address, state, pincode)',
    )
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();

  if (error || !data) return null;

  const workshop = (data as any).workshop || {};
  return {
    slug: String(data.slug),
    meta_title: String(data.meta_title || '').trim(),
    meta_description: String(data.meta_description || '').trim(),
    meta_keywords: Array.isArray(data.meta_keywords)
      ? data.meta_keywords.map((k: unknown) => String(k).trim()).filter(Boolean)
      : [],
    short_description: String(data.short_description || '').trim(),
    profile_image: String(data.profile_image || '').trim(),
    cover_image: String(data.cover_image || '').trim(),
    is_published: data.is_published === true,
    noindex: data.noindex === true,
    updated_at: data.updated_at ? String(data.updated_at) : undefined,
    published_at: data.published_at ? String(data.published_at) : undefined,
    workshop_name: String(workshop.name || '').trim(),
    workshop_city: String(workshop.city || '').trim(),
    workshop_address: String(workshop.address || '').trim(),
    workshop_state: String(workshop.state || '').trim(),
    workshop_pincode: String(workshop.pincode || '').trim(),
    gmb_data: (data.gmb_data as Record<string, unknown> | null) || null,
  };
}

export async function getWorkshopPageSeo(slug: string): Promise<WorkshopPageSeoRecord | null> {
  const normalized = String(slug || '').trim().toLowerCase();
  if (!normalized) return null;

  return unstable_cache(
    async () => fetchWorkshopPageSeoRaw(normalized),
    ['workshop-page-seo', normalized],
    { tags: ['workshop-page-seo', `workshop-page-seo:${normalized}`], revalidate: 300 },
  )();
}

export async function buildWorkshopPageMetadata(slug: string): Promise<Metadata> {
  const record = await getWorkshopPageSeo(slug);
  if (!record) return {};
  return buildPageMetadata(buildWorkshopPageSeoFallback(record));
}

export type WorkshopSeoSummary = {
  id: string;
  slug: string;
  page_label: string;
  title: string;
  description: string;
  keywords: string;
  active: boolean;
  noindex: boolean;
  updated_at?: string;
  edit_href: string;
};

export async function listPublishedWorkshopSeoSummaries(): Promise<WorkshopSeoSummary[]> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  const { data, error } = await supabaseAdmin
    .from('workshop_public_pages')
    .select('id, slug, meta_title, meta_description, meta_keywords, is_published, noindex, updated_at, workshop:workshops(name, city)')
    .eq('is_published', true)
    .order('updated_at', { ascending: false });

  if (error || !data) return [];

  return data.map((row: any) => {
    const workshop = row.workshop || {};
    const label = String(workshop.name || row.slug).trim();
    const city = String(workshop.city || '').trim();
    return {
      id: String(row.id),
      slug: String(row.slug),
      page_label: city ? `${label} (${city})` : label,
      title: String(row.meta_title || `${label} - Best Car Service Center | MyFNG`).trim(),
      description: String(row.meta_description || '').trim(),
      keywords: keywordsToString(row.meta_keywords),
      active: row.is_published === true,
      noindex: row.noindex === true,
      updated_at: row.updated_at ? String(row.updated_at) : undefined,
      edit_href: '/dashboard/super_admin/workshops/public-pages',
    };
  });
}

export async function listWorkshopSitemapEntries(): Promise<Array<{ slug: string; lastModified?: Date }>> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  const { data, error } = await supabaseAdmin
    .from('workshop_public_pages')
    .select('slug, updated_at, published_at, noindex')
    .eq('is_published', true)
    .eq('noindex', false);

  if (error || !data) return [];

  return data.map((row: any) => ({
    slug: String(row.slug),
    lastModified: new Date(row.updated_at || row.published_at || Date.now()),
  }));
}

export async function listBlogSitemapEntries(): Promise<Array<{ slug: string; lastModified?: Date }>> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  const { data, error } = await supabaseAdmin
    .from('blogs')
    .select('slug, updated_at, published_at, seo_data')
    .eq('status', 'published');

  if (error || !data) return [];

  return data
    .filter((row: any) => isBlogIndexable(row.seo_data))
    .map((row: any) => ({
    slug: String(row.slug),
    lastModified: new Date(row.updated_at || row.published_at || Date.now()),
  }));
}

export async function listWorkshopLocatorSchemaItems(limit = 12): Promise<Array<{ name: string; url: string }>> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  const { data, error } = await supabaseAdmin
    .from('workshop_public_pages')
    .select('slug, gmb_data, workshop:workshops(name)')
    .eq('is_published', true)
    .eq('noindex', false)
    .order('is_featured', { ascending: false })
    .order('views_count', { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return data.map((row: any) => ({
    name: String(row.gmb_data?.business_name || row.workshop?.name || row.slug),
    url: `${SITE_URL}/workshop/${row.slug}`,
  }));
}
