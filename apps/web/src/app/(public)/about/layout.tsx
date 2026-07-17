import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import JsonLd from '@/components/seo/JsonLd';
import { getOrganizationSchema } from '@/lib/seo/schemas';

export async function generateMetadata() {
  return buildManagedPageMetadata('/about-us');
}

export default async function AboutLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={await getOrganizationSchema()} />
      {children}
    </>
  );
}
