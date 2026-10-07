import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RsaEmergencyLanding from '@/components/rsa/RsaEmergencyLanding';
import { findRsaEmergencyPage, RSA_EMERGENCY_PAGES } from '@/lib/rsa/emergencyPages';
import { buildPageMetadata } from '@/lib/seo/metadata';

export function generateStaticParams() {
  return RSA_EMERGENCY_PAGES.map((page) => ({ service: page.slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ service: string }> },
): Promise<Metadata> {
  const { service } = await params;
  const page = findRsaEmergencyPage(service);
  if (!page) return {};
  return buildPageMetadata({
    title: page.seoTitle,
    description: page.metaDescription,
    canonicalPath: `/car-roadside-assistance/${page.slug}`,
    keywords: page.keywords,
    keyphrase: page.keyphrase,
    city: 'Mumbai',
  });
}

export default async function RsaEmergencyServicePage({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  const page = findRsaEmergencyPage(service);
  if (!page) notFound();
  return <RsaEmergencyLanding page={page} />;
}
