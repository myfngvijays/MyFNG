import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Roadside Assistance (RSA) - 24x7 Emergency Help | MyFNG',
  description:
    'MYFNG Roadside Assistance - 24x7 emergency dispatch for towing, jumpstart, puncture repair, fuel delivery & on-road help across Mumbai & Pune.',
  keywords: [
    'roadside assistance',
    'car breakdown help',
    'emergency towing',
    'RSA Mumbai',
    'RSA Pune',
  ],
  keyphrase: 'roadside assistance near me',
  canonicalPath: '/car-roadside-assitance',
  city: 'Mumbai',
});

export default function RsaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
