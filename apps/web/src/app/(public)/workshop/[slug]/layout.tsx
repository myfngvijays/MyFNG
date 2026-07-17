import type { Metadata } from 'next';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema, workshopLocalBusinessSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';
import { buildWorkshopPageMetadata, getWorkshopPageSeo, buildWorkshopPageSeoFallback } from '@/lib/workshop-page-seo';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildWorkshopPageMetadata(slug);
}

export default async function WorkshopSlugLayout({ children, params }: LayoutProps) {
  const { slug } = await params;
  const record = await getWorkshopPageSeo(slug);

  if (!record) {
    return children;
  }

  const seo = buildWorkshopPageSeoFallback(record);
  const pageUrl = `${SITE_URL}/workshop/${record.slug}`;
  const gmb = record.gmb_data || {};
  const latlng = gmb.latlng as { lat?: number; lng?: number } | null | undefined;

  return (
    <>
      <JsonLd
        data={[
          workshopLocalBusinessSchema({
            name: String(gmb.business_name || record.workshop_name || seo.title),
            description: seo.description,
            url: pageUrl,
            image: seo.ogImage,
            telephone: String(gmb.phone_number || gmb.international_phone || '').trim() || undefined,
            address: record.workshop_address || String(gmb.formatted_address || '').trim() || undefined,
            city: record.workshop_city || undefined,
            state: record.workshop_state || undefined,
            pincode: record.workshop_pincode || undefined,
            latitude: latlng?.lat ?? null,
            longitude: latlng?.lng ?? null,
            rating: typeof gmb.rating === 'number' ? gmb.rating : null,
            reviewCount: typeof gmb.total_reviews === 'number' ? gmb.total_reviews : null,
          }),
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'Workshop Locator', url: `${SITE_URL}/workshop-locator` },
            { name: String(gmb.business_name || record.workshop_name || record.slug), url: pageUrl },
          ]),
        ]}
      />
      {children}
    </>
  );
}
