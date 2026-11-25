import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { normalizePhoneNumber, sendReplyButtonsMessage } from '@/lib/services/whatsappService';
import { archiveAgentOutboundMessage } from '../shared/outbound';
import { isGreetingMessage } from './intent';

export const MISA_TALK_BUTTON_ID = 'misa_talk';
export const MISA_HUMAN_BUTTON_ID = 'misa_human';
export const CUSTOMER_HUMAN_REQUEST_MARKER = '[CUSTOMER_HUMAN_REQUEST]';

export const MISA_CHOICE_BODY =
  "Hi! I'm MISA AI — MyFNG Instant Service Assistant.\n\nWant to book or ask about car service with MISA, or talk to a human agent?";

export function parseMisaChoice(message: string): 'misa' | 'human' | null {
  const t = String(message || '')
    .trim()
    .toLowerCase();
  if (!t) return null;
  if (
    t === MISA_TALK_BUTTON_ID ||
    t === 'talk to misa' ||
    t === 'talk to misa ai' ||
    t === 'misa se baat' ||
    t === 'misa' ||
    t === 'misa ai' ||
    t === 'hi misa'
  ) {
    return 'misa';
  }
  if (
    t === MISA_HUMAN_BUTTON_ID ||
    t === 'human agent' ||
    t === 'assign a human agent' ||
    t === 'assign human agent'
  ) {
    return 'human';
  }
  return null;
}

export function wantsHumanHelp(message: string): boolean {
  const t = String(message || '')
    .trim()
    .toLowerCase();
  if (!t) return false;
  if (parseMisaChoice(t) === 'human') return true;
  const needles = [
    'callback',
    'call back',
    'call me',
    'arrange call',
    'talk to human',
    'speak to someone',
    'speak to a person',
    'customer care',
    'at service center',
    'at the service center',
    'in the service center',
    'at workshop',
    'at the workshop',
    'human agent',
    'connect me to',
    'need an agent',
    'need a person',
  ];
  return needles.some((n) => t.includes(n));
}

export function shouldOfferMisaOrHumanChoice(
  message: string,
  misaChoice: string | null | undefined,
): boolean {
  if (parseMisaChoice(message)) return false;
  if (wantsHumanHelp(message)) return true;
  if (misaChoice === 'misa') return false;
  return isGreetingMessage(message) || !misaChoice;
}

/** Same greeting buttons are not re-sent to a phone within this window. */
const MISA_CHOICE_COOLDOWN_MS = 2 * 60 * 1000;

async function wasChoiceSentRecently(phone: string): Promise<boolean> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return false;
  const since = new Date(Date.now() - MISA_CHOICE_COOLDOWN_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from('whatsapp_messages')
    .select('id')
    .eq('direction', 'OUTBOUND')
    .eq('recipient_phone', normalizePhoneNumber(phone))
    .neq('status', 'FAILED')
    .contains('meta', { route: 'MISA_CHOICE_BUTTONS' })
    .gte('created_at', since)
    .limit(1);
  if (error) return false;
  return Array.isArray(data) && data.length > 0;
}

export async function sendMisaOrHumanChoiceButtons(phone: string): Promise<boolean> {
  // The buttons are already on the customer's screen — another copy looks like a broken bot.
  // Report as sent so the router does not fall through to the brain for a second reply.
  if (await wasChoiceSentRecently(phone)) {
    console.log('[whatsapp-booking] MISA choice buttons skipped (sent recently)', { phone });
    return true;
  }
  const result = await sendReplyButtonsMessage({
    phoneNumber: phone,
    body: MISA_CHOICE_BODY,
    buttons: [
      { id: MISA_TALK_BUTTON_ID, title: 'Talk to MISA' },
      { id: MISA_HUMAN_BUTTON_ID, title: 'Human agent' },
    ],
    footer: 'Tap a button to continue',
  });
  await archiveAgentOutboundMessage({
    phone,
    text: MISA_CHOICE_BODY,
    sendResult: result,
    source: 'whatsapp_booking_agent',
    meta: { route: 'MISA_CHOICE_BUTTONS', interactive: 'buttons' },
  });
  return result.success;
}
