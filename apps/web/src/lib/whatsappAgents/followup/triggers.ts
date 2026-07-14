import type { AgentConfig } from '../shared/types';

export type FollowupSourceType =
  | 'telecaller_follow_up'
  | 'incomplete_booking'
  | 'service_due_reminder'
  | 'cse_callback'
  | 'telecrm_disposition';

export type FollowupTriggerConfig = {
  telecallerFollowUpEnabled: boolean;
  telecallerOffsetMinutes: number;
  incompleteBookingEnabled: boolean;
  incompleteBookingDelayHours: number;
  serviceDueReminderEnabled: boolean;
  cseCallbackEnabled: boolean;
  outboundTemplateName: string;
  outboundTemplateLanguage: string;
  pollLimit: number;
};

export function getFollowupTriggerConfig(config: AgentConfig): FollowupTriggerConfig {
  const triggers = config.triggers_json as Record<string, unknown>;
  const telecaller = (triggers.telecaller_follow_up as { enabled?: boolean; offset_minutes?: number }) || {};
  const incomplete = (triggers.incomplete_booking as { enabled?: boolean; delay_hours?: number }) || {};
  const serviceDue = (triggers.service_due_reminder as { enabled?: boolean }) || {};
  const cse = (triggers.cse_callback as { enabled?: boolean }) || {};

  return {
    telecallerFollowUpEnabled: telecaller.enabled !== false,
    telecallerOffsetMinutes:
      Number(telecaller.offset_minutes ?? triggers.telecaller_offset_minutes) || 0,
    incompleteBookingEnabled: incomplete.enabled !== false,
    incompleteBookingDelayHours:
      Number(incomplete.delay_hours ?? triggers.incomplete_booking_delay_hours) || 2,
    serviceDueReminderEnabled: serviceDue.enabled === true,
    cseCallbackEnabled: cse.enabled === true,
    outboundTemplateName: String(triggers.outbound_template_name || 'app_session_incomplete').trim(),
    outboundTemplateLanguage: String(triggers.outbound_template_language || 'en').trim(),
    pollLimit: Number(triggers.poll_limit) || 25,
  };
}

export function isFollowupDueAt(scheduledIso: string, offsetMinutes: number, now = Date.now()): boolean {
  const scheduledMs = new Date(scheduledIso).getTime();
  if (Number.isNaN(scheduledMs)) return false;
  return scheduledMs + offsetMinutes * 60 * 1000 <= now;
}
