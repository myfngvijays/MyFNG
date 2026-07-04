import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

const DEFAULT_STATS = {
  cars_serviced: '1 Million+',
  happy_customers: '25 Lacs+',
  avg_rating: '4.8',
  touch_points: '1000+',
  verified_workshops: '100+',
  cities_covered: '6+',
  about_description:
    "Mumbai & Pune's Trusted Multi-Brand Car Service Network — 100+ verified workshops, AI-powered booking, and transparent service for every car owner.",
  who_we_are_1:
    'MyFNG (My Friendly Neighbourhood Garage) is a network of 100+ A-Grade multi-brand car servicing workshops across Mumbai, Navi Mumbai, Thane, Palghar, Nashik, and Pune.',
  who_we_are_2:
    'We connect car owners with professional technicians, advanced diagnostic tools, and transparent pricing — so you never overpay or worry about your car\'s health again.',
};

export async function GET() {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'company_stats')
      .maybeSingle();

    let stats = DEFAULT_STATS;
    if (data?.setting_value) {
      try {
        stats = { ...DEFAULT_STATS, ...JSON.parse(data.setting_value) };
      } catch {}
    }

    return NextResponse.json({ success: true, stats });
  } catch {
    return NextResponse.json({ success: true, stats: DEFAULT_STATS });
  }
}
