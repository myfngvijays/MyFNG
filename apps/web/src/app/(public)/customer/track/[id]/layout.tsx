import { buildUtilityPageMetadata } from '@/lib/seo/technical';

export function generateMetadata() {
  return buildUtilityPageMetadata('Track Booking', '/customer/track');
}

export default function CustomerTrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
