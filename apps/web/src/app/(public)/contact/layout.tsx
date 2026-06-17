import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Contact Us - MYFNG | Car Service Support',
  description:
    'Contact MYFNG for car service bookings, roadside assistance & support. Call +91-8657575757 or visit our workshops in Mumbai, Pune & Thane.',
  keywords: [
    'contact MYFNG',
    'car service contact',
    'MYFNG customer support',
    'car repair helpline',
  ],
  keyphrase: 'contact MYFNG car service',
  canonicalPath: '/contact-us',
  city: 'Mumbai',
});

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
