import { buildPageMetadata } from '@/lib/seo/metadata';
import './misa-ai.css';

export const metadata = buildPageMetadata({
  title: 'AI Car Service Booking | MyFNG',
  description:
    'Book car service instantly with MYFNG AI Booking Agent. Smart recommendations, transparent pricing & verified workshops in Mumbai, Pune & Thane.',
  keywords: [
    'AI car service booking',
    'AI car repair',
    'MYFNG AI booking',
  ],
  keyphrase: 'AI car service booking',
  canonicalPath: '/misa-ai',
  city: 'Mumbai',
});

export default function AiBookingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};
