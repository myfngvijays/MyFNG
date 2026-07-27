import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'MyFNG Pricing',
  robots: { index: false, follow: false },
};

export default function PricingShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
