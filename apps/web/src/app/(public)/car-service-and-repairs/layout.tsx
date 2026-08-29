import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema, faqPageSchema, localBusinessSchema, serviceSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';
import { ADS_LP_FAQS } from './faqs';

export async function generateMetadata() {
  return buildManagedPageMetadata('/car-service-and-repairs');
}

export default function CarServiceAndRepairsLayout({ children }: { children: React.ReactNode }) {
  const pageUrl = `${SITE_URL}/car-service-and-repairs`;

  return (
    <>
      <JsonLd
        data={[
          localBusinessSchema('Mumbai'),
          serviceSchema({
            name: 'Car Service and Repairs',
            description:
              'Book car service and repairs near you at verified MYFNG workshops in Mumbai, Pune, Thane and Navi Mumbai. Periodic servicing, AC repair, engine repair, brakes and more.',
            url: pageUrl,
            image: `${SITE_URL}/myfng-app-ui.png`,
          }),
          faqPageSchema(ADS_LP_FAQS),
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'Car Service and Repairs', url: pageUrl },
          ]),
        ]}
      />
      {children}
    </>
  );
}
