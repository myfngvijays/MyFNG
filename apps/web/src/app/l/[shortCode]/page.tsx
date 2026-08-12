import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import {
  getManagedShortLinkPublic,
  resolveManagedShortLink,
} from '@/lib/link-manager/resolve';
import { detectLinkPlatform } from '@/lib/link-manager/utils';
import ShortLinkLandingClient from '@/components/public/ShortLinkLandingClient';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ shortCode: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { shortCode } = await params;
  const link = await getManagedShortLinkPublic(shortCode);
  if (!link) return { title: 'MyFNG Link' };
  return {
    title: link.og_title || link.title || 'MyFNG',
    description: link.og_description || link.description || 'Continue to your destination',
    openGraph: {
      title: link.og_title || link.title || 'MyFNG',
      description: link.og_description || link.description || undefined,
      images: link.og_image_url ? [link.og_image_url] : undefined,
    },
  };
}

export default async function ShortLinkLandingPage({ params, searchParams }: Props) {
  const { shortCode } = await params;
  const sp = await searchParams;
  const link = await getManagedShortLinkPublic(shortCode);
  if (!link) redirect('/');

  const cookieStore = await cookies();
  const unlocked = cookieStore.get(`sl_unlock_${shortCode}`)?.value === '1';
  const needsPassword = Boolean(link.password_hash) && !unlocked;

  const headerStore = await headers();
  const userAgent = headerStore.get('user-agent');
  const isQrScan = String(sp.via || '') === 'qr';
  const continueNow = String(sp.go || '') === '1' && (!link.password_hash || unlocked);

  if (continueNow) {
    const ip =
      headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      headerStore.get('x-real-ip') ||
      null;
    const result = await resolveManagedShortLink(shortCode, {
      ip,
      userAgent,
      referrer: headerStore.get('referer'),
      isQrScan,
      headers: headerStore,
      passwordUnlocked: unlocked || !link.password_hash,
      forceRedirect: true,
    });
    if (result?.kind === 'redirect' || result?.kind === 'gone') {
      redirect(result.url);
    }
  }

  const platform = detectLinkPlatform(userAgent);

  return (
    <ShortLinkLandingClient
      shortCode={shortCode}
      title={link.og_title || link.title || 'MyFNG'}
      description={link.og_description || link.description || 'Tap continue to open your link.'}
      imageUrl={link.og_image_url || null}
      needsPassword={needsPassword}
      appDeepLink={link.app_deep_link || null}
      pixelMetaId={link.pixel_meta_id || null}
      pixelGoogleId={link.pixel_google_id || null}
      platform={platform}
      isQrScan={isQrScan}
    />
  );
}
