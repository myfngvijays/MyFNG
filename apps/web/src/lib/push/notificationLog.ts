import 'server-only';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const PUSH_LOG_TYPE_BROADCAST = 'PUSH_BROADCAST';
export const PUSH_LOG_TYPE_WALLET_BULK = 'WALLET_BULK_CREDIT';

/** Log types shown in Push Notification → History */
export const PUSH_HISTORY_LOG_TYPES = [PUSH_LOG_TYPE_BROADCAST, PUSH_LOG_TYPE_WALLET_BULK] as const;

export type PushLogStatus = 'SENT' | 'FCM_FAILED' | 'NO_DEVICES' | 'PARTIAL';

export type PushNotificationLogInsert = {
  recipient: string;
  type: (typeof PUSH_HISTORY_LOG_TYPES)[number];
  message: string;
  status: PushLogStatus;
  meta?: Record<string, unknown>;
};

export async function insertPushNotificationLog(
  entry: PushNotificationLogInsert,
): Promise<{ ok: boolean; error?: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    const msg = 'Missing SUPABASE_SERVICE_ROLE_KEY — push history not saved';
    console.error('[push-log]', msg);
    return { ok: false, error: msg };
  }

  const { error } = await supabaseAdmin.from('notification_logs').insert({
    recipient: entry.recipient,
    type: entry.type,
    message: entry.message,
    status: entry.status,
    sent_at: new Date().toISOString(),
    meta: entry.meta || null,
  });

  if (error) {
    console.error('[push-log] Insert failed:', error.message, error.details);
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
