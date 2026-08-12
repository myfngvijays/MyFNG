import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { verifyLinkPassword } from '@/lib/link-manager/advanced';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const shortCode = String(body?.short_code || '').trim().toLowerCase();
    const password = String(body?.password || '');
    if (!shortCode || !password) {
      return NextResponse.json({ error: 'short_code and password required' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 });

    const { data: link } = await supabaseAdmin
      .from('managed_short_links')
      .select('id, password_hash, is_active')
      .eq('short_code', shortCode)
      .eq('is_active', true)
      .maybeSingle();

    if (!link?.password_hash) {
      return NextResponse.json({ error: 'Link is not password protected' }, { status: 400 });
    }
    if (!verifyLinkPassword(password, link.password_hash)) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 403 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(`sl_unlock_${shortCode}`, '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 6,
    });
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unlock failed' }, { status: 500 });
  }
}
