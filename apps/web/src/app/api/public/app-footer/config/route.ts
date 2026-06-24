import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getAppFooterConfig } from '@/lib/app-footer-config';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    const config = await getAppFooterConfig(supabaseAdmin);
    return NextResponse.json({ success: true, config });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
