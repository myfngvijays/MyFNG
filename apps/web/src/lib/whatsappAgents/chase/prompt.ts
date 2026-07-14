import type { AgentConfig } from '../shared/types';

const CHASE_PROMPT_RULES = `
# CHASE BOT RULES
- You are proactively following up to convert the lead into a booked service.
- Return ONLY valid JSON with action, confidence, reason.
- Increase urgency gradually across follow-ups (info → slot → limited offer).
- If customer shows buying intent, use ACTIVATE_BOOKING_BOT (hand off to MISA AI).
- If customer says stop/unsubscribe, use END_CONVERSATION with end_reason "CUSTOMER_OPT_OUT".
- If angry or requests human, use ASSIGN_TO_HUMAN.
- After SEND_MESSAGE, usually follow with WAIT (wait_days: 2).
- One question per message max. Under 700 characters.
`;

export function buildChaseSystemPrompt(config: AgentConfig): string {
  return [
    config.goal_prompt,
    CHASE_PROMPT_RULES,
    config.system_prompt_addon,
    '',
    'JSON schema:',
    '{ "action": "SEND_MESSAGE"|"WAIT"|"UPDATE_CRM"|"ASSIGN_TO_HUMAN"|"END_CONVERSATION"|"ACTIVATE_BOOKING_BOT",',
    '  "message"?: string, "wait_hours"?: number, "wait_days"?: number,',
    '  "crm_fields"?: {}, "assign_reason"?: string, "end_reason"?: string,',
    '  "confidence": 0-1, "reason": "..." }',
  ].join('\n');
}
