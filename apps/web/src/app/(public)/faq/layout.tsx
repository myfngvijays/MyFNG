import { buildPageMetadata } from '@/lib/seo/metadata';
import JsonLd from '@/components/seo/JsonLd';
import { faqPageSchema } from '@/lib/seo/schemas';

export const metadata = buildPageMetadata({
  title: 'FAQs - Car Service Questions Answered | MyFNG',
  description:
    'Find answers to common car service questions - periodic maintenance, AC repair, engine service, pricing, pickup & delivery, and MYFNG workshop policies.',
  keywords: [
    'car service FAQ',
    'car repair questions',
    'MYFNG FAQ',
    'car maintenance FAQ',
  ],
  keyphrase: 'car service FAQ',
  canonicalPath: '/faqs',
  city: 'Mumbai',
});

const TOP_FAQS = [
  {
    question: 'What is My FNG?',
    answer:
      'My FNG - Friendly Neighbourhood Garage is a network of over 100+ A Grade Multi-brand Car Servicing and Repair Stations across Mumbai, Navi Mumbai, Thane, Palghar, Nashik and Pune.',
  },
  {
    question: 'How can I book a service appointment with My FNG?',
    answer:
      'You can book service via MyFNG AI Booking Agent at https://myfng.in/ai-booking or online through our website www.myfng.in/book-service or by calling our customer support.',
  },
  {
    question: 'What services does My FNG Offer?',
    answer:
      'My FNG offers routine maintenance, oil changes, brake repairs, engine diagnostics, tyre services and complex repairs at verified workshops.',
  },
];

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={faqPageSchema(TOP_FAQS)} />
      {children}
    </>
  );
}
