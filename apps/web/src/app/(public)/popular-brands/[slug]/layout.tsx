import { notFound } from 'next/navigation';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema, collectionPageSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';
import { getPopularBrandBySlug, getPopularBrandPagePath } from '@/lib/popular-brands';
import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import { DEFAULT_SERVICES, INTERNAL_SLUG_TO_MARKETING } from '@/lib/services/catalog';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = getPopularBrandBySlug(slug);
  if (!brand) return {};
  return buildManagedPageMetadata(getPopularBrandPagePath(slug));
}

export default async function PopularBrandLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const brand = getPopularBrandBySlug(slug);
  if (!brand) notFound();

  const pageUrl = `${SITE_URL}${brand.pagePath}`;
  const serviceItems = DEFAULT_SERVICES.slice(0, 6).map((service) => ({
    name: `${brand.name} ${service.title}`,
    url: `${SITE_URL}/car-services/${INTERNAL_SLUG_TO_MARKETING[service.slug]}`,
  }));

  return (
    <>
      <JsonLd
        data={[
          collectionPageSchema({
            name: `${brand.name} Car Service & Repair`,
            description: brand.heroDescription,
            url: pageUrl,
            items: serviceItems,
          }),
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'Popular Brands', url: `${SITE_URL}/car-services` },
            { name: brand.name, url: pageUrl },
          ]),
        ]}
      />
      {children}
    </>
  );
}
