import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema, emergencyServiceSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';

export async function generateMetadata() {
  return buildManagedPageMetadata('/car-roadside-assitance');
}

export default function RsaLayout({ children }: { children: React.ReactNode }) {
  const pageUrl = `${SITE_URL}/car-roadside-assitance`;

  return (
    <>
      <JsonLd
        data={[
          emergencyServiceSchema({
            name: 'MYFNG Roadside Assistance',
            description: '24x7 roadside assistance for towing, jumpstart, puncture repair and emergency help.',
            url: pageUrl,
          }),
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'Roadside Assistance', url: pageUrl },
          ]),
        ]}
      />
      {children}
    </>
  );
}
