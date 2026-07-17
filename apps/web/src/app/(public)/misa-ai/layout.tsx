import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema, webApplicationSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';
import './misa-ai.css';

export async function generateMetadata() {
  return buildManagedPageMetadata('/misa-ai');
}

export default function AiBookingLayout({ children }: { children: React.ReactNode }) {
  const pageUrl = `${SITE_URL}/misa-ai`;

  return (
    <>
      <JsonLd
        data={[
          webApplicationSchema({
            name: 'MYFNG AI Car Service Booking',
            description: 'Book car service instantly with MYFNG AI Booking Agent.',
            url: pageUrl,
          }),
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'MISA AI Booking', url: pageUrl },
          ]),
        ]}
      />
      {children}
    </>
  );
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
