import { notFound } from 'next/navigation';
import CityServiceLanding from '@/components/city/CityServiceLanding';
import { CITY_PAGES, getCityPageBySlug } from '@/lib/city-pages';

export const revalidate = 300;

export function generateStaticParams() {
  return CITY_PAGES.map((city) => ({ city: city.slug }));
}

export default async function CityServicePage({ params }: { params: Promise<{ city: string }> }) {
  const { city: citySlug } = await params;
  const city = getCityPageBySlug(citySlug);
  if (!city) notFound();
  return <CityServiceLanding citySlug={city.slug} />;
}
