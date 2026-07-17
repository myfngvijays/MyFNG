import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema, contactPageSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';

export async function generateMetadata() {
  return buildManagedPageMetadata('/contact-us');
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  const pageUrl = `${SITE_URL}/contact-us`;

  return (
    <>
      <JsonLd
        data={[
          contactPageSchema({
            name: 'Contact MYFNG',
            description: 'Contact MYFNG for car service bookings, roadside assistance and customer support.',
            url: pageUrl,
            telephone: '+91-8657575757',
            email: 'support@myfng.in',
          }),
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'Contact Us', url: pageUrl },
          ]),
        ]}
      />
      {children}
    </>
  );
}
