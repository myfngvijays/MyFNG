import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MYFNG Roadside Assistance (RSA) | AI-Powered Emergency Dispatch',
  description:
    'MYFNG Roadside Assistance (RSA) - AI-powered emergency dispatch for towing, jumpstart, puncture, fuel delivery & on-road help. 24x7 support.',
};

export default function RsaLandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
