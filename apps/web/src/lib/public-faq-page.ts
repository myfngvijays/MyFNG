import { unstable_cache } from 'next/cache';
import {
  mapPublicFaqRow,
  PUBLIC_FAQS_TABLE,
  sortPublicFaqs,
  type PublicFaqGroup,
} from '@/lib/public-faqs-db';
import { platformVisibilityColumn } from '@/lib/content-platform-visibility';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { PUBLIC_FAQ_SEO_TAG } from '@/lib/public-faq-seo';

export type FaqSectionIcon =
  | 'help'
  | 'wrench'
  | 'wind'
  | 'cpu'
  | 'battery'
  | 'disc'
  | 'circle'
  | 'paint'
  | 'sparkles'
  | 'settings'
  | 'shield';

export type FaqPageSection = {
  title: string;
  sectionKey: string;
  faqGroup: PublicFaqGroup;
  color: string;
  icon: FaqSectionIcon;
  items: Array<{ q: string; a: string }>;
};

const SECTION_STYLE_BY_KEY: Record<string, { color: string; icon: FaqSectionIcon }> = {
  general: { color: 'bg-blue-600', icon: 'help' },
  'periodic-car-service': { color: 'bg-indigo-600', icon: 'wrench' },
  'ac-service': { color: 'bg-cyan-600', icon: 'wind' },
  'car-engine-service': { color: 'bg-orange-600', icon: 'cpu' },
  'battery-service': { color: 'bg-yellow-600', icon: 'battery' },
  'brake-service': { color: 'bg-red-600', icon: 'disc' },
  'tyre-service': { color: 'bg-emerald-600', icon: 'circle' },
  'denting-painting': { color: 'bg-purple-600', icon: 'paint' },
  'car-detailing': { color: 'bg-pink-600', icon: 'sparkles' },
  'clutch-service': { color: 'bg-slate-700', icon: 'settings' },
  rsa: { color: 'bg-amber-600', icon: 'shield' },
};

const GROUP_STYLE: Record<PublicFaqGroup, { color: string; icon: FaqSectionIcon }> = {
  GENERAL: { color: 'bg-blue-600', icon: 'help' },
  SERVICE: { color: 'bg-indigo-600', icon: 'wrench' },
  RSA: { color: 'bg-amber-600', icon: 'shield' },
};

function resolveSectionStyle(sectionKey: string, faqGroup: PublicFaqGroup, title: string) {
  const normalizedKey = sectionKey.trim().toLowerCase();
  if (SECTION_STYLE_BY_KEY[normalizedKey]) return SECTION_STYLE_BY_KEY[normalizedKey];
  if (normalizedKey.includes('rsa') || title.toLowerCase().includes('roadside')) {
    return SECTION_STYLE_BY_KEY.rsa;
  }
  return GROUP_STYLE[faqGroup] || GROUP_STYLE.GENERAL;
}

async function fetchWebFaqPageSections(): Promise<FaqPageSection[]> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  let query = supabaseAdmin
    .from(PUBLIC_FAQS_TABLE)
    .select('*')
    .order('faq_group', { ascending: true })
    .order('section_key', { ascending: true })
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  query = query.eq(platformVisibilityColumn('web'), true);

  let { data, error } = await query;

  if (error && /visible_app|visible_web|visible_android|visible_ios/i.test(error.message)) {
    ({ data, error } = await supabaseAdmin
      .from(PUBLIC_FAQS_TABLE)
      .select('*')
      .eq('active', true)
      .order('faq_group', { ascending: true })
      .order('section_key', { ascending: true })
      .order('display_order', { ascending: true }));
  }

  if (error || !data?.length) return [];

  const rows = sortPublicFaqs(data.map(mapPublicFaqRow));
  const grouped = new Map<
    string,
    { title: string; sectionKey: string; faqGroup: PublicFaqGroup; items: Array<{ q: string; a: string }> }
  >();

  for (const row of rows) {
    if (!row.question.trim() || !row.answer.trim()) continue;
    const key = `${row.faq_group}:${row.section_key}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        title: row.section_title || 'General',
        sectionKey: row.section_key,
        faqGroup: row.faq_group,
        items: [],
      });
    }
    grouped.get(key)!.items.push({ q: row.question, a: row.answer });
  }

  return Array.from(grouped.values()).map((section) => {
    const style = resolveSectionStyle(section.sectionKey, section.faqGroup, section.title);
    return {
      title: section.title,
      sectionKey: section.sectionKey,
      faqGroup: section.faqGroup,
      color: style.color,
      icon: style.icon,
      items: section.items,
    };
  });
}

export const getWebFaqPageSections = unstable_cache(fetchWebFaqPageSections, ['web-faq-page-sections'], {
  tags: [PUBLIC_FAQ_SEO_TAG],
  revalidate: 3600,
});

/** Uncached fetch for admin preview parity */
export async function loadWebFaqPageSectionsUncached() {
  return fetchWebFaqPageSections();
}
