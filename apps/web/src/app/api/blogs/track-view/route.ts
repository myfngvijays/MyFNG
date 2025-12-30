import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const COOKIE_NAME = 'myfng_blog_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function getClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseAnonKey) return { supabase: null as any, error: 'Supabase configuration missing' };
  return { supabase: createClient(supabaseUrl, supabaseAnonKey), error: null };
}

function pickIp(req: NextRequest) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, error } = getClient();
    if (!supabase) return NextResponse.json({ error }, { status: 500 });

    const body = await request.json().catch(() => ({}));
    const slug = String(body?.slug || '').trim();
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const ip = pickIp(request);
    const ua = request.headers.get('user-agent') || null;

    const existingCookie = request.cookies.get(COOKIE_NAME)?.value || '';
    const sessionId = existingCookie || crypto.randomUUID();

    const { data, error: rpcErr } = await supabase.rpc('increment_blog_view', {
      p_slug: slug,
      p_session_id: sessionId,
      p_ip_address: ip,
      p_user_agent: ua,
    });
    if (rpcErr) return NextResponse.json({ error: 'Failed to track view', details: rpcErr.message }, { status: 500 });

    const res = NextResponse.json({ success: true, views: Number(data || 0), session_id: sessionId }, { status: 200 });
    if (!existingCookie) {
      res.cookies.set(COOKIE_NAME, sessionId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: COOKIE_MAX_AGE,
      });
    }
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


