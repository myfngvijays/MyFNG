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

  let callLogId: string | null = null;
  if (leadId) {
    const { data: inserted } = await supabaseAdmin
      .from('telecaller_call_logs')
      .insert({
        lead_id: leadId,
        telecaller_id: input.telecallerId,
        call_type: 'OUTBOUND',
        call_status: input.alreadyDialed ? 'RINGING' : 'DEVICE_PENDING',
        notes: input.alreadyDialed
          ? '[Phone dial] Dialed from the logged-in phone'
          : '[Phone dial] Waiting for the open phone app',
        phone_number: to,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();
    callLogId = inserted?.id ? String(inserted.id) : null;
  }

  if (input.alreadyDialed) {
    return { ok: true, callLogId, message: 'Opening the phone dialer' };
  }

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
  let pushed = false;
  if (token) {
    const deviceName = String((device as { device_name?: string } | null)?.device_name || '');
    const os = /ios|iphone/i.test(deviceName) ? 'ios' : 'android';
    const who = customerName || to;
    const delivery = await sendFcmPush([
      {
        token,
        title: 'Call customer',
        body: `Calling ${who}`,
        priority: 'high',
        os,
        apnsTopic: 'com.myfng.partner',
        data: {
          kind: 'SIM_DIAL',
          phone: to,
          lead_id: leadId,
          customer_name: customerName,
          call_log_id: callLogId || '',
        },
      },
    ]);
    pushed = delivery.delivered;
  }

  if (!callLogId && !pushed) {
    return {
      ok: false,
      error: 'Open the MyFNG app on your phone with this same account, then call again.',
      code: token ? 'PUSH_FAILED' : 'PHONE_OFFLINE',
    };
  }

  return {
    ok: true,
    callLogId,
    message: 'Open the MyFNG app. The lead will open and your phone will ask which line to call from.',
  };
}
