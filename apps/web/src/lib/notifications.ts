// Notification utility functions
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { NotificationType, NotificationPriority } from '@/shared/types/notifications';
import { dispatchPushToUser } from '@/lib/push/dispatchPush';

/**
 * ============================================================
 * Notification routing conventions (Phase A - web app open)
 * ============================================================
 * We store notifications in `public.notifications` and rely on:
 * - `NotificationContext` (client) to subscribe to INSERT via Supabase realtime
 * - UI (`NotificationCenter` / `NotificationBell`) to show in-app list
 *
 * Role-wise routing (requested):
 * - TELECALLER: lead assigned/reassigned, followup/escalations, lead lifecycle changes impacting telecaller
 * - Teamlead: SUB_ADMIN + department='TELECALLER': escalations, workshop accept/reject/major status changes for their team
 * - Workshop roles: admin/supervisor/mechanic/pickup boy via existing helpers below
 *
 * Action URL conventions (web):
 * - Telecaller lead: `/dashboard/telecaller/leads/{leadId}`
 * - Teamlead dashboard: `/dashboard/sub_admin/telecaller`
 * - Workshop admin pending leads: `/dashboard/workshop_admin/leads/pending`
 * - Workshop supervisor job: `/dashboard/workshop-advisor/jobs/{leadId}`
 * - Workshop mechanic manage: `/dashboard/workshop_mechanic/jobs/{leadId}/manage`
 * - Pickup tasks: `/dashboard/workshop_pickup_boy/tasks/{leadId}`
 */

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  leadId?: string;
  leadNumber?: string;
  relatedUserId?: string;
  relatedUserName?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export async function createNotification(params: CreateNotificationParams) {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();

  if (adminError || !supabaseAdmin) {
    console.error('Failed to get Supabase admin client for notifications:', adminError);
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        priority: params.priority || 'MEDIUM',
        lead_id: params.leadId,
        lead_number: params.leadNumber,
        related_user_id: params.relatedUserId,
        related_user_name: params.relatedUserName,
        action_url: params.actionUrl,
        metadata: params.metadata,
        is_read: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      return null;
    }

    // Final: fan-out push (best-effort, non-blocking)
    if (data?.id && params.userId) {
      void dispatchPushToUser(params.userId, data as any);
    }

    return data;
  } catch (error) {
    console.error('Unexpected error creating notification:', error);
    return null;
  }
}

