import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: adminError || 'Database not available', workshops: [] }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const cityParam = (searchParams.get('city') || '').trim();
  const limitParam = Number(searchParams.get('limit') || 50);
  const limit = Math.max(1, Math.min(100, Number.isFinite(limitParam) ? limitParam : 50));

  let query = supabaseAdmin
    .from('workshops')
    .select('id,name,address,city,state,pincode,phone')
    .eq('is_active', true)
    .eq('is_verified', true)
    .order('name')
    .limit(limit);

  if (cityParam) {
    query = query.ilike('city', `%${cityParam}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message, workshops: [] }, { status: 500 });
  }

  return NextResponse.json({ workshops: Array.isArray(data) ? data : [] });
}
