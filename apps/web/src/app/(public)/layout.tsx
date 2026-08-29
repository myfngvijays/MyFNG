import type { ReactNode } from 'react';
import UtmCapture from './UtmCapture';
import CookieConsentBanner from '@/components/dpdp/CookieConsentBanner';
import GatedPublicTrackers from '@/components/dpdp/GatedPublicTrackers';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <UtmCapture />
      <GatedPublicTrackers />
      <CookieConsentBanner />
      {children}
    </>
  );
}
