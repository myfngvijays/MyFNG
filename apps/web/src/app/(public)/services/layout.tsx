import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Car Services - Periodic, AC, Engine & More | MyFNG',
  description:
    'Explore all car services at MYFNG - periodic service, AC service, engine repair, brake service, battery, clutch, denting & painting across Mumbai & Pune.',
  keywords: [
    'car services',
    'periodic car service',
    'car AC service',
    'car engine service',
    'car brake service',
    'car repair services Mumbai',
  ],
  keyphrase: 'car services near me',
  canonicalPath: '/car-services',
  city: 'Mumbai',
});

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
