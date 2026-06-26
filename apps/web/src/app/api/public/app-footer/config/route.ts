import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getAppFooterConfig } from '@/lib/app-footer-config';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function GET() {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    const config = await getAppFooterConfig(supabaseAdmin);
    return NextResponse.json({ success: true, config }, { headers: NO_STORE_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
