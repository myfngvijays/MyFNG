import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false, status: 403, error: 'Forbidden - Role check failed' };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin' };
  }

  return { ok: true, status: 200, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const search = String(searchParams.get('search') || '').trim();
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);

    let query = supabaseAdmin
      .from('chat_sessions')
      .select('session_id, data, expires_at')
      .order('expires_at', { ascending: false })
      .limit(Number.isFinite(limit) && limit > 0 ? limit : 100);

    if (search) {
      query = query.or(`session_id.ilike.%${search}%,data->>history.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch chat sessions' }, { status: 500 });
    }

    const sessions = (data || []).map((row: any) => {
      const sessionData = row.data || {};
      const history: { role: string; content: string }[] = sessionData.history || [];
      const bookingState = sessionData.bookingState || {};
      const messageCount = history.length;
      const firstUserMsg = history.find((m: any) => m.role === 'user')?.content || '';
      const lastMsg = history.length > 0 ? history[history.length - 1] : null;
      const hasBooking = !!(
        bookingState.customerName ||
        bookingState.phoneNumber ||
        bookingState.selectedService
      );

      return {
        session_id: row.session_id,
        expires_at: row.expires_at,
        message_count: messageCount,
        first_user_message: firstUserMsg.slice(0, 120),
        last_message_role: lastMsg?.role || null,
        last_message_preview: (lastMsg?.content || '').slice(0, 120),
        has_booking: hasBooking,
        customer_name: bookingState.customerName || null,
        phone_number: bookingState.phoneNumber || null,
        car_model: bookingState.carModel || null,
        city: bookingState.city || null,
        service: bookingState.selectedService || null,
        history,
      };
    });

    return NextResponse.json({ sessions });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
