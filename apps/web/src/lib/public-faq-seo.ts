import { unstable_cache } from 'next/cache';
import {
  faqsToPayload,
  mapPublicFaqRow,
  PUBLIC_FAQS_TABLE,
  sortPublicFaqs,
} from '@/lib/public-faqs-db';
import { platformVisibilityColumn } from '@/lib/content-platform-visibility';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const PUBLIC_FAQ_SEO_TAG = 'public-faq-seo';

const FALLBACK_FAQS = [
  {
    question: 'What is My FNG?',
    answer:
      'My FNG - Friendly Neighbourhood Garage is a network of over 100+ A Grade Multi-brand Car Servicing and Repair Stations across Mumbai, Navi Mumbai, Thane, Palghar, Nashik and Pune.',
  },
  {
    question: 'How can I book a service appointment with My FNG?',
    answer:
      'You can book service via MyFNG AI Booking Agent at https://myfng.in/misa-ai or online through our website www.myfng.in/book-service or by calling our customer support.',
  },
  {
    question: 'What services does My FNG Offer?',
    answer:
      'My FNG offers routine maintenance, oil changes, brake repairs, engine diagnostics, tyre services and complex repairs at verified workshops.',
  },
];

async function fetchWebFaqsForSchema(limit = 20) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return FALLBACK_FAQS;

  let query = supabaseAdmin
    .from(PUBLIC_FAQS_TABLE)
    .select('*')
    .order('faq_group', { ascending: true })
    .order('section_key', { ascending: true })
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true });

  query = query.eq(platformVisibilityColumn('web'), true);

  let { data, error } = await query;

  if (error && /visible_app|visible_web|visible_android|visible_ios/i.test(error.message)) {
    ({ data, error } = await supabaseAdmin
      .from(PUBLIC_FAQS_TABLE)
      .select('*')
      .eq('active', true)
      .order('faq_group', { ascending: true })
      .order('section_key', { ascending: true })
      .order('display_order', { ascending: true }));
  }

  if (error || !data?.length) return FALLBACK_FAQS;

  const rows = sortPublicFaqs(data.map(mapPublicFaqRow));
  const items = faqsToPayload(rows, 'web')
    .slice(0, limit)
    .map((item) => ({ question: item.q, answer: item.a }))
    .filter((item) => item.question && item.answer);

  return items.length ? items : FALLBACK_FAQS;
}

export const getWebFaqsForSchema = unstable_cache(fetchWebFaqsForSchema, ['web-faqs-schema'], {
  tags: [PUBLIC_FAQ_SEO_TAG],
  revalidate: 3600,
});
