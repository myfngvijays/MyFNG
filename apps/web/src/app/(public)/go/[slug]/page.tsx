import { cookies, headers } from 'next/headers';
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
import { mergeUtmParams, UTM_COOKIE_KEY, type UtmParams } from '@/lib/utm';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

async function persistUtmCookie(utm: UtmParams) {
  const hasValue = Object.values(utm).some((value) => String(value || '').trim());
  if (!hasValue) return;
  const cookieStore = await cookies();
  cookieStore.set(UTM_COOKIE_KEY, encodeURIComponent(JSON.stringify(utm)), {
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax',
  });
}

export default async function AppDownloadGoPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const normalizedSlug = String(slug || '').trim().toLowerCase();
  if (!isAppDownloadSlug(normalizedSlug)) notFound();

  const query = await searchParams;
  const headerStore = await headers();
  const userAgent = headerStore.get('user-agent') || '';
  const referer = headerStore.get('referer') || '';
  const utm = parseUtmFromSearchParams(query);
  await persistUtmCookie(utm);

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
