import { MOBILE_PUSH_PLATFORM } from '@/lib/push/constants';
import { deactivateFcmTokens, sendFcmPush, type FcmDeviceOs } from '@/lib/push/fcmPush';
import { notifyAppUninstalledWhatsApp } from '@/lib/services/appUninstalledWhatsApp';

function inferDeviceOs(deviceName: string | null | undefined): FcmDeviceOs {
  const name = String(deviceName || '').toLowerCase();
  if (name.includes('ios') || name.includes('iphone') || name.includes('ipad')) return 'ios';
  if (name.includes('android')) return 'android';
  return 'unknown';
}

async function customerHasActivePushDevices(supabaseAdmin: any, customerId: string): Promise<boolean> {
  const { count, error } = await supabaseAdmin
    .from('notification_devices')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('platform', MOBILE_PUSH_PLATFORM)
    .eq('is_active', true);

  if (error) return true;
  return (count || 0) > 0;
}

export async function maybeNotifyAppUninstalledAfterInvalidTokens(
  supabaseAdmin: any,
  invalidTokens: string[]
) {
  const tokens = [...new Set(invalidTokens.map((token) => String(token || '').trim()).filter(Boolean))];
  if (!tokens.length) return { notified: 0 };

  const { data: devices, error } = await supabaseAdmin
    .from('notification_devices')
    .select('token, customer_id')
    .in('token', tokens)
    .not('customer_id', 'is', null);

  if (error || !devices?.length) return { notified: 0 };

  const customerIds = [
    ...new Set(
      devices
        .map((row: { customer_id?: string | null }) => String(row.customer_id || '').trim())
        .filter(Boolean)
    ),
  ];

  let notified = 0;
  for (const customerId of customerIds) {
    const stillActive = await customerHasActivePushDevices(supabaseAdmin, customerId);
    if (stillActive) continue;

    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('id, phone, full_name, is_active')
      .eq('id', customerId)
      .maybeSingle();

    if (!customer || customer.is_active === false) continue;

    const phone = String(customer.phone || '').trim();
    if (!phone || phone.startsWith('del_')) continue;

    const result = await notifyAppUninstalledWhatsApp({
      customerId: customer.id,
      phone,
      customerName: customer.full_name,
    });
    if (result.sent) notified += 1;
  }

  return { notified };
}

export async function deactivateInvalidFcmTokensAndDetectUninstall(
  supabaseAdmin: any,
  invalidTokens: string[]
) {
  const tokens = [...new Set(invalidTokens.map((token) => String(token || '').trim()).filter(Boolean))];
  if (!tokens.length) return { notified: 0 };

  await deactivateFcmTokens(supabaseAdmin, tokens);
  return maybeNotifyAppUninstalledAfterInvalidTokens(supabaseAdmin, tokens);
}

export async function runAppUninstallProbeJob() {
  const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { probed: 0, invalid: 0, notified: 0, error: 'Admin client unavailable' };

  const staleBefore = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: devices, error } = await supabaseAdmin
    .from('notification_devices')
    .select('token, customer_id, device_name')
    .eq('platform', MOBILE_PUSH_PLATFORM)
    .eq('is_active', true)
    .not('customer_id', 'is', null)
    .lt('last_seen_at', staleBefore)
    .limit(150);

  if (error) return { probed: 0, invalid: 0, notified: 0, error: error.message };
  if (!devices?.length) return { probed: 0, invalid: 0, notified: 0 };

  const delivery = await sendFcmPush(
    devices.map((row: { token: string; device_name?: string | null }) => ({
      token: String(row.token),
      os: inferDeviceOs(row.device_name),
      title: 'MyFNG',
      body: ' ',
      dataOnly: true,
      data: { type: 'TOKEN_PROBE' },
    }))
  );

  const notifyResult = delivery.invalidTokens.length
    ? await deactivateInvalidFcmTokensAndDetectUninstall(supabaseAdmin, delivery.invalidTokens)
    : { notified: 0 };

  return {
    probed: devices.length,
    invalid: delivery.invalidTokens.length,
    notified: notifyResult.notified,
  };
}
