import 'server-only';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { executeAdminPushBroadcast } from '@/lib/push/executeAdminBroadcast';

/**
 * Sends automation templates with trigger_type=membership_expiry
 * for ACTIVE memberships whose end date is within the rule day window.
 */
export async function runMembershipExpiryPush(opts?: { dryRun?: boolean; limit?: number }) {
  const dryRun = Boolean(opts?.dryRun);
  const limit = opts?.limit ?? 300;
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) return { success: false, error: error || 'No admin', sent: 0 };

  const { data: rules, error: rulesErr } = await supabaseAdmin
    .from('push_automation_rules')
    .select(
      'id, template_id, schedule_mode, days_min, days_max, is_active, push_notification_templates(id, title, body, priority, is_active)',
    )
    .eq('trigger_type', 'membership_expiry')
    .eq('is_active', true);

  if (rulesErr) {
    if (String(rulesErr.message || '').includes('push_automation_rules')) {
      return { success: true, sent: 0, skipped: true };
    }
    return { success: false, error: rulesErr.message, sent: 0 };
  }
  if (!rules?.length) return { success: true, sent: 0, rules: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let sent = 0;
  const details: Array<{ rule: string; matched: number; delivered: number }> = [];

  for (const rule of rules) {
    const tpl = (rule as any).push_notification_templates;
    if (!tpl || tpl.is_active === false) continue;

    const { data: memberships } = await supabaseAdmin
      .from('customer_memberships')
      .select('customer_id, end_date, status')
      .eq('status', 'ACTIVE')
      .not('end_date', 'is', null)
      .limit(2000);

    const matchedPhones = new Set<string>();
    const customerIds: string[] = [];
    for (const m of memberships || []) {
      const end = new Date(String((m as any).end_date));
      if (Number.isNaN(end.getTime())) continue;
      end.setHours(0, 0, 0, 0);
      const daysLeft = Math.round((end.getTime() - today.getTime()) / 86400000);
      const min = Number(rule.days_min);
      const max = Number(rule.days_max);
      const hit =
        rule.schedule_mode === 'once_at_days'
          ? daysLeft === min
          : daysLeft >= min && daysLeft <= max;
      if (hit && (m as any).customer_id) customerIds.push(String((m as any).customer_id));
    }

    if (!customerIds.length) {
      details.push({ rule: String(rule.id), matched: 0, delivered: 0 });
      continue;
    }

    const { data: customers } = await supabaseAdmin
      .from('customers')
      .select('id, phone')
      .in('id', customerIds.slice(0, limit));

    for (const c of customers || []) {
      const phone = String((c as any).phone || '')
        .replace(/\D/g, '')
        .slice(-10);
      if (phone.length === 10) matchedPhones.add(phone);
    }

    if (dryRun) {
      details.push({ rule: String(rule.id), matched: matchedPhones.size, delivered: 0 });
      continue;
    }

    if (matchedPhones.size === 0) {
      details.push({ rule: String(rule.id), matched: 0, delivered: 0 });
      continue;
    }

    const result = await executeAdminPushBroadcast(
      {
        title: tpl.title,
        message: tpl.body,
        target_role: 'CUSTOMER',
        priority: tpl.priority === 'high' ? 'high' : 'default',
        notification_type: 'reminder',
        target_phone_list: [...matchedPhones],
      },
      { userId: 'system-automation', userName: 'Membership Expiry Automation' },
    );
    const delivered = Number(result.sent || 0);
    sent += delivered;
    details.push({ rule: String(rule.id), matched: matchedPhones.size, delivered });
  }

  return { success: true, sent, dry_run: dryRun, details };
}
