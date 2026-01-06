import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { dispatchPushToUser } from '@/lib/push/dispatchPush';
import type { NotificationPriority, NotificationType } from '@/shared/types/notifications';

export const dynamic = 'force-dynamic';

function assertCronAuth(req: NextRequest): string | null {
  const secret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
  if (!secret) return 'CRON secret is not configured on server';

  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== secret) return 'Unauthorized';
  return null;
}

function isoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

async function alreadyNotified(params: {
  leadId: string;
  kind: string;
  withinMinutes: number;
}) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return false;

  try {
    const since = isoMinutesAgo(params.withinMinutes);
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('lead_id', params.leadId)
      // JSONB filter; if metadata is NULL this won't match.
      .filter('metadata->>kind', 'eq', params.kind)
      .gte('created_at', since)
      .limit(1);

    if (error) return false;
    return (data?.length || 0) > 0;
  } catch {
    // If JSON filtering is unsupported in this environment, skip dedupe rather than failing the cron.
    return false;
  }
}

async function alreadyNotifiedForUser(params: {
  userId: string;
  kind: string;
  sinceIso: string;
  title?: string;
}) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return false;

  try {
    let q = supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('user_id', params.userId)
      .gte('created_at', params.sinceIso)
      .limit(1);

    // Prefer metadata kind if possible
    q = q.filter('metadata->>kind', 'eq', params.kind);
    if (params.title) q = q.eq('title', params.title);

    const { data, error } = await q;
    if (error) return false;
    return (data?.length || 0) > 0;
  } catch {
    // Fallback if JSON operators are not supported by the query layer
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('id, title, metadata')
        .eq('user_id', params.userId)
        .gte('created_at', params.sinceIso)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) return false;
      return (data || []).some((n: any) => {
        const kind = n?.metadata?.kind;
        if (kind !== params.kind) return false;
        if (params.title && n?.title !== params.title) return false;
        return true;
      });
    } catch {
      return false;
    }
  }
}

async function getRoleIds(roleCodes: string[]): Promise<string[]> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin.from('roles').select('id, role_code').in('role_code', roleCodes as any);
  return (data || []).map((r: any) => String(r.id));
}

async function getUsersInWorkshopByRoleCodes(workshopId: string, roleCodes: string[]): Promise<string[]> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];
  const roleIds = await getRoleIds(roleCodes);
  if (roleIds.length === 0) return [];

  const { data } = await supabaseAdmin
    .from('users_login')
    .select('id')
    .eq('workshop_id', workshopId)
    .in('role_id', roleIds as any)
    .eq('is_active', true);

  return (data || []).map((u: any) => String(u.id));
}

async function createNotificationsAdmin(rows: any[]) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  const { data, error } = await supabaseAdmin.from('notifications').insert(rows).select();
  if (error) return [];
  const inserted = (data || []) as any[];

  // Best-effort push fanout
  for (const n of inserted) {
    const uid = String(n.user_id || '');
    if (uid) void dispatchPushToUser(uid, n as any);
  }
  return inserted;
}

async function notifyWorkshopRolesAdmin(params: {
  workshopId: string;
  roleCodes: string[];
  type: NotificationType;
  title: string;
  message: string;
  priority: NotificationPriority;
  leadId?: string;
  leadNumber?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}) {
  const userIds: string[] = await getUsersInWorkshopByRoleCodes(params.workshopId, params.roleCodes);
  if (userIds.length === 0) return;

  const nowIso = new Date().toISOString();
  await createNotificationsAdmin(
    userIds.map((userId: string) => ({
      user_id: userId,
      type: params.type,
      title: params.title,
      message: params.message,
      priority: params.priority,
      lead_id: params.leadId || null,
      lead_number: params.leadNumber || null,
      action_url: params.actionUrl || null,
      metadata: params.metadata || null,
      is_read: false,
      created_at: nowIso,
    }))
  );
}

