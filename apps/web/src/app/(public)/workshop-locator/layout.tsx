import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import JsonLd from '@/components/seo/JsonLd';
import { collectionPageSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';
import { listWorkshopLocatorSchemaItems } from '@/lib/workshop-page-seo';

export async function generateMetadata() {
  return buildManagedPageMetadata('/workshop-locator');
}

export default async function WorkshopsLayout({ children }: { children: React.ReactNode }) {
  const items = await listWorkshopLocatorSchemaItems(20);

  return (
    <>
      {items.length ? (
        <JsonLd
          data={collectionPageSchema({
            name: 'MYFNG Workshop Locator',
            description: 'Find verified MYFNG car workshops near you across Mumbai, Pune, Thane and Navi Mumbai.',
            url: `${SITE_URL}/workshop-locator`,
            items,
          })}
        />
      ) : null}
      {children}
    </>
  );
}
