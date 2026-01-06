import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const endpoint = String(body?.endpoint || '').trim();
    const p256dh = String(body?.p256dh || '').trim();
    const auth = String(body?.auth || '').trim();
    const expiration_time =
      body?.expiration_time === null || body?.expiration_time === undefined
        ? null
        : Number(body.expiration_time);

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'endpoint, p256dh, auth are required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const userAgent = request.headers.get('user-agent') || null;

    const { error } = await supabase
      .from('web_push_subscriptions')
      .upsert(
        {
          user_id: user.id,
          endpoint,
          p256dh,
          auth,
          expiration_time: Number.isFinite(expiration_time as any) ? expiration_time : null,
          user_agent: userAgent,
          is_active: true,
          last_seen_at: now,
          updated_at: now,
        } as any,
        { onConflict: 'user_id,endpoint' }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


