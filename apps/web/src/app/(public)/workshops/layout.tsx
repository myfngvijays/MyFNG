import { buildPageMetadata } from '@/lib/seo/metadata';
import JsonLd from '@/components/seo/JsonLd';
import { localBusinessSchema } from '@/lib/seo/schemas';

export const metadata = buildPageMetadata({
  title: 'Find Car Workshops Near Me | MyFNG Verified Garages',
  description:
    'Find verified MYFNG car workshops near you in Mumbai, Pune, Thane & Navi Mumbai. Compare ratings, services & book online instantly.',
  keywords: [
    'car workshop near me',
    'garage near me',
    'MYFNG workshops',
    'car service center near me',
  ],
  keyphrase: 'car workshop near me',
  canonicalPath: '/workshops',
  city: 'Mumbai',
});

export default function WorkshopsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={localBusinessSchema('Mumbai')} />
      {children}
    </>
  );
}
