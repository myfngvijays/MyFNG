import {
  faqsToPayload,
  groupFaqsBySection,
  mapPublicFaqRow,
  migrationHintForPublicFaqsError,
  normalizePublicFaqGroup,
  normalizePublicFaqPlatform,
  PUBLIC_FAQS_TABLE,
  sortPublicFaqs,
} from '@/lib/public-faqs-db';
import { platformVisibilityColumn } from '@/lib/content-platform-visibility';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const group = normalizePublicFaqGroup(request.nextUrl.searchParams.get('group') || 'GENERAL');
    const section = String(request.nextUrl.searchParams.get('section') || '').trim();
    const platform = normalizePublicFaqPlatform(request.nextUrl.searchParams.get('platform') || 'app');
    const allSections = request.nextUrl.searchParams.get('all_sections') === '1';

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ group, platform, items: [], sections: [] });
    }

    let query = supabaseAdmin
      .from(PUBLIC_FAQS_TABLE)
      .select('*')
      .order('faq_group', { ascending: true })
      .order('section_key', { ascending: true })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!allSections) query = query.eq('faq_group', group);
    if (section) query = query.eq('section_key', section);

    query = query.eq(platformVisibilityColumn(platform), true);

    let { data, error } = await query;

    if (error && /visible_app|visible_web|visible_android|visible_ios/i.test(error.message)) {
      let fallback = supabaseAdmin
        .from(PUBLIC_FAQS_TABLE)
        .select('*')
        .eq('active', true)
        .order('faq_group', { ascending: true })
        .order('section_key', { ascending: true })
        .order('display_order', { ascending: true });
      if (!allSections) fallback = fallback.eq('faq_group', group);
      if (section) fallback = fallback.eq('section_key', section);
      ({ data, error } = await fallback);
    }

    if (error) {
      if (/public_faqs/i.test(error.message)) {
        return NextResponse.json({ group, platform, items: [], sections: [] });
      }
      return NextResponse.json({ error: 'Failed to fetch FAQs', details: error.message }, { status: 500 });
    }

    const rows = sortPublicFaqs((data || []).map(mapPublicFaqRow));
    const items = faqsToPayload(rows, platform);
    const sections = groupFaqsBySection(rows, platform);

    return NextResponse.json({
      group,
      section: section || null,
      platform,
      items,
      sections,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