async function runSlaCron() {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, error: 'Supabase admin client not available' };

  const nowIso = new Date().toISOString();

  // 1) SLA warning / breach: Workshop has not accepted the lead within SLA.
  // lead-manager assignment sets: status='ASSIGNED_TO_WORKSHOP', sla_accept_deadline, workshop_id.
  const { data: pendingAcceptance } = await supabaseAdmin
    .from('service_leads')
    .select('id, lead_number, workshop_id, lead_manager_assigned_id, sla_accept_deadline, status, accepted_at')
    .eq('status', 'ASSIGNED_TO_WORKSHOP')
    .not('workshop_id', 'is', null)
    .is('accepted_at', null)
    .not('sla_accept_deadline', 'is', null)
    .limit(500);

  for (const lead of pendingAcceptance || []) {
    const leadId = (lead as any).id as string;
    const workshopId = (lead as any).workshop_id as string;
    const leadNumber = (lead as any).lead_number || leadId;
    const deadlineIso = (lead as any).sla_accept_deadline as string;
    const deadlineTs = new Date(deadlineIso).getTime();
    const nowTs = Date.now();
    const minutesToDeadline = Math.ceil((deadlineTs - nowTs) / 60_000);

    if (minutesToDeadline <= 5 && minutesToDeadline > 0) {
      if (await alreadyNotified({ leadId, kind: 'SLA_ACCEPT_WARNING', withinMinutes: 20 })) continue;

      await notifyWorkshopRolesAdmin({
        workshopId,
        roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
        type: 'SLA_WARNING',
        title: 'SLA Warning: Lead not accepted',
        message: `Lead ${leadNumber} must be accepted within ${minutesToDeadline} minutes.`,
        priority: 'URGENT' as NotificationPriority,
        leadId,
        leadNumber,
        actionUrl: '/dashboard/workshop_admin/pending-leads',
        metadata: { kind: 'SLA_ACCEPT_WARNING', sla_accept_deadline: deadlineIso, remaining_minutes: minutesToDeadline },
      });
    }

    if (minutesToDeadline <= 0) {
      if (await alreadyNotified({ leadId, kind: 'SLA_ACCEPT_BREACHED', withinMinutes: 24 * 60 })) continue;

      await notifyWorkshopRolesAdmin({
        workshopId,
        roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
        type: 'SLA_WARNING',
        title: 'SLA Breached: Lead not accepted',
        message: `Lead ${leadNumber} was not accepted within SLA. Please review immediately.`,
        priority: 'URGENT' as NotificationPriority,
        leadId,
        leadNumber,
        actionUrl: '/dashboard/workshop_admin/pending-leads',
        metadata: { kind: 'SLA_ACCEPT_BREACHED', sla_accept_deadline: deadlineIso, breached_at: nowIso },
      });

      // Notify Lead Manager as well (so they can reassign)
      const leadManagerId = (lead as any).lead_manager_assigned_id as string | null | undefined;
      if (leadManagerId) {
        await createNotificationsAdmin([
          {
            user_id: leadManagerId,
            type: 'SLA_WARNING',
            title: 'Workshop SLA breached',
            message: `Workshop did not accept lead ${leadNumber} within SLA. Consider reassignment.`,
            priority: 'HIGH' as NotificationPriority,
            lead_id: leadId,
            lead_number: leadNumber,
            action_url: `/dashboard/lead_manager/leads/${leadId}`,
            metadata: { kind: 'SLA_ACCEPT_BREACHED_LM', sla_accept_deadline: deadlineIso },
            is_read: false,
            created_at: nowIso,
          },
        ]);
      }

      // Optional auto action (disabled by default)
      if (process.env.CRON_ENABLE_AUTO_ACTIONS === '1') {
        try {
          await supabaseAdmin
            .from('service_leads')
            .update({
              status: 'VALIDATED',
              workshop_id: null,
              sla_status: 'BREACHED',
              updated_at: nowIso,
            } as any)
            .eq('id', leadId);
        } catch {
          // ignore; notifications still went out
        }
      }
    }
  }

  // 2) Pickup assignment pending: pickup required but pickup boy not assigned after acceptance.
  const { data: pickupPending } = await supabaseAdmin
    .from('service_leads')
    .select('id, lead_number, workshop_id, accepted_at, pickup_required, assigned_pickup_boy_id, status')
    .not('workshop_id', 'is', null)
    .eq('pickup_required', true as any)
    .is('assigned_pickup_boy_id', null)
    .not('accepted_at', 'is', null)
    .limit(500);

  for (const lead of pickupPending || []) {
    const acceptedAt = new Date((lead as any).accepted_at).getTime();
    if (Date.now() - acceptedAt < 30 * 60_000) continue; // 30 minutes grace

    const leadId = (lead as any).id as string;
    const workshopId = (lead as any).workshop_id as string;
    const leadNumber = (lead as any).lead_number || leadId;

    if (await alreadyNotified({ leadId, kind: 'PICKUP_ASSIGNMENT_PENDING', withinMinutes: 60 })) continue;

    await notifyWorkshopRolesAdmin({
      workshopId,
      roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
      type: 'SYSTEM_ALERT',
      title: 'Pickup assignment pending',
      message: `Lead ${leadNumber}: pickup is required but not assigned.`,
      priority: 'HIGH' as NotificationPriority,
      leadId,
      leadNumber,
      actionUrl: `/dashboard/workshop_admin/leads/${leadId}/assign-team`,
      metadata: { kind: 'PICKUP_ASSIGNMENT_PENDING' },
    });
  }

  // 3) Staff assignment pending: accepted but mechanic/supervisor not assigned after some time.
  const { data: staffPending } = await supabaseAdmin
    .from('service_leads')
    .select('id, lead_number, workshop_id, accepted_at, assigned_mechanic_id, assigned_supervisor_id, status')
    .not('workshop_id', 'is', null)
    .not('accepted_at', 'is', null)
    .limit(500);

  for (const lead of staffPending || []) {
    const acceptedAtIso = (lead as any).accepted_at as string | null;
    if (!acceptedAtIso) continue;
    const acceptedAt = new Date(acceptedAtIso).getTime();
    if (Date.now() - acceptedAt < 60 * 60_000) continue; // 60 minutes grace

    const mechanicId = (lead as any).assigned_mechanic_id as string | null;
    const supervisorId = (lead as any).assigned_supervisor_id as string | null;
    if (mechanicId && supervisorId) continue;

    const leadId = (lead as any).id as string;
    const workshopId = (lead as any).workshop_id as string;
    const leadNumber = (lead as any).lead_number || leadId;

    if (await alreadyNotified({ leadId, kind: 'STAFF_ASSIGNMENT_PENDING', withinMinutes: 60 })) continue;

    await notifyWorkshopRolesAdmin({
      workshopId,
      roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
      type: 'SYSTEM_ALERT',
      title: 'Staff assignment pending',
      message: `Lead ${leadNumber}: assign ${!supervisorId ? 'supervisor' : ''}${!supervisorId && !mechanicId ? ' & ' : ''}${!mechanicId ? 'mechanic' : ''}.`,
      priority: 'HIGH' as NotificationPriority,
      leadId,
      leadNumber,
      actionUrl: `/dashboard/workshop_admin/leads/${leadId}/assign-team`,
      metadata: { kind: 'STAFF_ASSIGNMENT_PENDING', missing_supervisor: !supervisorId, missing_mechanic: !mechanicId },
    });
  }

  // 4) Invoice generation pending: QC approved/ready for billing but invoice not generated.
  const { data: invoicePending } = await supabaseAdmin
    .from('service_leads')
    .select('id, lead_number, workshop_id, status, updated_at, invoice_id')
    .not('workshop_id', 'is', null)
    .in('status', ['QC_APPROVED', 'READY_FOR_BILLING', 'AUDIT_APPROVED'] as any)
    .is('invoice_id', null)
    .limit(500);

  for (const lead of invoicePending || []) {
    const updatedAt = new Date((lead as any).updated_at).getTime();
    if (Date.now() - updatedAt < 60 * 60_000) continue; // 60 minutes grace

    const leadId = (lead as any).id as string;
    const workshopId = (lead as any).workshop_id as string;
    const leadNumber = (lead as any).lead_number || leadId;

    if (await alreadyNotified({ leadId, kind: 'INVOICE_GENERATION_PENDING', withinMinutes: 6 * 60 })) continue;

    await notifyWorkshopRolesAdmin({
      workshopId,
      roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
      type: 'SYSTEM_ALERT',
      title: 'Invoice generation pending',
      message: `Lead ${leadNumber}: please generate invoice (billing SLA).`,
      priority: 'HIGH' as NotificationPriority,
      leadId,
      leadNumber,
      actionUrl: `/dashboard/billing/leads/${leadId}/generate-invoice`,
      metadata: { kind: 'INVOICE_GENERATION_PENDING' },
    });
  }

  // 5) Payment pending/failed: invoice exists but payment not completed (non-COD).
  const { data: unpaidInvoices } = await supabaseAdmin
    .from('invoices')
    .select('id, lead_id, payment_status, updated_at')
    .in('payment_status', ['PENDING', 'FAILED'] as any)
    .limit(500);

  for (const inv of unpaidInvoices || []) {
    const leadId = (inv as any).lead_id as string | null;
    if (!leadId) continue;

    const updatedAt = new Date((inv as any).updated_at || nowIso).getTime();
    if (Date.now() - updatedAt < 60 * 60_000) continue; // 60 minutes grace

    // Fetch lead workshop + lead number
    const { data: lead } = await supabaseAdmin
      .from('service_leads')
      .select('id, lead_number, workshop_id')
      .eq('id', leadId)
      .maybeSingle();

    const workshopId = (lead as any)?.workshop_id as string | null | undefined;
    if (!workshopId) continue;
    const leadNumber = (lead as any)?.lead_number || leadId;

    if (await alreadyNotified({ leadId, kind: 'PAYMENT_PENDING', withinMinutes: 6 * 60 })) continue;

    const payStatus = String((inv as any).payment_status || 'PENDING');
    await notifyWorkshopRolesAdmin({
      workshopId,
      roleCodes: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'],
      type: 'SYSTEM_ALERT',
      title: payStatus === 'FAILED' ? 'Payment failed' : 'Payment pending',
      message: `Lead ${leadNumber}: payment is ${payStatus.toLowerCase()}. Please coordinate with Telecaller/CSE.`,
      priority: (payStatus === 'FAILED' ? 'HIGH' : 'MEDIUM') as NotificationPriority,
      leadId,
      leadNumber,
      actionUrl: `/dashboard/workshop_admin/leads/${leadId}`,
      metadata: { kind: 'PAYMENT_PENDING', payment_status: payStatus, invoice_id: (inv as any).id },
    });
  }

  return { ok: true };
}

