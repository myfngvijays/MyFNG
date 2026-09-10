import type { ReactNode } from 'react';
import UtmCapture from './UtmCapture';
import CookieConsentBanner from '@/components/dpdp/CookieConsentBanner';
import GatedPublicTrackers from '@/components/dpdp/GatedPublicTrackers';
import OpenAiAdsHeadScript from '@/components/dpdp/OpenAiAdsHeadScript';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OpenAiAdsHeadScript />
      <UtmCapture />
      <GatedPublicTrackers />
      <CookieConsentBanner />
      {children}
    </>
  );
}
