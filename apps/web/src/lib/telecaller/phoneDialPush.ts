import 'server-only';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendFcmPush } from '@/lib/push/fcmPush';

type DialPushInput = {
  telecallerId: string;
  to: string;
  leadId?: string | null;
  customerName?: string | null;
  /** Phone already opened the dialer. Only write the lead call log. */
  alreadyDialed?: boolean;
};

export async function sendPhoneDial(input: DialPushInput): Promise<{
  ok: boolean;
  error?: string;
  code?: string;
  message?: string;
  callLogId?: string | null;
}> {
  const to = String(input.to || '').replace(/\D/g, '').slice(-10);
  if (to.length < 8) {
    return { ok: false, error: 'Customer phone is missing', code: 'BAD_PHONE' };
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { ok: false, error: 'Call service is not configured', code: 'NO_ADMIN' };
  }

  let leadId = String(input.leadId || '').trim();
  let customerName = String(input.customerName || '').trim();

  if (!leadId) {
    const { data: hit } = await supabaseAdmin
      .from('service_leads')
      .select('id, customer_name')
      .or(`customer_phone.eq.${to},customer_phone.eq.91${to},customer_phone.eq.+91${to}`)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (hit?.id) {
      leadId = String(hit.id);
      if (!customerName) customerName = String((hit as { customer_name?: string }).customer_name || '');
    }
  } else if (!customerName) {
    const { data: lead } = await supabaseAdmin
      .from('service_leads')
      .select('customer_name')
      .eq('id', leadId)
      .maybeSingle();
    customerName = String((lead as { customer_name?: string } | null)?.customer_name || '');
  }

  if (!input.alreadyDialed) {
    const { data: device } = await supabaseAdmin
      .from('notification_devices')
      .select('token, device_name')
      .eq('user_id', input.telecallerId)
      .eq('platform', 'FCM')
      .eq('is_active', true)
      .order('last_seen_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const token = String((device as { token?: string } | null)?.token || '');
    if (!token) {
      return {
        ok: false,
        error: 'Phone app is not logged in. Open MyFNG on your phone with this same account, then call again.',
        code: 'PHONE_OFFLINE',
      };
    }

    const deviceName = String((device as { device_name?: string } | null)?.device_name || '');
    const os = /ios|iphone/i.test(deviceName) ? 'ios' : 'android';
    const who = customerName || to;
    const delivery = await sendFcmPush([
      {
        token,
        title: 'Call customer',
        body: os === 'ios' ? `Tap to call ${who}` : `Calling ${who}`,
        priority: 'high',
        os,
        data: {
          kind: 'SIM_DIAL',
          phone: to,
          lead_id: leadId,
          customer_name: customerName,
        },
      },
    ]);

    if (!delivery.delivered) {
      return {
        ok: false,
        error: 'Could not reach your phone. Open the MyFNG app and try again.',
        code: 'PUSH_FAILED',
      };
    }
  }

  let callLogId: string | null = null;
  if (leadId) {
    const { data: inserted } = await supabaseAdmin
      .from('telecaller_call_logs')
      .insert({
        lead_id: leadId,
        telecaller_id: input.telecallerId,
        call_type: 'OUTBOUND',
        call_status: 'RINGING',
        notes: input.alreadyDialed
          ? '[Phone dial] Dialed from the logged-in phone'
          : '[Phone dial] Sent to the logged-in phone',
        phone_number: to,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();
    callLogId = inserted?.id ? String(inserted.id) : null;
  }

  return {
    ok: true,
    callLogId,
    message: input.alreadyDialed
      ? 'Opening the phone dialer'
      : 'Call sent to your logged-in phone. It will dial the customer.',
  };
}
