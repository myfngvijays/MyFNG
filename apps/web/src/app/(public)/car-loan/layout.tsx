import { buildPageMetadata } from '@/lib/seo/metadata';

export const metadata = buildPageMetadata({
  title: 'Car Loan - Easy Vehicle Finance | MyFNG',
  description:
    'Apply for car loan with MYFNG. Quick vehicle finance options with easy eligibility check for Mumbai, Pune & Thane customers.',
  keywords: [
    'car loan',
    'vehicle finance',
    'car loan Mumbai',
    'car loan Pune',
  ],
  keyphrase: 'car loan',
  canonicalPath: '/car-loan',
  city: 'Mumbai',
});

export default function CarLoanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
