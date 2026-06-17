import { buildPageMetadata } from '@/lib/seo/metadata';
import JsonLd from '@/components/seo/JsonLd';
import { organizationSchema } from '@/lib/seo/schemas';

export const metadata = buildPageMetadata({
  title: 'About Us - MYFNG | India\'s AI-Powered Car Service Platform',
  description:
    'Learn about MYFNG - India\'s first AI-powered car care platform. 100+ verified workshops across Mumbai, Pune, Thane & Navi Mumbai with transparent pricing.',
  keywords: [
    'about MYFNG',
    'car service company India',
    'verified car workshops',
    'AI car service platform',
  ],
  keyphrase: 'about MYFNG car service',
  canonicalPath: '/about-us',
  city: 'Mumbai',
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={organizationSchema()} />
      {children}
    </>
  );
}
