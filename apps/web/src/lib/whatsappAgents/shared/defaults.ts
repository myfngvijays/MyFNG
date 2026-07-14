import type { AgentConfig, AgentRules, AgentTools, AgentType, TelecrmSyncConfig } from './types';

export const DEFAULT_AGENT_RULES: AgentRules = {
  max_follow_ups: 5,
  min_wait_hours: 24,
  max_daily_messages: 2,
  business_hours: { start: '09:00', end: '20:00', timezone: 'Asia/Kolkata' },
  allowed_languages: ['en', 'hi'],
  confidence_threshold: 0.7,
  blocked_words: [],
  dnd_hours: { start: '21:00', end: '08:00' },
  escalation_keywords: ['human', 'agent', 'complaint'],
  skip_assigned_chats: true,
};

export const DEFAULT_AGENT_TOOLS: AgentTools = {
  pricing: true,
  workshops: true,
  service_details: true,
  booking: true,
};

export const DEFAULT_TELECRM_SYNC: TelecrmSyncConfig = {
  on_booking: { disposition: 'Booked', disposition_category: 'Converted' },
  on_escalation: { disposition: 'Escalated', disposition_category: 'Human' },
  on_end_max_attempts: { disposition: 'Cold', disposition_category: 'Lost' },
};

const DEFAULT_PROMPTS: Record<AgentType, { goal: string; addon: string; triggers: Record<string, unknown>; tools: AgentTools }> = {
  BOOKING: {
    goal:
      'You are MISA AI (MyFNG Instant Service Assistant) on WhatsApp. Help the customer complete a service booking. Steps: 1) Get car model + pincode 2) Show pricing 3) Get vehicle registration number 4) Get name 5) Get phone + OTP verify 6) Get address 7) Get date/time 8) Create booking. Keep replies under 900 characters. No markdown **.',
    addon: 'MISA AI = MyFNG Instant Service Assistant. On greetings use: "Hi! I\'m MISA AI — MyFNG Instant Service Assistant." Use tools for pricing and booking. If RSA/towing, hand off immediately.',
    triggers: {},
    tools: { pricing: true, workshops: true, service_details: true, booking: true },
  },
  FOLLOWUP: {
    goal:
      'You are MyFNG Follow-up Assistant for car service bookings. Send one gentle, contextual check-in based on follow-up reason (telecaller callback, incomplete booking, service due). Keep it short, friendly, one question. Do not be pushy.',
    addon:
      'WhatsApp channel. Under 500 characters. One clear question. Every message must be uniquely worded — vary greeting, hook, and question. Car service only unless CRM mentions otherwise.',
    triggers: {
      telecaller_follow_up: { enabled: true, offset_minutes: 0 },
      telecaller_offset_minutes: 0,
      service_due_reminder: { enabled: false },
      cse_callback: { enabled: false },
      incomplete_booking: { enabled: true, delay_hours: 2 },
      incomplete_booking_delay_hours: 2,
      outbound_template_name: 'app_session_incomplete',
      outbound_template_language: 'en',
    },
    tools: { pricing: false, workshops: false, service_details: false, booking: false },
  },
  CHASE: {
    goal:
      'You are MyFNG Sales Follow-up Agent. Convert this lead into a booked service. Follow up persistently but politely. Increase urgency gradually. If buying intent detected, activate MISA AI. If stop/unsubscribe, end immediately. If angry, escalate.',
    addon: 'WhatsApp channel. Under 700 characters. Never more than one question per message.',
    triggers: {
      telecrm_new_lead: { enabled: true, dispositions: ['New', 'Interested'] },
      no_reply_hours: 48,
      cold_lead_days: 3,
      dispositions_to_chase: ['Interested', 'Callback', 'Quotation Sent'],
      outbound_template_name: 'lead_enquiry_account_update',
      outbound_template_language: 'en',
      lookback_hours: 48,
      disposition_rules: {
        enabled: true,
        rules: [
          {
            id: 'interested',
            disposition: 'Interested',
            enabled: true,
            trigger_on: 'both',
            bot: 'CHASE',
            message_mode: 'ai',
            ai_prompt_addon:
              'TeleCRM stage: Interested. Customer showed interest — offer car service booking, share value, one clear CTA.',
          },
          {
            id: 'follow-up',
            disposition: 'Follow-up',
            enabled: true,
            trigger_on: 'both',
            bot: 'FOLLOWUP',
            message_mode: 'ai',
            ai_prompt_addon:
              'TeleCRM stage: Follow-up. Telecaller marked callback needed — gentle reminder, ask best time for car service.',
          },
          {
            id: 'attempted-contact',
            disposition: 'Attempted Contact',
            enabled: true,
            trigger_on: 'both',
            bot: 'CHASE',
            message_mode: 'fixed',
            message:
              'Hi {{name}}, we tried reaching you about your car service enquiry with MyFNG. When is a good time to connect?',
          },
          {
            id: 'not-interested',
            disposition: 'Not Interested',
            enabled: true,
            trigger_on: 'disposition_change',
            bot: 'NONE',
            message_mode: 'skip',
            end_active_bots: true,
          },
        ],
      },
    },
    tools: { pricing: true, workshops: false, service_details: false, booking: false },
  },
};

export function defaultAgentConfig(agentType: AgentType): AgentConfig {
  const prompts = DEFAULT_PROMPTS[agentType];
  const rules =
    agentType === 'FOLLOWUP'
      ? { ...DEFAULT_AGENT_RULES, max_follow_ups: 1, max_daily_messages: 1 }
      : { ...DEFAULT_AGENT_RULES };
  return {
    agent_type: agentType,
    enabled: false,
    model: 'gpt-4o-mini',
    goal_prompt: prompts.goal,
    system_prompt_addon: prompts.addon,
    fallback_message: 'Thanks for reaching out to MyFNG! Our team will get back to you shortly.',
    rules_json: rules,
    triggers_json: { ...prompts.triggers },
    tools_json: { ...prompts.tools },
    telecrm_sync_json: { ...DEFAULT_TELECRM_SYNC },
  };
}