async function runDailySummaryCron(opts: { dayStartIso: string; dayEndIso: string; dateLabel: string }) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, error: 'Supabase admin client not available' };

  // Find all workshops that have at least one active Workshop Admin
  const [adminRoleId] = await getRoleIds(['WORKSHOP_ADMIN']);
  if (!adminRoleId) return { ok: true, workshops: 0, admins: 0, note: 'No WORKSHOP_ADMIN role found' };

  const { data: adminUsers, error: adminErr } = await supabaseAdmin
    .from('users_login')
    .select('id, workshop_id')
    .eq('role_id', adminRoleId as any)
    .eq('is_active', true)
    .not('workshop_id', 'is', null);

  if (adminErr) return { ok: false, error: 'Failed to load workshop admins' };

  const byWorkshop = new Map<string, string[]>();
  for (const u of adminUsers || []) {
    const wid = String((u as any).workshop_id);
    const uid = String((u as any).id);
    if (!wid || !uid) continue;
    const arr = byWorkshop.get(wid) || [];
    arr.push(uid);
    byWorkshop.set(wid, arr);
  }

  let workshopsProcessed = 0;
  let adminsNotified = 0;

  const pendingStatuses = [
    'ASSIGNED_TO_WORKSHOP',
    'ACCEPTED',
    'IN_PROGRESS',
    'WORK_COMPLETED',
    'QC_PENDING',
    'QC_APPROVED',
    'READY_FOR_BILLING',
    'AUDIT_PENDING',
    'AUDIT_FLAGGED',
    'AUDIT_APPROVED',
    'READY_FOR_DELIVERY',
    'COD_PENDING',
  ];

  for (const [workshopId, userIds] of byWorkshop.entries()) {
    workshopsProcessed += 1;

    // Completed (best-effort): moved to a final status during the window.
    // This avoids complex OR conditions across delivered_at/completed_at (which can vary by flow).
    const finalStatuses = ['DELIVERED_TO_CUSTOMER', 'DELIVERED', 'CLOSED', 'COMPLETED'];
    const { count: completedCount } = await supabaseAdmin
      .from('service_leads')
      .select('id', { count: 'exact', head: true })
      .eq('workshop_id', workshopId)
      .in('status', finalStatuses as any)
      .gte('updated_at', opts.dayStartIso)
      .lt('updated_at', opts.dayEndIso);

    // Pending snapshot (as of dayEnd)
    const { count: pendingCount } = await supabaseAdmin
      .from('service_leads')
      .select('id', { count: 'exact', head: true })
      .eq('workshop_id', workshopId)
      .in('status', pendingStatuses as any)
      .lt('created_at', opts.dayEndIso);

    // SLA breaches (updated during window)
    const { count: slaBreaches } = await supabaseAdmin
      .from('service_leads')
      .select('id', { count: 'exact', head: true })
      .eq('workshop_id', workshopId)
      .eq('sla_status', 'BREACHED' as any)
      .gte('updated_at', opts.dayStartIso)
      .lt('updated_at', opts.dayEndIso);

    const title = `Daily Summary (${opts.dateLabel})`;
    const message = `Jobs Completed: ${completedCount || 0} • Pending: ${pendingCount || 0} • SLA Breaches: ${slaBreaches || 0}`;

    const nowIso = new Date().toISOString();
    const rowsToInsert: any[] = [];
    for (const userId of userIds) {
      const dedupeSince = opts.dayStartIso;
      const already = await alreadyNotifiedForUser({ userId, kind: 'DAILY_SUMMARY', sinceIso: dedupeSince, title });
      if (already) continue;

      rowsToInsert.push({
        user_id: userId,
        type: 'SYSTEM_ALERT',
        title,
        message,
        priority: 'LOW',
        action_url: '/dashboard/workshop_admin',
        metadata: {
          kind: 'DAILY_SUMMARY',
          date: opts.dateLabel,
          workshop_id: workshopId,
          jobs_completed: completedCount || 0,
          pending: pendingCount || 0,
          sla_breaches: slaBreaches || 0,
          day_start: opts.dayStartIso,
          day_end: opts.dayEndIso,
        },
        is_read: false,
        created_at: nowIso,
      });
      adminsNotified += 1;
    }

    if (rowsToInsert.length > 0) {
      await createNotificationsAdmin(rowsToInsert);
    }
  }

  return { ok: true, workshops: workshopsProcessed, admins: adminsNotified };
}

