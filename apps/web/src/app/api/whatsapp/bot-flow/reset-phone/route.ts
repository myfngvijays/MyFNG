import { NextRequest, NextResponse } from 'next/server';
import { getDbWithAdmin } from '../utils';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { normalizePhoneNumber } from '@/lib/services/whatsappService';

export async function POST(request: NextRequest) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const phone = normalizePhoneNumber(String(body?.phone || '').trim());
    const last10 = phone.slice(-10);

    if (last10.length !== 10) {
      return NextResponse.json({ error: 'Valid phone is required' }, { status: 400 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin unavailable' }, { status: 500 });
    }

    await supabaseAdmin
      .from('bot_flow_sessions')
      .delete()
      .or(`phone.eq.${phone},phone.eq.${last10},phone.eq.91${last10}`);

    await supabaseAdmin
      .from('whatsapp_agent_instances')
      .update({
        status: 'ENDED',
        end_reason: 'MANUAL',
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .or(`phone.eq.${last10},phone.eq.${phone}`)
      .in('status', ['ACTIVE', 'WAITING', 'PAUSED']);

    await supabaseAdmin
      .from('whatsapp_chat_assignments')
      .update({
        assigned_to_ids: [],
        assigned_note: 'Bot reset by admin',
        updated_at: new Date().toISOString(),
      })
      .or(`phone.eq.${phone},phone.eq.${last10},phone.eq.91${last10}`);

    return NextResponse.json({
      success: true,
      message: 'Cleared flow session, active bot instances, and human chat assignment for this phone.',
      phone,
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: String((error as { message?: string })?.message || 'Internal server error') }, { status: 500 });
  }
}
