import { buildUtilityPageMetadata } from '@/lib/seo/technical';

export function generateMetadata() {
  return buildUtilityPageMetadata('Booking Details', '/book-service/details');
}

export default function BookServiceDetailsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