async function runMechanicSlaCron() {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, error: 'Supabase admin client not available' };

  const nowIso = new Date().toISOString();
  const nowTs = Date.now();

  const ASSIGN_WARN_AFTER_MIN = 30;
  const INSPECTION_WARN_AFTER_MIN = 45;
  const COMPLETE_REMIND_AFTER_HOURS = 6;
  const DELAY_WARN_BEFORE_MIN = 30;

  const { data: jobs } = await supabaseAdmin
    .from('mechanic_jobs')
    .select('lead_id, mechanic_id, mechanic_status, assigned_at, started_at, checklist_completed, before_images_count, updated_at')
    .in('mechanic_status', ['ASSIGNED', 'IN_PROGRESS', 'HOLD'] as any)
    .limit(1000);

  const leadIds = Array.from(new Set((jobs || []).map((j: any) => String(j.lead_id || '')).filter(Boolean)));
  const leadMap = new Map<string, any>();
  if (leadIds.length > 0) {
    const { data: leads } = await supabaseAdmin
      .from('service_leads')
      .select('id, lead_number, status, sla_start_deadline, updated_at')
      .in('id', leadIds as any)
      .limit(1000);
    for (const l of leads || []) leadMap.set(String((l as any).id), l);
  }

  const rowsToInsert: any[] = [];

  for (const job of jobs || []) {
    const leadId = String((job as any).lead_id || '');
    const mechanicId = String((job as any).mechanic_id || '');
    if (!leadId || !mechanicId) continue;

    const lead = leadMap.get(leadId);
    const leadNumber = String((lead as any)?.lead_number || leadId);
    const leadStatus = String((lead as any)?.status || '');

    const assignedAtIso = (job as any)?.assigned_at as string | null | undefined;
    const startedAtIso = (job as any)?.started_at as string | null | undefined;
    const assignedAtTs = assignedAtIso ? new Date(assignedAtIso).getTime() : null;
    const startedAtTs = startedAtIso ? new Date(startedAtIso).getTime() : null;

    const mechanicStatus = String((job as any)?.mechanic_status || '');

    // #2 Job not started within SLA (no explicit accept step)
    if (mechanicStatus === 'ASSIGNED' && !startedAtIso && assignedAtTs && nowTs - assignedAtTs > ASSIGN_WARN_AFTER_MIN * 60_000) {
      if (await alreadyNotified({ leadId, kind: 'MECH_JOB_NOT_STARTED', withinMinutes: 60 })) continue;
      rowsToInsert.push({
        user_id: mechanicId,
        type: 'SLA_WARNING',
        title: 'Job start pending',
        message: `Lead ${leadNumber}: please start inspection/work.`,
        priority: 'URGENT',
        lead_id: leadId,
        lead_number: leadNumber,
        action_url: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
        metadata: { kind: 'MECH_JOB_NOT_STARTED', assigned_at: assignedAtIso || null },
        is_read: false,
        created_at: nowIso,
      });
    }

    // #4 Inspection checklist / BEFORE media pending
    const checklistDone = Boolean((job as any)?.checklist_completed);
    const beforeCount = Number((job as any)?.before_images_count || 0);
    if (assignedAtTs && nowTs - assignedAtTs > INSPECTION_WARN_AFTER_MIN * 60_000) {
      if (!checklistDone || beforeCount < 1) {
        if (await alreadyNotified({ leadId, kind: 'MECH_INSPECTION_PENDING', withinMinutes: 90 })) continue;
        rowsToInsert.push({
          user_id: mechanicId,
          type: 'SYSTEM_ALERT',
          title: 'Inspection pending',
          message: `Lead ${leadNumber}: complete checklist and upload inspection (BEFORE) photos to continue.`,
          priority: 'URGENT',
          lead_id: leadId,
          lead_number: leadNumber,
          action_url: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
          metadata: { kind: 'MECH_INSPECTION_PENDING', checklist_completed: checklistDone, before_images_count: beforeCount },
          is_read: false,
          created_at: nowIso,
        });
      }
    }

    // #10 Job delay warning (SLA at risk)
    const slaStartDeadlineIso = (lead as any)?.sla_start_deadline as string | null | undefined;
    if (slaStartDeadlineIso && (leadStatus === 'IN_PROGRESS' || leadStatus === 'MECHANIC_WORKING')) {
      const deadlineTs = new Date(slaStartDeadlineIso).getTime();
      const minsToDeadline = Math.ceil((deadlineTs - nowTs) / 60_000);
      if (minsToDeadline <= DELAY_WARN_BEFORE_MIN && minsToDeadline > 0) {
        if (!(await alreadyNotified({ leadId, kind: 'MECH_JOB_DELAY_WARNING', withinMinutes: 60 }))) {
          rowsToInsert.push({
            user_id: mechanicId,
            type: 'SLA_WARNING',
            title: 'Job delay warning',
            message: `Lead ${leadNumber}: SLA at risk. Update status/reason for delay.`,
            priority: 'URGENT',
            lead_id: leadId,
            lead_number: leadNumber,
            action_url: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
            metadata: { kind: 'MECH_JOB_DELAY_WARNING', sla_start_deadline: slaStartDeadlineIso, remaining_minutes: minsToDeadline },
            is_read: false,
            created_at: nowIso,
          });
        }
      }
      if (minsToDeadline <= 0) {
        if (!(await alreadyNotified({ leadId, kind: 'MECH_JOB_DELAY_BREACH', withinMinutes: 6 * 60 }))) {
          rowsToInsert.push({
            user_id: mechanicId,
            type: 'SLA_BREACH',
            title: 'SLA breached',
            message: `Lead ${leadNumber}: SLA breached. Inform supervisor and update status.`,
            priority: 'URGENT',
            lead_id: leadId,
            lead_number: leadNumber,
            action_url: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
            metadata: { kind: 'MECH_JOB_DELAY_BREACH', sla_start_deadline: slaStartDeadlineIso },
            is_read: false,
            created_at: nowIso,
          });
        }
      }
    }

    // #11 Job completion reminder (stuck in progress)
    if (mechanicStatus === 'IN_PROGRESS' && startedAtTs && nowTs - startedAtTs > COMPLETE_REMIND_AFTER_HOURS * 60 * 60_000) {
      if (leadStatus !== 'WORK_COMPLETED') {
        if (await alreadyNotified({ leadId, kind: 'MECH_COMPLETE_REMINDER', withinMinutes: 6 * 60 })) continue;
        rowsToInsert.push({
          user_id: mechanicId,
          type: 'SYSTEM_ALERT',
          title: 'Mark job complete',
          message: `Lead ${leadNumber}: please upload after photos and mark job complete if work is finished.`,
          priority: 'HIGH',
          lead_id: leadId,
          lead_number: leadNumber,
          action_url: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
          metadata: { kind: 'MECH_COMPLETE_REMINDER', started_at: startedAtIso || null },
          is_read: false,
          created_at: nowIso,
        });
      }
    }
  }

  if (rowsToInsert.length > 0) {
    await createNotificationsAdmin(rowsToInsert);
  }

  return { ok: true, created: rowsToInsert.length };
}

