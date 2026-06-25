import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendExpoPush } from '@/lib/push/expoPush';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ROLE_OPTIONS = [
  'ALL',
  'CUSTOMER',
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'TELECALLER',
  'WORKSHOP_ADMIN',
  'WORKSHOP_SUPERVISOR',
  'WORKSHOP_MECHANIC',
  'PICKUP_BOY',
  'LEAD_MANAGER',
];

async function getPushDisabledCustomerIds(supabaseAdmin: any): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from('customer_notification_preferences')
    .select('customer_id')
    .eq('push_enabled', false);
  return new Set((data || []).map((row: any) => String(row.customer_id)));
}

function filterCustomerDeviceTokens(
  devices: Array<{ token: string; customer_id?: string | null }>,
  pushDisabledCustomerIds: Set<string>,
): string[] {
  return devices
    .filter((device) => {
      if (!device.customer_id) return true;
      return !pushDisabledCustomerIds.has(String(device.customer_id));
    })
    .map((device) => String(device.token));
}

async function assertAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, status: 401, error: 'Unauthorized', userId: '', userName: '' };
  }

  const { data: userData } = await supabase
    .from('users_login')
    .select('id, full_name, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userData as any)?.roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden', userId: '', userName: '' };
  }
  return {
    ok: true as const,
    status: 200,
    error: null,
    userId: user.id,
    userName: (userData as any)?.full_name || user.email || 'Admin',
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await assertAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const title = String(body?.title || '').trim();
    const message = String(body?.message || '').trim();
    const targetRole = String(body?.target_role || 'ALL').trim().toUpperCase();
    const priority = body?.priority === 'high' ? 'high' : 'default';
    const targetPhoneRaw = String(body?.target_phone || '').replace(/\D/g, '');
    const targetPhone = targetPhoneRaw.length >= 10 ? targetPhoneRaw.slice(-10) : '';

    if (!title || !message) {
      return NextResponse.json({ error: 'Title and message are required' }, { status: 400 });
    }
    if (!ROLE_OPTIONS.includes(targetRole)) {
      return NextResponse.json({ error: 'Invalid target role' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    let tokens: string[] = [];
    let targetCustomer: { id: string; phone: string; full_name: string | null } | null = null;
    const pushDisabledCustomerIds = await getPushDisabledCustomerIds(supabaseAdmin);

    if (targetRole === 'ALL') {
      const { data } = await supabaseAdmin
        .from('notification_devices')
        .select('token, customer_id')
        .eq('platform', 'EXPO')
        .eq('is_active', true);
      tokens = filterCustomerDeviceTokens((data || []) as any[], pushDisabledCustomerIds);
    } else if (targetRole === 'CUSTOMER') {
      if (targetPhone) {
        const { data: customer } = await supabaseAdmin
          .from('customers')
          .select('id, phone, full_name')
          .or(`phone.eq.${targetPhone},phone.eq.91${targetPhone}`)
          .maybeSingle();

        if (!customer) {
          return NextResponse.json({
            success: true,
            sent: 0,
            message: `No customer found for phone ${targetPhone}`,
            customer_found: false,
          });
        }
        targetCustomer = customer as { id: string; phone: string; full_name: string | null };

        if (pushDisabledCustomerIds.has(String(customer.id))) {
          return NextResponse.json({
            success: true,
            sent: 0,
            message: `Push notifications are turned off for ${targetPhone}.`,
            customer_found: true,
            push_disabled: true,
            target_phone: targetPhone,
          });
        }

        const { data: customerDevices } = await supabaseAdmin
          .from('notification_devices')
          .select('token')
          .eq('customer_id', customer.id)
          .eq('platform', 'EXPO')
          .eq('is_active', true);

        tokens = (customerDevices || []).map((r: any) => String(r.token));
      } else {
        const { data: customerDevices } = await supabaseAdmin
          .from('notification_devices')
          .select('token, customer_id')
          .eq('platform', 'EXPO')
          .eq('is_active', true)
          .not('customer_id', 'is', null);

        tokens = filterCustomerDeviceTokens((customerDevices || []) as any[], pushDisabledCustomerIds);
      }
    } else {
      const { data: roleUsers } = await supabaseAdmin
        .from('users_login')
        .select('id, roles!inner(role_code)')
        .eq('roles.role_code', targetRole);

      const userIds = (roleUsers || []).map((r: any) => r.id);
      if (userIds.length > 0) {
        const { data: devices } = await supabaseAdmin
          .from('notification_devices')
          .select('token')
          .eq('platform', 'EXPO')
          .eq('is_active', true)
          .in('user_id', userIds);
        tokens = (devices || []).map((r: any) => String(r.token));
      }
    }

    if (tokens.length === 0) {
      await supabaseAdmin
        .from('notification_logs')
        .insert({
          recipient: targetRole,
          type: 'PUSH_BROADCAST',
          message: `[${title}] ${message}`,
          status: 'NO_DEVICES',
          sent_at: new Date().toISOString(),
          meta: {
            target_role: targetRole,
            target_phone: targetPhone || null,
            target_customer_id: targetCustomer?.id || null,
            title,
            body: message,
            sent_by: auth.userName,
            sent_by_id: auth.userId,
            devices: 0,
            priority,
          },
        })
        .then(() => undefined, () => undefined);
      return NextResponse.json({
        success: true,
        sent: 0,
        message: targetPhone
          ? `No push token on phone ${targetPhone}. Open MyFNG app → login → allow notifications.`
          : 'No devices found for this role',
        customer_found: targetPhone ? Boolean(targetCustomer) : undefined,
        target_phone: targetPhone || undefined,
      });
    }

    const uniqueTokens = [...new Set(tokens)];
    const BATCH_SIZE = 100;
    let totalSent = 0;

    for (let i = 0; i < uniqueTokens.length; i += BATCH_SIZE) {
      const batch = uniqueTokens.slice(i, i + BATCH_SIZE);
      const messages = batch.map((token) => ({
        to: token,
        title,
        body: message,
        sound: 'default' as const,
        priority,
        data: { type: 'ADMIN_BROADCAST', sent_at: new Date().toISOString() },
      }));
      await sendExpoPush(messages as any);
      totalSent += batch.length;
    }

    await supabaseAdmin
      .from('notification_logs')
      .insert({
        recipient: targetRole,
        type: 'PUSH_BROADCAST',
        message: `[${title}] ${message}`,
        status: 'SENT',
        sent_at: new Date().toISOString(),
        meta: {
          target_role: targetRole,
          target_phone: targetPhone || null,
          target_customer_id: targetCustomer?.id || null,
          title,
          body: message,
          sent_by: auth.userName,
          sent_by_id: auth.userId,
          devices: totalSent,
          priority,
        },
      })
      .then(() => undefined, () => undefined);

    return NextResponse.json({
      success: true,
      sent: totalSent,
      target_phone: targetPhone || undefined,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}
