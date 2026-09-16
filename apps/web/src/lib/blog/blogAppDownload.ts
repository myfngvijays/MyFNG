import { MYFNG_APP_DOWNLOAD_URL } from '@/shared/constants/appDownload';
import { BLOG_UTM_MEDIUM, BLOG_UTM_SOURCE, toCampaignSlug } from '@/lib/blog/aiLinks';
import { createManagedShortLink } from '@/lib/link-manager/service';
import { buildShortUrl, shortBaseFromLinkMeta } from '@/lib/link-manager/utils';

export const BLOG_LINK_FOLDER = 'Blog';

export function buildGoAppDownloadUrl(opts: {
  slug: string;
  focusKeyword?: string;
  content?: string;
}) {
  const campaign = toCampaignSlug(opts.slug);
  const url = new URL(MYFNG_APP_DOWNLOAD_URL);
  url.searchParams.set('utm_source', BLOG_UTM_SOURCE);
  url.searchParams.set('utm_medium', BLOG_UTM_MEDIUM);
  url.searchParams.set('utm_campaign', campaign);
  url.searchParams.set('utm_content', toCampaignSlug(opts.content || 'app-download'));
  const term = String(opts.focusKeyword || '').trim();
  if (term) url.searchParams.set('utm_term', term.slice(0, 80));
  return url.toString();
}

export async function ensureBlogAppDownloadLink(opts: {
  supabaseAdmin: any;
  slug: string;
  title: string;
  focusKeyword?: string;
  createdBy?: string | null;
}): Promise<{ url: string; short_code?: string; created?: boolean }> {
  const campaign = toCampaignSlug(opts.slug);
  const longUrl = buildGoAppDownloadUrl({
    slug: opts.slug,
    focusKeyword: opts.focusKeyword,
    content: 'app-download',
  });

  const { data: existing } = await opts.supabaseAdmin
    .from('managed_short_links')
    .select('id, short_code, meta, folder, utm_campaign')
    .eq('folder', BLOG_LINK_FOLDER)
    .eq('utm_campaign', campaign)
    .maybeSingle();

  if (existing?.short_code) {
    return {
      url: buildShortUrl(existing.short_code, shortBaseFromLinkMeta(existing.meta)),
      short_code: existing.short_code,
      created: false,
    };
  }

  try {
    const created = await createManagedShortLink(opts.supabaseAdmin, {
      long_url: longUrl,
      title: `Blog app download · ${opts.title}`.slice(0, 160),
      description: `MyFNG Go app download from blog ${opts.slug}`,
      tags: ['blog', 'app-download'],
      custom_code: `b-${campaign}`.slice(0, 32),
      utm_source: BLOG_UTM_SOURCE,
      utm_medium: BLOG_UTM_MEDIUM,
      utm_campaign: campaign,
      utm_term: String(opts.focusKeyword || '').trim().slice(0, 80) || undefined,
      utm_content: 'app-download',
      folder: BLOG_LINK_FOLDER,
      created_by: opts.createdBy || undefined,
      create_mode: 'link_only',
    });
    return {
      url: String(created.short_url || longUrl),
      short_code: created.short_code,
      created: true,
    };
  } catch {
    return { url: longUrl };
  }
}
