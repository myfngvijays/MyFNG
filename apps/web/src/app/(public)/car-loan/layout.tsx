import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema, webPageSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';

export async function generateMetadata() {
  return buildManagedPageMetadata('/car-loan');
}

export default function CarLoanLayout({ children }: { children: React.ReactNode }) {
  const pageUrl = `${SITE_URL}/car-loan`;

  return (
    <>
      <JsonLd
        data={[
          webPageSchema({
            name: 'Car Loan | MYFNG',
            description: 'Apply for car loan and vehicle finance options with MYFNG.',
            url: pageUrl,
          }),
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'Car Loan', url: pageUrl },
          ]),
        ]}
      />
      {children}
    </>
  );
}
