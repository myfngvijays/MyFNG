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
    if (!endpoint) return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });

    const { error } = await supabase
      .from('web_push_subscriptions')
      .update({ is_active: false, updated_at: new Date().toISOString() } as any)
      .eq('user_id', user.id)
      .eq('endpoint', endpoint);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


