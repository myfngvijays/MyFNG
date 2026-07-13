import type { AgentEventType, AgentType } from './types';

export type AgentEvent = {
  type: AgentEventType;
  agentType: AgentType;
  phone: string;
  instanceId?: string;
  leadId?: string | null;
  telecrmId?: string | null;
  customerMessage?: string;
  metadata?: Record<string, unknown>;
};

export const AGENT_EVENT_LABELS: Record<AgentEventType, string> = {
  NEW_LEAD: 'New lead from TeleCRM',
  CUSTOMER_REPLY: 'Customer replied on WhatsApp',
  SCHEDULED_WAKEUP: 'Scheduled follow-up timer',
  CRM_UPDATE: 'CRM disposition updated',
  MANUAL_TRIGGER: 'Admin manual trigger',
  ACTIVATE_BOOKING_BOT: 'Chase → Booking handoff',
};

export function describeEvent(event: AgentEvent): string {
  return AGENT_EVENT_LABELS[event.type] || event.type;
}
