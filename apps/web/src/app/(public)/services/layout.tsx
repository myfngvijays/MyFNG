import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import JsonLd from '@/components/seo/JsonLd';
import { collectionPageSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';
import { DEFAULT_SERVICES, INTERNAL_SLUG_TO_MARKETING } from '@/lib/services/catalog';

export async function generateMetadata() {
  return buildManagedPageMetadata('/car-services');
}

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  const items = DEFAULT_SERVICES.map((service) => ({
    name: service.title,
    url: `${SITE_URL}/car-services/${INTERNAL_SLUG_TO_MARKETING[service.slug]}`,
  }));

  return (
    <>
      <JsonLd
        data={collectionPageSchema({
          name: 'MyFNG Car Services',
          description: 'Periodic service, AC service, engine repair, brake service and more at verified MYFNG workshops.',
          url: `${SITE_URL}/car-services`,
          items,
        })}
      />
      {children}
    </>
  );
}
