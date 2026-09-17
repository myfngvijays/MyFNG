import { notFound } from 'next/navigation';
import { getCityPageBySlug, getCityPagePath } from '@/lib/city-pages';
import { buildManagedPageMetadata } from '@/lib/site-page-seo';

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ city: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params;
  const city = getCityPageBySlug(citySlug);
  if (!city) return {};
  return buildManagedPageMetadata(getCityPagePath(city.slug));
}

export default async function LegacyCityServiceLayout({ children, params }: LayoutProps) {
  const { city: citySlug } = await params;
  const city = getCityPageBySlug(citySlug);
  if (!city) notFound();
  return children;
}
