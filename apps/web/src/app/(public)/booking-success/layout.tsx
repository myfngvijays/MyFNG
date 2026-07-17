import { buildUtilityPageMetadata } from '@/lib/seo/technical';

export function generateMetadata() {
  return buildUtilityPageMetadata('Booking Confirmed', '/booking-success');
}

export default function BookingSuccessLayout({ children }: { children: React.ReactNode }) {
  return children;
}
