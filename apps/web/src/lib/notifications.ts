// Notification utility functions
import { createClient } from '@/lib/supabase/server';
import { NotificationType, NotificationPriority } from '@/shared/types/notifications';

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
  const supabase = await createClient();

  try {
    const { data, error } = await supabase
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

    return data;
  } catch (error) {
    console.error('Unexpected error creating notification:', error);
    return null;
  }
}

export async function createBulkNotifications(notifications: CreateNotificationParams[]) {
  const supabase = await createClient();

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

    const { data, error } = await supabase
      .from('notifications')
      .insert(notificationsData)
      .select();

    if (error) {
      console.error('Error creating bulk notifications:', error);
      return [];
    }

    return data;
  } catch (error) {
    console.error('Unexpected error creating bulk notifications:', error);
    return [];
  }
}

// Helper function to notify team members when a lead is assigned
export async function notifyTeamAssignment(
  leadId: string,
  leadNumber: string,
  mechanicId?: string,
  supervisorId?: string,
  pickupBoyId?: string,
  assignedBy?: string
) {
  const notifications: CreateNotificationParams[] = [];

  if (mechanicId) {
    notifications.push({
      userId: mechanicId,
      type: 'TEAM_ASSIGNED',
      title: 'New Job Assigned',
      message: `You have been assigned to work on lead ${leadNumber}`,
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
      actionUrl: `/dashboard/workshop_supervisor/jobs/${leadId}`
    });
  }

  if (pickupBoyId) {
    notifications.push({
      userId: pickupBoyId,
      type: 'PICKUP_SCHEDULED',
      title: 'New Pickup Task',
      message: `You have been assigned a pickup task for lead ${leadNumber}`,
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

// Helper function to notify about extra work approval/rejection
export async function notifyExtraWorkDecision(
  leadId: string,
  leadNumber: string,
  mechanicId: string,
  isApproved: boolean,
  amount: number,
  supervisorName: string,
  reason?: string
) {
  await createNotification({
    userId: mechanicId,
    type: isApproved ? 'EXTRA_WORK_APPROVED' : 'EXTRA_WORK_REJECTED',
    title: isApproved ? 'Extra Work Approved ✅' : 'Extra Work Rejected ❌',
    message: isApproved 
      ? `Extra work approved for lead ${leadNumber}. Amount: ₹${amount}`
      : `Extra work rejected for lead ${leadNumber}. Reason: ${reason || 'Not provided'}`,
    priority: 'HIGH',
    leadId,
    leadNumber,
    relatedUserName: supervisorName,
    actionUrl: `/dashboard/workshop_mechanic/jobs/${leadId}/manage`,
    metadata: { amount, reason }
  });
}

// Helper function to notify workshop admin about new lead assignment
export async function notifyWorkshopAdmin(
  workshopId: string,
  leadId: string,
  leadNumber: string,
  leadManagerName?: string
) {
  const supabase = await createClient();

  // Get all workshop admins for this workshop
  const { data: admins } = await supabase
    .from('users_login')
    .select('id')
    .eq('workshop_id', workshopId)
    .eq('role', 'workshop_admin')
    .eq('is_active', true);

  if (admins && admins.length > 0) {
    const notifications = admins.map(admin => ({
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

