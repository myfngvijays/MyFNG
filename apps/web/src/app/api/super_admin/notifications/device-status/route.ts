import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { MOBILE_PUSH_PLATFORM } from '@/lib/push/constants';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizePhone(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userData as any)?.roles?.role_code;
    if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const phone = normalizePhone(String(new URL(request.url).searchParams.get('phone') || ''));
    if (phone.length !== 10) {
      return NextResponse.json({ error: 'Valid 10-digit phone is required' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id, phone, full_name')
      .or(`phone.eq.${phone},phone.eq.91${phone}`)
      .maybeSingle();

    if (!customer) {
      return NextResponse.json({
        phone,
        customer_found: false,
        device_count: 0,
        devices: [],
      });
    }

    const { data: devices } = await supabaseAdmin
      .from('notification_devices')
      .select('id, token, platform, is_active, device_name, last_seen_at')
      .eq('customer_id', customer.id)
      .eq('platform', MOBILE_PUSH_PLATFORM)
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false });

    return NextResponse.json({
      phone,
      customer_found: true,
      customer: {
        id: customer.id,
        phone: customer.phone,
        full_name: customer.full_name,
      },
      device_count: (devices || []).length,
      devices: (devices || []).map((d: any) => ({
        id: d.id,
        platform: d.platform,
        device_name: d.device_name,
        last_seen_at: d.last_seen_at,
        token_preview: String(d.token || '').slice(0, 28) + '…',
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
