import { getWebFaqPageSections } from '@/lib/public-faq-page';
import FaqPageClient from './FaqPageClient';

export default async function FaqPage() {
  const sections = await getWebFaqPageSections();
  return <FaqPageClient sections={sections} />;
}
