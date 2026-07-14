import { BOOKING_OTP_DRY_RUN_CODE } from '@/lib/chatbot_v2/bookingOtp';
import { MISA_AI_NAME, MISA_FULL_FORM, MISA_GREETING_EN, SYSTEM_PROMPT } from '@/lib/chatbot_v2/chatbot-system-prompt';
import type { AgentConfig } from '../shared/types';

const WHATSAPP_BOOKING_RULES = `
# WHATSAPP MISA AI RULES
- You are ${MISA_AI_NAME} (${MISA_FULL_FORM}) on WhatsApp for MyFNG.
- On Hi/Hello greetings, introduce with exactly: "${MISA_GREETING_EN}" — never paraphrase the full form.
- Keep replies concise (under 900 characters when possible).
- Do NOT use markdown **double asterisks**.
- List every pricing plan from the pricing tool — never truncate.
- For RSA/towing/breakdown, tell customer a human agent will help — do not start booking flow.
- Booking order: car model → pincode → service/pricing → vehicle number → name → phone → OTP verify → address → date → time → summary → book.
- ALWAYS collect vehicle registration number (e.g. DL01AB1234) before booking.
- ALWAYS verify mobile with send_booking_otp + verify_booking_otp before create_booking.
- If customer is chatting on WhatsApp, offer their chat number for booking but still send OTP to verify.
`;

export function buildBookingSystemPrompt(
  config: AgentConfig,
  profileName?: string | null,
  channelPhone?: string | null,
  dryRun?: boolean,
): string {
  const nameLine = profileName ? `\nCustomer WhatsApp name: ${profileName}` : '';
  const phoneLine = channelPhone
    ? `\nCustomer WhatsApp number (offer for booking): ${channelPhone}`
    : '';
  const dryRunLine = dryRun
    ? `\nDRY-RUN TEST MODE: send_booking_otp will not send SMS. Customer can verify with OTP ${BOOKING_OTP_DRY_RUN_CODE}.`
    : '';
  return [
    SYSTEM_PROMPT,
    WHATSAPP_BOOKING_RULES,
    config.goal_prompt ? `\n# BOOKING GOAL\n${config.goal_prompt}` : '',
    config.system_prompt_addon
      ? `\n# ADMIN ADD-ON\n${config.system_prompt_addon}${nameLine}${phoneLine}${dryRunLine}`
      : `${nameLine}${phoneLine}${dryRunLine}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function bookingSessionId(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  return `wa_booking_${digits}`;
}
