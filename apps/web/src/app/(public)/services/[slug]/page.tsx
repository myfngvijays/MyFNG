import { permanentRedirect } from 'next/navigation';
import { INTERNAL_SLUG_TO_MARKETING as INTERNAL_TO_MARKETING } from '@/lib/services/catalog';

export default async function LegacyServiceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const marketingSlug = INTERNAL_TO_MARKETING[slug];
  if (marketingSlug) {
    permanentRedirect(`/car-services/${marketingSlug}`);
  }
  permanentRedirect('/car-services');
}
