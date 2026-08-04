import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import AppDownloadGoFallback from '@/components/landing/AppDownloadGoFallback';
import {
  buildAppDownloadRedirectUrl,
  detectAppDownloadPlatform,
  getAppStoreUrls,
  isAppDownloadSlug,
  logAppDownloadLinkClick,
  parseUtmFromSearchParams,
} from '@/lib/app-download-link';
import { mergeUtmParams } from '@/lib/utm';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AppDownloadGoPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const normalizedSlug = String(slug || '').trim().toLowerCase();
  if (!isAppDownloadSlug(normalizedSlug)) notFound();

  const query = await searchParams;
  const headerStore = await headers();
  const userAgent = headerStore.get('user-agent') || '';
  const referer = headerStore.get('referer') || '';
  const utm = parseUtmFromSearchParams(query);

  const platform = detectAppDownloadPlatform(userAgent);

  if (platform === 'ios' || platform === 'android') {
    const redirectUrl = await buildAppDownloadRedirectUrl(platform, utm);
    await logAppDownloadLinkClick({
      slug: normalizedSlug,
      platform,
      utm,
      userAgent,
      referer,
      redirectUrl,
      source: 'go_redirect',
    });
    redirect(redirectUrl);
  }

  await logAppDownloadLinkClick({
    slug: normalizedSlug,
    platform: 'desktop',
    utm,
    userAgent,
    referer,
    redirectUrl: null,
    source: 'go_fallback_page',
  });

  const stores = await getAppStoreUrls();
  return (
    <AppDownloadGoFallback
      slug={normalizedSlug}
      iosUrl={stores.ios}
      androidUrl={stores.android}
      utm={mergeUtmParams(utm)}
    />
  );
}
