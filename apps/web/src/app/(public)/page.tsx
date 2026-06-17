import { buildPageMetadata } from '@/lib/seo/metadata';
import { localBusinessSchema, organizationSchema, websiteSchema } from '@/lib/seo/schemas';
import JsonLd from '@/components/seo/JsonLd';
import HomePageClient from './HomePageClient';

export const metadata = buildPageMetadata({
  title: 'Best Mechanic Near Me Mumbai | Best Car Repair Near Me | MyFNG',
  description:
    'Best car repair & mechanic near me in Mumbai, Pune & Thane. Book periodic service, AC repair, engine service, brake service & more at verified MYFNG workshops.',
  keywords: [
    'best mechanic near me',
    'best car repair near me',
    'car service near me Mumbai',
    'car service near me Pune',
    'car servicing Mumbai',
    'car repair Mumbai',
    'periodic car service',
    'MYFNG',
  ],
  keyphrase: 'best car repair near me',
  canonicalPath: '/',
  city: 'Mumbai',
});

export default function HomePage() {
  return (
    <>
      <JsonLd
        data={[
          organizationSchema(),
          websiteSchema(),
          localBusinessSchema('Mumbai'),
        ]}
      />
      <HomePageClient />
    </>
  );
}