async function runMechanicDailySummaryCron(opts: { dayStartIso: string; dayEndIso: string; dateLabel: string }) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, error: 'Supabase admin client not available' };

  const [mechRoleId] = await getRoleIds(['WORKSHOP_MECHANIC']);
  if (!mechRoleId) return { ok: true, mechanics: 0, notified: 0, note: 'No WORKSHOP_MECHANIC role found' };

  const { data: mechanics, error: mechErr } = await supabaseAdmin
    .from('users_login')
    .select('id')
    .eq('role_id', mechRoleId as any)
    .eq('is_active', true)
    .limit(5000);

  if (mechErr) return { ok: false, error: 'Failed to load mechanics' };

  let notified = 0;
  const nowIso = new Date().toISOString();

  for (const m of mechanics || []) {
    const mechanicId = String((m as any).id || '');
    if (!mechanicId) continue;

    const title = `Today's Summary (${opts.dateLabel})`;
    const already = await alreadyNotifiedForUser({ userId: mechanicId, kind: 'MECHANIC_DAILY_SUMMARY', sinceIso: opts.dayStartIso, title });
    if (already) continue;

    const { count: completedCount } = await supabaseAdmin
      .from('mechanic_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('mechanic_id', mechanicId)
      .eq('mechanic_status', 'COMPLETED' as any)
      .gte('completed_at', opts.dayStartIso)
      .lt('completed_at', opts.dayEndIso);

    const { count: pendingCount } = await supabaseAdmin
      .from('mechanic_jobs')
      .select('id', { count: 'exact', head: true })
      .eq('mechanic_id', mechanicId)
      .in('mechanic_status', ['ASSIGNED', 'IN_PROGRESS', 'HOLD'] as any);

    const { count: reworkCount } = await supabaseAdmin
      .from('service_leads')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_mechanic_id', mechanicId as any)
      .eq('status', 'REWORK_REQUIRED' as any)
      .lt('updated_at', opts.dayEndIso);

    const message = `Jobs Completed: ${completedCount || 0} • Pending: ${pendingCount || 0} • Rework: ${reworkCount || 0}`;

    await createNotificationsAdmin([
      {
        user_id: mechanicId,
        type: 'DAILY_SUMMARY',
        title,
        message,
        priority: 'LOW',
        action_url: `/dashboard/workshop_mechanic`,
        metadata: {
          kind: 'MECHANIC_DAILY_SUMMARY',
          date: opts.dateLabel,
          jobs_completed: completedCount || 0,
          pending: pendingCount || 0,
          rework: reworkCount || 0,
          day_start: opts.dayStartIso,
          day_end: opts.dayEndIso,
        },
        is_read: false,
        created_at: nowIso,
      },
    ]);
    notified += 1;
  }

  return { ok: true, mechanics: (mechanics || []).length, notified };
}

