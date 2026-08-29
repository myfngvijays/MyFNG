import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import { organizationSchema, localBusinessSchema, websiteSchema } from '@/lib/seo/schemas';
import JsonLd from '@/components/seo/JsonLd';
import HomePageClient from './HomePageClient';

export const revalidate = 120;

export async function generateMetadata() {
  return buildManagedPageMetadata('/');
}

export default async function HomePage() {
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
