import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import { getOrganizationSchema, localBusinessSchema, websiteSchema } from '@/lib/seo/schemas';
import JsonLd from '@/components/seo/JsonLd';
import HomePageClient from './HomePageClient';

export async function generateMetadata() {
  return buildManagedPageMetadata('/');
}

export default async function HomePage() {
  return (
    <>
      <JsonLd
        data={[
          await getOrganizationSchema(),
          websiteSchema(),
          localBusinessSchema('Mumbai'),
        ]}
      />
      <HomePageClient />
    </>
  );
}