export async function POST(req: NextRequest) {
  const authErr = assertCronAuth(req);
  if (authErr) return NextResponse.json({ error: authErr }, { status: authErr === 'Unauthorized' ? 401 : 500 });

  const body = await req.json().catch(() => ({}));
  const task = String((body as any)?.task || 'sla');

  if (task === 'sla') {
    const res = await runSlaCron();
    return NextResponse.json({ ...res, task }, { status: res.ok ? 200 : 500 });
  }

  if (task === 'daily_summary') {
    const dayStartIso = String((body as any)?.dayStartIso || '');
    const dayEndIso = String((body as any)?.dayEndIso || '');
    const dateLabel = String((body as any)?.dateLabel || '');

    if (!dayStartIso || !dayEndIso || !dateLabel) {
      return NextResponse.json(
        {
          error: 'Missing dayStartIso/dayEndIso/dateLabel',
          example: {
            task: 'daily_summary',
            dayStartIso: '2026-01-06T00:00:00.000Z',
            dayEndIso: '2026-01-07T00:00:00.000Z',
            dateLabel: '2026-01-06',
          },
        },
        { status: 400 }
      );
    }

    const res = await runDailySummaryCron({ dayStartIso, dayEndIso, dateLabel });
    return NextResponse.json({ ...res, task }, { status: res.ok ? 200 : 500 });
  }

  if (task === 'mechanic_sla') {
    const res = await runMechanicSlaCron();
    return NextResponse.json({ ...res, task }, { status: res.ok ? 200 : 500 });
  }

  if (task === 'daily_summary_mechanic') {
    const dayStartIso = String((body as any)?.dayStartIso || '');
    const dayEndIso = String((body as any)?.dayEndIso || '');
    const dateLabel = String((body as any)?.dateLabel || '');

    if (!dayStartIso || !dayEndIso || !dateLabel) {
      return NextResponse.json(
        {
          error: 'Missing dayStartIso/dayEndIso/dateLabel',
          example: {
            task: 'daily_summary_mechanic',
            dayStartIso: '2026-01-06T00:00:00.000Z',
            dayEndIso: '2026-01-07T00:00:00.000Z',
            dateLabel: '2026-01-06',
          },
        },
        { status: 400 }
      );
    }

    const res = await runMechanicDailySummaryCron({ dayStartIso, dayEndIso, dateLabel });
    return NextResponse.json({ ...res, task }, { status: res.ok ? 200 : 500 });
  }

  return NextResponse.json({ error: 'Unknown task', task }, { status: 400 });
}


