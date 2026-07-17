import { buildManagedPageMetadata } from '@/lib/site-page-seo';
import JsonLd from '@/components/seo/JsonLd';
import { faqPageSchema } from '@/lib/seo/schemas';
import { getWebFaqsForSchema } from '@/lib/public-faq-seo';

export async function generateMetadata() {
  return buildManagedPageMetadata('/faqs');
}

export default async function FaqLayout({ children }: { children: React.ReactNode }) {
  const faqs = await getWebFaqsForSchema();

  return (
    <>
      <JsonLd data={faqPageSchema(faqs)} />
      {children}
    </>
  );
}
