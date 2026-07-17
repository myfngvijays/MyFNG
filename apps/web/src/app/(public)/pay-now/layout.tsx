import { buildUtilityPageMetadata } from '@/lib/seo/technical';

export function generateMetadata() {
  return buildUtilityPageMetadata('Payment', '/pay-now');
}

export default function PayNowLayout({ children }: { children: React.ReactNode }) {
  return children;
}
