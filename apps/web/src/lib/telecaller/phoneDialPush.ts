import 'server-only';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendFcmPush } from '@/lib/push/fcmPush';
import { apnsTopicForStaffDevice } from '@/lib/push/partnerDevice';
import { loadPushFirebaseConfig } from '@/lib/push/firebaseConfigStore';

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

  const pendingCutoff = new Date(Date.now() - 45_000).toISOString();
  let callLogId: string | null = null;
  let reusedPending = false;

  const { data: pendingRow } = await supabaseAdmin
    .from('telecaller_call_logs')
    .select('id, lead_id')
    .eq('telecaller_id', input.telecallerId)
    .eq('call_status', 'DEVICE_PENDING')
    .eq('phone_number', to)
    .gte('created_at', pendingCutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (pendingRow?.id && !input.alreadyDialed) {
    callLogId = String(pendingRow.id);
    reusedPending = true;
    if (!leadId && pendingRow.lead_id) {
      leadId = String(pendingRow.lead_id);
    }
  } else if (leadId) {
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

  if (reusedPending) {
    return {
      ok: true,
      callLogId,
      message: 'Call is already on your phone — open the MyFNG app if you do not see it.',
    };
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
    const pushConfig = await loadPushFirebaseConfig();
    const who = customerName || to;
    const delivery = await sendFcmPush([
      {
        token,
        title: 'Call customer',
        body: `Calling ${who}`,
        priority: 'high',
        os,
        apnsTopic: apnsTopicForStaffDevice(deviceName, pushConfig.ios_bundle_id || 'com.myfng.app'),
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
