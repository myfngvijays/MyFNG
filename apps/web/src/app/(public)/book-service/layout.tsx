import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import JsonLd from '@/components/seo/JsonLd';
import { breadcrumbSchema, webPageSchema } from '@/lib/seo/schemas';
import { SITE_URL } from '@/lib/seo/metadata';

export async function generateMetadata() {
  return buildManagedPageMetadata('/book-service');
}

export default function BookServiceLayout({ children }: { children: React.ReactNode }) {
  const pageUrl = `${SITE_URL}/book-service`;

  return (
    <>
      <JsonLd
        data={[
          webPageSchema({
            name: 'Book Car Service Online | MYFNG',
            description: 'Book car service online at verified MYFNG workshops with transparent pricing.',
            url: pageUrl,
          }),
          breadcrumbSchema([
            { name: 'Home', url: SITE_URL },
            { name: 'Book Service', url: pageUrl },
          ]),
        ]}
      />
      {children}
    </>
  );
}