export async function createBulkNotifications(notifications: CreateNotificationParams[]) {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();

  if (adminError || !supabaseAdmin) {
    console.error('Failed to get Supabase admin client for bulk notifications:', adminError);
    return [];
  }

  try {
    const notificationsData = notifications.map(params => ({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      priority: params.priority || 'MEDIUM',
      lead_id: params.leadId,
      lead_number: params.leadNumber,
      related_user_id: params.relatedUserId,
      related_user_name: params.relatedUserName,
      action_url: params.actionUrl,
      metadata: params.metadata,
      is_read: false,
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert(notificationsData)
      .select();

    if (error) {
      console.error('Error creating bulk notifications:', error);
      return [];
    }

    // Final: push fan-out (best-effort)
    try {
      const rows = (data || []) as any[];
      for (const row of rows) {
        const userId = String(row.user_id || '');
        if (userId) void dispatchPushToUser(userId, row as any);
      }
    } catch (e) {
      console.warn('Bulk push fan-out failed (non-blocking):', e);
    }

    return data;
  } catch (error) {
    console.error('Unexpected error creating bulk notifications:', error);
    return [];
  }
}

async function getTelecallerTeamleadsForTelecaller(telecallerId: string) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  // Teamlead model: SUB_ADMIN with department='TELECALLER' who has the telecaller in their team
  const { data, error } = await supabaseAdmin
    .from('subadmin_team_assignments')
    .select('subadmin_id')
    .eq('team_member_id', telecallerId)
    .eq('department', 'TELECALLER')
    .eq('is_active', true);

  if (error) {
    console.warn('Failed to fetch telecaller teamleads:', error);
    return [];
  }

  const ids = Array.from(new Set((data || []).map((r: any) => r.subadmin_id).filter(Boolean)));
  return ids as string[];
}

/**
 * Notify telecaller assigned to a lead about lead updates
 * Also notifies the telecaller's team lead
 */
export async function notifyTelecallerForLead(params: {
  leadId: string;
  leadNumber: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  actionUrl?: string;
  metadata?: Record<string, any>;
}) {
  const { leadId, leadNumber, type, title, message, priority, actionUrl, metadata } = params;
  
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('[notifyTelecallerForLead] Failed to get Supabase admin client');
    return;
  }

  // Get lead to find assigned telecaller
  const { data: lead, error: leadError } = await supabaseAdmin
    .from('service_leads')
    .select('assigned_telecaller_id')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    console.warn('[notifyTelecallerForLead] Lead not found or error:', leadError);
    return;
  }

  const telecallerId = lead.assigned_telecaller_id;
  if (!telecallerId) {
    console.warn('[notifyTelecallerForLead] No telecaller assigned to lead:', leadId);
    return;
  }

  // Notify telecaller
  await createNotification({
    userId: telecallerId,
    type,
    title,
    message,
    priority: priority || 'MEDIUM',
    leadId,
    leadNumber,
    actionUrl: actionUrl || `/dashboard/telecaller/leads/${leadId}`,
    metadata,
  });

  // Also notify team lead
  await notifyTelecallerTeamlead({
    telecallerId,
    leadId,
    leadNumber,
    type,
    title,
    message,
    priority,
    actionUrl: actionUrl || `/dashboard/telecaller/leads/${leadId}`,
    metadata,
  });
}

export async function notifyTelecallerClickToCallRinging(params: {
  telecallerId: string;
  leadId: string;
  sessionId?: string | null;
}) {
  const telecallerId = String(params.telecallerId || '').trim();
  const leadId = String(params.leadId || '').trim();
  if (!telecallerId || !leadId) return;

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const { data: lead } = await supabaseAdmin
    .from('service_leads')
    .select('id, lead_number, customer_name, vehicle_number, vehicle_make, vehicle_model, city')
    .eq('id', leadId)
    .maybeSingle();

  const name = String((lead as any)?.customer_name || '').trim() || 'Customer';
  const leadNumber = String((lead as any)?.lead_number || leadId);
  const vehicle = [
    (lead as any)?.vehicle_make,
    (lead as any)?.vehicle_model,
    (lead as any)?.vehicle_number,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' ');
  const city = String((lead as any)?.city || '').trim();
  const bits = [leadNumber, name, vehicle || null, city || null].filter(Boolean);

  await createNotification({
    userId: telecallerId,
    type: 'LEAD_ASSIGNED',
    title: 'Phone ringing — this lead',
    message: `${bits.join(' · ')}. Phone pe DID dikhega — CRM mein yeh lead open karo.`,
    priority: 'URGENT',
    leadId,
    leadNumber,
    actionUrl: `/dashboard/telecaller/leads/${leadId}`,
    metadata: {
      kind: 'CLICK_TO_CALL_RINGING',
      session_id: params.sessionId || null,
    },
  });
}

export async function notifyTelecallerAssignedToLead(params: {
  leadId: string;
  leadNumber: string;
  telecallerId: string;
  assignedByName?: string;
  isReassignment?: boolean;
  notes?: string;
}) {
  const { leadId, leadNumber, telecallerId, assignedByName, isReassignment, notes } = params;

  const title = isReassignment ? 'Lead reassigned to you' : 'New lead assigned';
  const message = [
    `${leadNumber} assigned to you${assignedByName ? ` by ${assignedByName}` : ''}.`,
    notes ? `Notes: ${notes}` : null,
  ].filter(Boolean).join(' ');

  await createNotification({
    userId: telecallerId,
    type: 'LEAD_ASSIGNED',
    title,
    message,
    priority: 'HIGH',
    leadId,
    leadNumber,
    relatedUserName: assignedByName,
    actionUrl: `/dashboard/telecaller/leads/${leadId}`,
    metadata: { is_reassignment: Boolean(isReassignment) },
  });
}

