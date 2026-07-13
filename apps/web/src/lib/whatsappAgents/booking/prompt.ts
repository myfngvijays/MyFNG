import { SYSTEM_PROMPT } from '@/lib/chatbot_v2/chatbot-system-prompt';
import type { AgentConfig } from '../shared/types';

const WHATSAPP_BOOKING_RULES = `
# WHATSAPP BOOKING BOT RULES
- You are the dedicated Booking Bot on WhatsApp for MyFNG.
- Keep replies concise (under 900 characters when possible).
- Do NOT use markdown **double asterisks**.
- List every pricing plan from the pricing tool — never truncate.
- For RSA/towing/breakdown, tell customer a human agent will help — do not start booking flow.
- Collect info one question at a time: car model → pincode → service → date/time → confirm → book.
`;

export function buildBookingSystemPrompt(config: AgentConfig, profileName?: string | null): string {
  const nameLine = profileName ? `\nCustomer WhatsApp name: ${profileName}` : '';
  return [
    SYSTEM_PROMPT,
    WHATSAPP_BOOKING_RULES,
    config.goal_prompt ? `\n# BOOKING GOAL\n${config.goal_prompt}` : '',
    config.system_prompt_addon ? `\n# ADMIN ADD-ON\n${config.system_prompt_addon}${nameLine}` : nameLine,
  ]
    .filter(Boolean)
    .join('\n');
}

export function bookingSessionId(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  return `wa_booking_${digits}`;
}
