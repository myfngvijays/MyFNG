import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Book Car Service Online | MyFNG',
  description:
    'Book car service online at MYFNG. Choose your city, car model, services & workshop. Free pickup & delivery available across Mumbai, Pune & Thane.',
  keywords: [
    'book car service online',
    'car service booking',
    'online car repair booking',
    'MYFNG booking',
  ],
  keyphrase: 'book car service online',
  canonicalPath: '/book-service',
  city: 'Mumbai',
});

export default function BookServiceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