/**
 * Safe notify after auto/manual assign. Skips if same telecaller already owns the lead.
 * createNotification → dispatchPushToUser (FCM) when device token exists.
 * Also sends WhatsApp when enabled in Telecaller Distribution → WhatsApp Alerts.
 */
export async function notifyTelecallerNewLeadAssignedSafe(params: {
  leadId?: string | null;
  leadNumber?: string | null;
  telecallerId?: string | null;
  previousTelecallerId?: string | null;
  assignedByName?: string;
  isReassignment?: boolean;
  notes?: string;
}) {
  const leadId = String(params.leadId || '').trim();
  const telecallerId = String(params.telecallerId || '').trim();
  if (!leadId || !telecallerId) return;

  const prev = String(params.previousTelecallerId || '').trim();
  if (prev && prev === telecallerId) return;

  const leadNumber = String(params.leadNumber || leadId);

  try {
    await notifyTelecallerAssignedToLead({
      leadId,
      leadNumber,
      telecallerId,
      assignedByName: params.assignedByName || 'System',
      isReassignment: params.isReassignment ?? Boolean(prev),
      notes: params.notes,
    });
  } catch (err) {
    console.warn('[notifyTelecallerNewLeadAssignedSafe] failed (non-blocking):', err);
  }

  try {
    const { notifyTelecallerNewLeadWhatsAppSafe } = await import(
      '@/lib/services/telecallerNewLeadWhatsApp'
    );
    void notifyTelecallerNewLeadWhatsAppSafe({ leadId, leadNumber, telecallerId });
  } catch (err) {
    console.warn('[notifyTelecallerNewLeadAssignedSafe] WhatsApp hook failed (non-blocking):', err);
  }

  // Agent-first click-to-call when Auto-dial Fresh is enabled (telecaller rings first).
  try {
    const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
    const { autoDialFreshLeadIfEnabled } = await import(
      '@/lib/telecaller/initiateClickToCall'
    );
    const { supabaseAdmin } = getSupabaseAdmin();
    if (supabaseAdmin) {
      const { data: leadRow } = await supabaseAdmin
        .from('service_leads')
        .select('id, customer_phone, status')
        .eq('id', leadId)
        .maybeSingle();
      void autoDialFreshLeadIfEnabled({
        leadId,
        customerPhone: (leadRow as any)?.customer_phone,
        telecallerId,
        leadStatus: (leadRow as any)?.status,
      }).then((r) => {
        if (r && 'skipped' in r && r.skipped) return;
        if (r && !r.ok) {
          console.warn('[notifyTelecallerNewLeadAssignedSafe] auto-dial failed:', r.error);
        }
      });
    }
  } catch (err) {
    console.warn('[notifyTelecallerNewLeadAssignedSafe] auto-dial hook failed (non-blocking):', err);
  }
}

export async function notifyTelecallerTeamlead(params: {
  telecallerId: string;
  leadId: string;
  leadNumber: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  actionUrl?: string;
  metadata?: Record<string, any>;
}) {
  const { telecallerId, leadId, leadNumber, type, title, message, priority, actionUrl, metadata } = params;
  const teamleadIds = await getTelecallerTeamleadsForTelecaller(telecallerId);
  if (teamleadIds.length === 0) return;

  await createBulkNotifications(
    teamleadIds.map((id) => ({
      userId: id,
      type,
      title,
      message,
      priority: priority || 'MEDIUM',
      leadId,
      leadNumber,
      actionUrl: actionUrl || `/dashboard/sub_admin/telecaller`,
      metadata: { ...(metadata || {}), telecaller_id: telecallerId },
    }))
  );
}

