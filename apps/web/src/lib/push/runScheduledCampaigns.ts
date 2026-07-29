import 'server-only';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { executeAdminPushBroadcast } from '@/lib/push/executeAdminBroadcast';

export async function runScheduledPushCampaigns(opts?: { limit?: number; dryRun?: boolean }) {
  const limit = opts?.limit ?? 20;
  const dryRun = Boolean(opts?.dryRun);
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { success: false, error: adminError || 'Admin client missing', processed: 0 };
  }

  const nowIso = new Date().toISOString();
  const { data: due, error } = await supabaseAdmin
    .from('push_scheduled_campaigns')
    .select('id, name, payload, ab_enabled, variant_b, scheduled_at, created_by')
    .eq('status', 'scheduled')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(limit);

  if (error) {
    if (String(error.message || '').includes('push_scheduled_campaigns')) {
      return {
        success: true,
        processed: 0,
        skipped: true,
        hint: 'Run database/294_push_campaigns_segments_schedule.sql',
      };
    }
    return { success: false, error: error.message, processed: 0 };
  }

  if (!due?.length) {
    return { success: true, processed: 0, results: [] as unknown[] };
  }

  if (dryRun) {
    return {
      success: true,
      dry_run: true,
      processed: due.length,
      campaigns: due.map((c: { id: string }) => c.id),
    };
  }

  const results: Array<{ id: string; status: string; sent?: number; error?: string }> = [];

  for (const campaign of due) {
    const id = String(campaign.id);
    await supabaseAdmin
      .from('push_scheduled_campaigns')
      .update({ status: 'sending', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'scheduled');

    const auth = {
      userId: String(campaign.created_by || 'system-cron'),
      userName: 'Scheduled Campaign',
    };

    try {
      const basePayload = { ...(campaign.payload || {}), campaign_id: id } as Record<string, unknown>;

      if (campaign.ab_enabled && campaign.variant_b) {
        const variantB = campaign.variant_b as { title?: string; message?: string };
        const resultA = await executeAdminPushBroadcast({ ...basePayload, ab_variant: 'A' }, auth);
        const resultB = await executeAdminPushBroadcast(
          {
            ...basePayload,
            title: variantB.title || basePayload.title,
            message: variantB.message || basePayload.message,
            ab_variant: 'B',
          },
          auth,
        );
        const sent = Number(resultA.sent || 0) + Number(resultB.sent || 0);
        const failed = Boolean(resultA.error && resultA.success !== true && resultB.error && resultB.success !== true);
        await supabaseAdmin
          .from('push_scheduled_campaigns')
          .update({
            status: failed ? 'failed' : 'sent',
            sent_at: new Date().toISOString(),
            result: { a: resultA, b: resultB },
            notification_log_id: resultA.notification_log_id || resultB.notification_log_id || null,
            error_message: failed ? resultA.error || resultB.error || 'A/B send failed' : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        results.push({ id, status: failed ? 'failed' : 'sent', sent });
      } else {
        const result = await executeAdminPushBroadcast(basePayload, auth);
        const failed = Boolean(result.error && result.success !== true && result.status && result.status >= 400);
        await supabaseAdmin
          .from('push_scheduled_campaigns')
          .update({
            status: failed ? 'failed' : 'sent',
            sent_at: new Date().toISOString(),
            result,
            notification_log_id: result.notification_log_id || null,
            error_message: failed ? result.error || result.message || 'Send failed' : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        results.push({
          id,
          status: failed ? 'failed' : 'sent',
          sent: result.sent,
          error: failed ? result.error : undefined,
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from('push_scheduled_campaigns')
        .update({
          status: 'failed',
          error_message: msg,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      results.push({ id, status: 'failed', error: msg });
    }
  }

  return { success: true, processed: results.length, results };
}
