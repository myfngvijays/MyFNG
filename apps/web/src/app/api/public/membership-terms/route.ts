import {
  mapMembershipTermRow,
  MEMBERSHIP_TERMS_TABLE,
  migrationHintForMembershipTermsError,
  normalizeMembershipTermPlatform,
  normalizeMembershipTermType,
  sortMembershipTerms,
  termsToPublicPayload,
} from '@/lib/membership-terms-db';
import { platformVisibilityColumn } from '@/lib/content-platform-visibility';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const DEFAULT_RSA_TERMS = [
  'Members are entitled to 2 free RSA services per year under all plans, excluding the Premium Plan.',
  'Towing distance is calculated on a round-trip basis (from the service provider’s location to the vehicle’s location and then to the destination).',
  'Key Unlock Assistance is subject to the type of lock system used in the vehicle.',
  'On-Spot Minor Repairs are limited to small fixes that can be completed without requiring extensive tools or garage equipment.',
  'Hotel accommodation is subject to availability and limited to one night.',
  'Cab arrangement is limited to 50 km and additional charges may apply for distances exceeding this limit.',
  'Ambulance service is provided in case of accidents only and is subject to availability.',
];

const DEFAULT_SERVICE_TERMS = [
  'Membership is valid for 12 months from the date of activation.',
  '10% off on periodic service packages applies at checkout, subject to the benefit cap shown on your plan.',
  '5% cashback is auto-credited to your MyFNG wallet within 48 hours of eligible service completion.',
  'Free top-up & inspection and free car scanning are limited to 2 visits each per membership year.',
  'Free insurance claim assistance covers assessment, documentation and claim support only.',
  'Prime personal WhatsApp group access is activated within 24 hours of membership purchase.',
  'Priority slot booking gives preferential workshop slots subject to availability.',
  '6-month extended warranty applies on eligible services completed during active membership.',
  'Free pickup & drop is included on eligible periodic services during active membership.',
  '2nd car add-on (if purchased) shares the same validity period as your primary car membership.',
  'Membership is non-transferable and linked to your verified mobile number.',
];

function defaultTerms(type: ReturnType<typeof normalizeMembershipTermType>) {
  return type === 'RSA' ? DEFAULT_RSA_TERMS : DEFAULT_SERVICE_TERMS;
}

export async function GET(request: NextRequest) {
  try {
    const type = normalizeMembershipTermType(request.nextUrl.searchParams.get('type') || 'RSA');
    const platform = normalizeMembershipTermPlatform(request.nextUrl.searchParams.get('platform') || 'app');
    const defaults = defaultTerms(type);

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ membership_type: type, platform, terms: defaults });
    }

    let query = supabaseAdmin
      .from(MEMBERSHIP_TERMS_TABLE)
      .select('*')
      .eq('membership_type', type)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true });

    query = query.eq(platformVisibilityColumn(platform), true);

    let { data, error } = await query;

    if (error && /visible_app|visible_web|visible_android|visible_ios/i.test(error.message)) {
      ({ data, error } = await supabaseAdmin
        .from(MEMBERSHIP_TERMS_TABLE)
        .select('*')
        .eq('membership_type', type)
        .eq('active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }));
    }

    if (error) {
      if (/membership_terms/i.test(error.message)) {
        return NextResponse.json({ membership_type: type, platform, terms: defaults });
      }
      return NextResponse.json({ error: 'Failed to fetch terms', details: error.message }, { status: 500 });
    }

    const rows = sortMembershipTerms((data || []).map(mapMembershipTermRow));
    const terms = termsToPublicPayload(rows, platform);
    return NextResponse.json({
      membership_type: type,
      platform,
      terms: terms.length ? terms : defaults,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