// Helper function to notify team members when a lead is assigned
export async function notifyTeamAssignment(
  leadId: string,
  leadNumber: string,
  mechanicId?: string,
  supervisorId?: string,
  pickupBoyId?: string,
  assignedBy?: string,
  leadMeta?: {
    vehicleNumber?: string | null;
    vehicleModel?: string | null;
    serviceType?: string | null;
    bay?: string | null;
    customerName?: string | null;
    pickupScheduledTime?: string | null;
    pickupAddress?: string | null;
    pickupDistanceKm?: number | null;
  }
) {
  const notifications: CreateNotificationParams[] = [];

  if (mechanicId) {
    const parts = [
      `Lead: ${leadNumber}`,
      leadMeta?.vehicleNumber ? `Vehicle: ${leadMeta.vehicleNumber}` : null,
      leadMeta?.vehicleModel ? `Model: ${leadMeta.vehicleModel}` : null,
      leadMeta?.serviceType ? `Service: ${leadMeta.serviceType}` : null,
      leadMeta?.bay ? `Bay: ${leadMeta.bay}` : null,
      'Action: Start inspection',
    ].filter(Boolean);

    notifications.push({
      userId: mechanicId,
      type: 'TEAM_ASSIGNED',
      title: 'New Job Assigned',
      message: parts.length > 0 ? parts.join(' • ') : `You have been assigned to work on lead ${leadNumber}`,
      priority: 'HIGH',
      leadId,
      leadNumber,
      relatedUserName: assignedBy,
      actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`
    });
  }

  if (supervisorId) {
    notifications.push({
      userId: supervisorId,
      type: 'TEAM_ASSIGNED',
      title: 'New Lead to Supervise',
      message: `You have been assigned to supervise lead ${leadNumber}`,
      priority: 'HIGH',
      leadId,
      leadNumber,
      relatedUserName: assignedBy,
      actionUrl: `/dashboard/workshop-advisor/jobs/${leadId}`
    });
  }

  if (pickupBoyId) {
    const parts = [
      `Lead: ${leadNumber}`,
      leadMeta?.customerName ? `Customer: ${leadMeta.customerName}` : null,
      leadMeta?.pickupScheduledTime ? `Pickup time: ${leadMeta.pickupScheduledTime}` : null,
      leadMeta?.pickupDistanceKm != null ? `Distance: ${leadMeta.pickupDistanceKm} km` : null,
      leadMeta?.pickupAddress ? `Location: ${leadMeta.pickupAddress}` : null,
      'Action: Start pickup',
    ].filter(Boolean);

    notifications.push({
      userId: pickupBoyId,
      type: 'PICKUP_TASK_ASSIGNED',
      title: 'New Pickup Assigned',
      message: parts.length > 0 ? parts.join(' • ') : `Lead ${leadNumber} assigned. Action: Start pickup.`,
      priority: 'HIGH',
      leadId,
      leadNumber,
      relatedUserName: assignedBy,
      actionUrl: `/dashboard/workshop_pickup_boy/tasks/${leadId}`
    });
  }

  if (notifications.length > 0) {
    await createBulkNotifications(notifications);
  }
}

export async function notifyPickupBoy(params: {
  pickupBoyId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  leadId?: string;
  leadNumber?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}) {
  const { pickupBoyId, type, title, message, priority, leadId, leadNumber, actionUrl, metadata } = params;
  const resolvedActionUrl =
    actionUrl || (leadId ? `/dashboard/workshop_pickup_boy/tasks/${leadId}` : undefined);

  return await createNotification({
    userId: pickupBoyId,
    type,
    title,
    message,
    priority: priority || 'MEDIUM',
    leadId,
    leadNumber,
    actionUrl: resolvedActionUrl,
    metadata,
  });
}

// Helper function to notify about QC approval/rejection
export async function notifyQCDecision(
  leadId: string,
  leadNumber: string,
  mechanicId: string,
  isApproved: boolean,
  supervisorName: string,
  notes?: string
) {
  await createNotification({
    userId: mechanicId,
    type: isApproved ? 'QC_APPROVED' : 'QC_REJECTED',
    title: isApproved ? 'QC Approved ✅' : 'QC Rejected ❌',
    message: isApproved 
      ? `Quality check approved for lead ${leadNumber} by ${supervisorName}`
      : `Quality check rejected for lead ${leadNumber}. ${notes || 'Please review and fix the issues.'}`,
    priority: isApproved ? 'MEDIUM' : 'HIGH',
    leadId,
    leadNumber,
    relatedUserName: supervisorName,
    actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`
  });
}

export async function resolveLeadMechanicId(
  leadId: string,
  assignedMechanicId?: string | null,
) {
  const direct = String(assignedMechanicId || '').trim();
  if (direct) return direct;

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return null;

  const { data } = await supabaseAdmin
    .from('mechanic_jobs')
    .select('mechanic_id')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return String((data as any)?.mechanic_id || '').trim() || null;
}

// Helper function to notify about additional job approval/rejection
export async function notifyExtraWorkDecision(
  leadId: string,
  leadNumber: string,
  mechanicId: string,
  isApproved: boolean,
  amount: number,
  supervisorName: string,
  reason?: string,
  opts?: { extraWorkId?: string; advisorId?: string; description?: string },
) {
  const item = String(opts?.description || 'Additional job').trim();
  const extraWorkId = opts?.extraWorkId;
  const metadata = { amount, reason, extra_work_id: extraWorkId, tab: 'extra' };

  if (mechanicId) {
    await createNotification({
      userId: mechanicId,
      type: isApproved ? 'EXTRA_WORK_APPROVED' : 'EXTRA_WORK_REJECTED',
      title: isApproved ? 'Additional job approved' : 'Additional job rejected',
      message: isApproved
        ? `${item} approved for lead ${leadNumber}. Amount: ₹${amount}. Open Extra tab to do this work.`
        : `${item} rejected for lead ${leadNumber}. Reason: ${reason || 'Not provided'}`,
      priority: 'HIGH',
      leadId,
      leadNumber,
      relatedUserName: supervisorName,
      actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}?tab=extra`,
      metadata,
    });
  }

  const advisorId = String(opts?.advisorId || '').trim();
  if (advisorId && advisorId !== mechanicId) {
    await createNotification({
      userId: advisorId,
      type: isApproved ? 'EXTRA_WORK_APPROVED' : 'EXTRA_WORK_REJECTED',
      title: isApproved ? 'Additional job approved' : 'Additional job rejected',
      message: isApproved
        ? `You approved ${item} for lead ${leadNumber}. Amount: ₹${amount}. Mechanic can start this extra work.`
        : `You rejected ${item} for lead ${leadNumber}.`,
      priority: 'HIGH',
      leadId,
      leadNumber,
      relatedUserName: supervisorName,
      actionUrl: `/dashboard/workshop-advisor/jobs/${leadId}`,
      metadata,
    });
  }
}

// Helper function to notify workshop admin about new lead assignment
export async function notifyWorkshopAdmin(
  workshopId: string,
  leadId: string,
  leadNumber: string,
  leadManagerName?: string
) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  // Get all workshop admins for this workshop (role-based)
  const { data: roles } = await supabaseAdmin
    .from('roles')
    .select('id')
    .eq('role_code', 'WORKSHOP_ADMIN');

  const roleId = roles?.[0]?.id;
  if (!roleId) return;

  const { data: admins } = await supabaseAdmin
    .from('users_login')
    .select('id')
    .eq('workshop_id', workshopId)
    .eq('role_id', roleId)
    .eq('is_active', true);

  if (admins && admins.length > 0) {
    const notifications = admins.map((admin: { id: string }) => ({
      userId: admin.id,
      type: 'LEAD_ASSIGNED' as NotificationType,
      title: 'New Lead Assigned to Workshop',
      message: `Lead ${leadNumber} has been assigned to your workshop by ${leadManagerName || 'Lead Manager'}`,
      priority: 'HIGH' as NotificationPriority,
      leadId,
      leadNumber,
      relatedUserName: leadManagerName,
      actionUrl: `/dashboard/workshop_admin/leads/pending`
    }));

    await createBulkNotifications(notifications);
  }
}

// Helper function for SLA warnings
export async function notifySLAWarning(
  leadId: string,
  leadNumber: string,
  userIds: string[],
  remainingMinutes: number
) {
  const notifications = userIds.map(userId => ({
    userId,
    type: 'SLA_WARNING' as NotificationType,
    title: '⏰ SLA Warning',
    message: `Lead ${leadNumber} has only ${remainingMinutes} minutes remaining before SLA breach!`,
    priority: 'URGENT' as NotificationPriority,
    leadId,
    leadNumber,
    actionUrl: `/dashboard/leads/${leadId}`,
    metadata: { remainingMinutes }
  }));

  await createBulkNotifications(notifications);
}

async function getRoleIds(roleCodes: string[]) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];
  const { data } = await supabaseAdmin
    .from('roles')
    .select('id, role_code')
    .in('role_code', roleCodes);
  return (data || []).map((r: any) => r.id);
}

async function getUsersInWorkshopByRoleCodes(workshopId: string, roleCodes: string[]) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];
  const roleIds = await getRoleIds(roleCodes);
  if (roleIds.length === 0) return [];

  const { data } = await supabaseAdmin
    .from('users_login')
    .select('id, full_name')
    .eq('workshop_id', workshopId)
    .in('role_id', roleIds)
    .eq('is_active', true);

  return (data || []) as Array<{ id: string; full_name?: string }>;
}

/**
 * Notify all active users that match role codes (global, no workshop filter).
 * Useful for Digital Marketing workflows like blog review.
 */
export async function notifyRoleCodesGlobal(params: {
  roleCodes: string[];
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  actionUrl?: string;
  metadata?: Record<string, any>;
}) {
  const { roleCodes, type, title, message, priority, actionUrl, metadata } = params;
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const roleIds = await getRoleIds(roleCodes);
  if (roleIds.length === 0) return;

  const { data: users, error } = await supabaseAdmin
    .from('users_login')
    .select('id')
    .in('role_id', roleIds)
    .eq('is_active', true);

  if (error) {
    console.warn('[notifyRoleCodesGlobal] Failed to fetch users:', error);
    return;
  }

  const ids: string[] = Array.from(
    new Set(
      (users || [])
        .map((u: any) => u?.id)
        .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
    )
  );
  if (!ids.length) return;

  await createBulkNotifications(
    ids.map((id) => ({
      userId: id,
      type,
      title,
      message,
      priority: priority || 'MEDIUM',
      actionUrl,
      metadata,
    }))
  );
}

export async function notifyWorkshopRoles(params: {
  workshopId: string;
  roleCodes: string[];
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  leadId?: string;
  leadNumber?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}) {
  const { workshopId, roleCodes, type, title, message, priority, leadId, leadNumber, actionUrl, metadata } = params;
  
  console.log('[notifyWorkshopRoles] Starting:', { workshopId, roleCodes, leadNumber });
  
  const users = await getUsersInWorkshopByRoleCodes(workshopId, roleCodes);
  
  console.log('[notifyWorkshopRoles] Found users:', { count: users.length, userIds: users.map(u => u.id) });
  
  if (users.length === 0) {
    console.warn('[notifyWorkshopRoles] No users found for workshop/roles:', { workshopId, roleCodes });
    return;
  }

  const notifications = users.map(u => ({
    userId: u.id,
    type,
    title,
    message,
    priority: priority || 'MEDIUM',
    leadId,
    leadNumber,
    actionUrl,
    metadata,
  }));

  console.log('[notifyWorkshopRoles] Creating notifications:', { count: notifications.length });
  
  const result = await createBulkNotifications(notifications);
  
  console.log('[notifyWorkshopRoles] Result:', { created: result?.length || 0 });
  
  return result;
}

export async function notifyReadyForQC(
  leadId: string,
  leadNumber: string,
  supervisorId?: string | null,
  workshopId?: string | null
) {
  const { supabaseAdmin } = getSupabaseAdmin();
  const recipientIds = new Set<string>();
  const assigned = String(supervisorId || '').trim();
  if (assigned) recipientIds.add(assigned);

  if (workshopId) {
    const advisors = await getUsersInWorkshopByRoleCodes(workshopId, [
      'WORKSHOP_SUPERVISOR',
    ]);
    advisors.forEach((u) => {
      if (u?.id) recipientIds.add(u.id);
    });
  }

  if (recipientIds.size === 0 && workshopId) {
    await notifyWorkshopAdmin(workshopId, leadId, leadNumber, 'System');
    return;
  }

  if (recipientIds.size === 0) return;

  let alreadyNotified = new Set<string>();
  if (supabaseAdmin) {
    const { data: existing } = await supabaseAdmin
      .from('notifications')
      .select('user_id, metadata, is_read')
      .eq('lead_id', leadId)
      .eq('type', 'JOB_COMPLETED')
      .in('user_id', Array.from(recipientIds));
    alreadyNotified = new Set(
      (existing || [])
        .filter((row: any) => {
          if (row?.is_read) return false;
          return String(row?.metadata?.kind || '') === 'PENDING_QC';
        })
        .map((row: any) => String(row.user_id)),
    );
  }

  const notifications: CreateNotificationParams[] = Array.from(recipientIds)
    .filter((userId) => !alreadyNotified.has(userId))
    .map((userId) => ({
      userId,
      type: 'JOB_COMPLETED' as NotificationType,
      title: 'Pending QC',
      message: `Lead ${leadNumber} is pending quality check. Review photos and pass / rework / fail.`,
      priority: 'HIGH' as NotificationPriority,
      leadId,
      leadNumber,
      actionUrl: `/dashboard/workshop-advisor/jobs/${leadId}/review`,
      metadata: { kind: 'PENDING_QC' },
    }));

  if (notifications.length > 0) {
    await createBulkNotifications(notifications);
  }
}

export async function notifyAccountsTeam(
  workshopId: string,
  leadId: string,
  leadNumber: string,
  title: string,
  message: string,
  actionUrl?: string,
  priority: NotificationPriority = 'MEDIUM'
) {
  const users = await getUsersInWorkshopByRoleCodes(workshopId, ['ACCOUNTS_TEAM']);
  if (users.length === 0) return;

  await createBulkNotifications(
    users.map(u => ({
      userId: u.id,
      type: 'INVOICE_GENERATED',
      title,
      message,
      priority,
      leadId,
      leadNumber,
      actionUrl: actionUrl || `/dashboard/billing/leads/${leadId}/generate-invoice`,
    }))
  );
}

export async function notifyCSETeam(
  leadId: string,
  leadNumber: string,
  title: string,
  message: string,
  priority: NotificationPriority = 'MEDIUM',
  actionUrl: string = `/dashboard/cse/leads/${leadId}`
) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const roleIds = await getRoleIds(['CUSTOMER_SERVICE_EXECUTIVE', 'CSE']);
  if (roleIds.length === 0) return;

  const { data: users } = await supabaseAdmin
    .from('users_login')
    .select('id')
    .in('role_id', roleIds)
    .eq('is_active', true);

  if (!users || users.length === 0) return;

  await createBulkNotifications(
    users.map((u: any) => ({
      userId: u.id,
      type: 'FOLLOW_UP_SCHEDULED',
      title,
      message,
      priority,
      leadId,
      leadNumber,
      actionUrl,
    }))
  );
}

