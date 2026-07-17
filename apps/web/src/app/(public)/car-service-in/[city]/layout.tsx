import { notFound } from 'next/navigation';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema, collectionPageSchema, localBusinessSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';
import { getCityPageBySlug, getCityPagePath } from '@/lib/city-pages';
import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import { DEFAULT_SERVICES, INTERNAL_SLUG_TO_MARKETING } from '@/lib/services/catalog';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ city: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params;
  const city = getCityPageBySlug(citySlug);
  if (!city) return {};
  return buildManagedPageMetadata(getCityPagePath(city.slug));
}

export default async function CityServiceLayout({ children, params }: LayoutProps) {
  const { city: citySlug } = await params;
  const city = getCityPageBySlug(citySlug);
  if (!city) notFound();

  const pageUrl = `${SITE_URL}${city.pagePath}`;
  const serviceItems = DEFAULT_SERVICES.slice(0, 8).map((service) => ({
    name: `${service.title} in ${city.name}`,
    url: `${SITE_URL}/car-services/${INTERNAL_SLUG_TO_MARKETING[service.slug]}`,
  }));

  return (
    <>
      <JsonLd
        data={[
          localBusinessSchema(city.name),
          collectionPageSchema({
            name: `Car Service in ${city.name}`,
            description: `Verified MYFNG car service workshops and booking options in ${city.name}.`,
            url: pageUrl,
            items: serviceItems,
          }),
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: `Car Service ${city.name}`, url: pageUrl },
          ]),
        ]}
      />
      {children}
    </>
  );
}
