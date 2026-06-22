import { mapPublicMembershipCard, sortMembershipCards } from '@/lib/membership-cards-db';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = getAdmin();
    if (!supabase) return NextResponse.json({ error: 'Database not configured' }, { status: 500 });

    const { data, error } = await supabase
      .from('membership_cards')
      .select('*')
      .eq('active', true)
      .order('display_order', { ascending: true });

    if (error) {
      if (/membership_cards|does not exist/i.test(error.message)) {
        return NextResponse.json({ cards: [] });
      }
      return NextResponse.json({ error: 'Failed to fetch cards', details: error.message }, { status: 500 });
    }

    const cards = sortMembershipCards(data || []).map(mapPublicMembershipCard);
    return NextResponse.json({ cards });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
